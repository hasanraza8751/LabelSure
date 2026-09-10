from typing import Any, Dict, Optional
import os

from fastapi import APIRouter, Depends, HTTPException

from backend.app import auth, database
from backend.app.models import (
    EmailReportRequest,
    FieldCorrectionsRequest,
    InspectorDecisionRequest,
    InspectorDecisionResponse,
    RuleNotesRequest,
)
from backend.app.services import hitl, pdf_report

router = APIRouter()


@router.get("/mail/status")
def mail_status():
    """Whether SMTP delivery is configured (no secrets returned)."""
    from backend.app.services import mailer

    return mailer.describe()


@router.post("/inspections/{inspection_id}/email")
def email_report(
    inspection_id: str,
    payload: EmailReportRequest,
    principal: Dict[str, Any] = Depends(auth.require_role(auth.INSPECTOR)),
):
    """Email the PDF inspection report.

    Only a screening a human has signed off can be emailed, and only when the
    inspector confirmed it compliant - an unreviewed or failed screening is
    not something to circulate.
    """
    from backend.app.services import mailer

    result = database.get_inspection(inspection_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Inspection not found")

    decision = hitl.get_decision(inspection_id)
    if decision is None:
        raise HTTPException(
            status_code=422,
            detail="Record the inspector sign-off before emailing this report",
        )
    if decision.get("final_decision") != "COMPLIANT":
        raise HTTPException(
            status_code=422,
            detail=(
                "Only inspections the inspector marked compliant can be emailed. "
                f"This one is {decision.get('final_decision')}."
            ),
        )

    output_dir = os.path.join("reports", "inspections")
    os.makedirs(output_dir, exist_ok=True)
    pdf_path = os.path.join(output_dir, f"{inspection_id}.pdf")
    try:
        pdf_report.generate_pdf_report(
            result, pdf_path, inspector_decision=decision
        )
    except pdf_report.PDFUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")

    product = result.get("product_name") or "Unnamed package"
    subject = f"Compliance inspection report — {product} ({inspection_id[:8]})"
    body = (
        f"The inspection report for {product} is attached as a PDF.\n\n"
        f"Inspection ID: {inspection_id}\n"
        f"Automated verdict: {result.get('decision')}\n"
        f"Final inspector verdict: {decision.get('final_decision')} "
        f"(signed off by {decision.get('inspector_name') or decision.get('inspector_id')})"
        + (f"\n\nNote: {payload.note.strip()}" if payload.note and payload.note.strip() else "")
        + "\n\nSent by LabelSure — AI-assisted compliance screening."
    )

    try:
        message = mailer.send_report(payload.to, subject, body, pdf_path)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        database.write_audit(
            action="REPORT_EMAIL_FAILED",
            actor=auth.principal_id(principal),
            entity_type="inspection",
            entity_id=inspection_id,
            outcome="ERROR",
            details={"to": payload.to, "error": str(e)},
        )
        raise HTTPException(status_code=502, detail=f"Could not send email: {e}")

    database.write_audit(
        action="REPORT_EMAILED",
        actor=auth.principal_id(principal),
        actor_role=auth.principal_role(principal),
        entity_type="inspection",
        entity_id=inspection_id,
        outcome="SUCCESS",
        details={"to": payload.to},
    )
    return {"sent": True, "to": payload.to, "message": message}


@router.post("/inspections/{inspection_id}/field-corrections")
def record_field_corrections(
    inspection_id: str,
    payload: FieldCorrectionsRequest,
    principal: Dict[str, Any] = Depends(auth.require_role(auth.INSPECTOR)),
):
    """Save inspector corrections to AI-extracted values.

    The stored inspection payload is never mutated - the corrections sit
    alongside it, so the original reading and the human's reading are both
    preserved (PRD §21).
    """
    if not database.inspection_exists(inspection_id):
        raise HTTPException(status_code=404, detail="Inspection not found")

    inspector_id = auth.principal_id(principal)
    if not auth.auth_enabled():
        inspector_id = (payload.inspector_id or inspector_id).strip() or inspector_id

    try:
        result = database.save_field_corrections(
            inspection_id, inspector_id, [c.model_dump() for c in payload.corrections]
        )
        database.write_audit(
            action="FIELD_CORRECTIONS_SAVED",
            actor=inspector_id,
            actor_role=auth.principal_role(principal),
            entity_type="inspection",
            entity_id=inspection_id,
            outcome="SUCCESS",
            details={"count": result["count"]},
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Could not save field corrections: {e}"
        )


@router.get("/inspections/{inspection_id}/field-corrections")
def get_field_corrections(inspection_id: str):
    """The inspector's corrected extracted values for one inspection."""
    if not database.inspection_exists(inspection_id):
        raise HTTPException(status_code=404, detail="Inspection not found")
    return {"corrections": database.get_field_corrections(inspection_id)}


@router.post("/inspections/{inspection_id}/rule-notes")
def record_rule_notes(
    inspection_id: str,
    payload: RuleNotesRequest,
    principal: Dict[str, Any] = Depends(auth.require_role(auth.INSPECTOR)),
):
    """Save per-rule inspector findings.

    The payload is {"notes": [{"rule_id": "...", "inspector_status": "PASS|FAIL|MANUAL_REVIEW", "note": "..."}, ...]}
    """
    notes = [n.model_dump() for n in payload.notes]

    inspector_id = auth.principal_id(principal)
    if not auth.auth_enabled():
        inspector_id = (payload.inspector_id or inspector_id).strip() or inspector_id

    try:
        result = database.save_rule_notes(inspection_id, inspector_id, notes)
        database.write_audit(
            action="RULE_NOTES_SAVED",
            actor=inspector_id,
            actor_role=auth.principal_role(principal),
            entity_type="inspection",
            entity_id=inspection_id,
            outcome="SUCCESS",
            details={"count": result["count"]},
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save rule notes: {e}")


@router.get("/inspections/{inspection_id}/rule-notes")
def get_rule_notes(inspection_id: str):
    """The inspector's per-rule notes for one inspection."""
    if not database.inspection_exists(inspection_id):
        raise HTTPException(status_code=404, detail="Inspection not found")
    return {"notes": database.get_rule_notes(inspection_id)}


@router.post(
    "/inspections/{inspection_id}/decision", response_model=InspectorDecisionResponse
)
def record_decision(
    inspection_id: str,
    payload: InspectorDecisionRequest,
    principal: Dict[str, Any] = Depends(auth.require_role(auth.INSPECTOR)),
):
    """Accept or override the automated finding.

    The inspector identity comes from the authenticated token when auth is
    enabled; only an unauthenticated (auth-disabled) caller may name itself.
    """
    if auth.auth_enabled():
        inspector_id = auth.principal_id(principal)
    else:
        inspector_id = (payload.inspector_id or "").strip()
        if not inspector_id:
            raise HTTPException(
                status_code=422,
                detail="inspector_id is required when authentication is disabled",
            )

    try:
        return hitl.record_decision(
            inspection_id=inspection_id,
            inspector_id=inspector_id,
            action=payload.action,
            reason=payload.reason,
            final_decision=payload.final_decision,
            inspector_name=payload.inspector_name,
            notes=payload.notes,
            actor_role=auth.principal_role(principal),
        )
    except hitl.DecisionError as e:
        message = str(e)
        raise HTTPException(
            status_code=404 if "not found" in message else 422, detail=message
        )
    except Exception as e:
        # A sign-off that did not persist must not report success.
        database.write_audit(
            action="INSPECTION_DECISION_FAILED",
            actor=inspector_id,
            entity_type="inspection",
            entity_id=inspection_id,
            outcome="ERROR",
            details={"error": str(e)},
        )
        raise HTTPException(status_code=500, detail=f"Could not record decision: {e}")


@router.get("/inspections/{inspection_id}/decision")
def get_decision(inspection_id: str):
    """The current inspector decision, or 404 if the inspection is unreviewed."""
    decision = hitl.get_decision(inspection_id)
    if decision is None:
        if not database.inspection_exists(inspection_id):
            raise HTTPException(status_code=404, detail="Inspection not found")
        raise HTTPException(
            status_code=404, detail="No inspector decision recorded for this inspection"
        )
    return decision


@router.get("/inspections/{inspection_id}/audit")
def inspection_audit(
    inspection_id: str,
    principal: Dict[str, Any] = Depends(auth.require_role(auth.INSPECTOR)),
):
    """AI decision + every inspector decision + every logged action."""
    if not database.inspection_exists(inspection_id):
        raise HTTPException(status_code=404, detail="Inspection not found")
    return hitl.audit_trail(inspection_id)


@router.get("/review-queue")
def review_queue(
    limit: int = 100,
    sort_by: str = "confidence",
    principal: Dict[str, Any] = Depends(auth.require_role(auth.INSPECTOR)),
):
    """Inspections awaiting a human decision, least-confident first (PRD §19)."""
    items = hitl.pending_queue(limit=limit, sort_by=sort_by)
    for item in items:
        item["priority"] = hitl.queue_bucket(item.get("confidence"))
    return {"count": len(items), "sort_by": sort_by, "queue": items}


@router.get("/audit-log")
def audit_log(
    entity_id: Optional[str] = None,
    actor: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 200,
    principal: Dict[str, Any] = Depends(auth.require_role(auth.SUPERVISOR)),
):
    """The append-only audit trail. Supervisor and above only."""
    return {
        "entries": database.read_audit(
            entity_id=entity_id, actor=actor, action=action, limit=limit
        )
    }
