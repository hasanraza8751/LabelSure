import os
import tempfile
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form

from backend.app.models import (
    QualityResponse,
    OCRResponse,
    EvaluateRulesRequest,
    InspectionResponse,
)
from backend.app.services.pipeline import InspectionPipeline, MAX_SURFACES
from backend.app.services.confidence import ConfidenceEngine
from backend.app import database

router = APIRouter()

_pipeline: InspectionPipeline = None


def get_pipeline() -> InspectionPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = InspectionPipeline()
    return _pipeline


def _save_upload(upload: UploadFile) -> str:
    suffix = os.path.splitext(upload.filename or "")[1] or ".jpg"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(upload.file.read())
    finally:
        tmp.close()
    return tmp.name


@router.post("/inspect")
def inspect_package(
    files: List[UploadFile] = File(...),
    product_name: Optional[str] = Form(None),
    pipeline: InspectionPipeline = Depends(get_pipeline),
):
    """Full multi-surface inspection: upload 1-6 photos of one package
    (front / back / sides / top / bottom, or a single flat label image)."""
    if len(files) < 1:
        raise HTTPException(status_code=422, detail="At least one image is required")
    if len(files) > MAX_SURFACES:
        raise HTTPException(
            status_code=422,
            detail=f"At most {MAX_SURFACES} surfaces supported, got {len(files)}",
        )
    paths = []
    try:
        for upload in files:
            paths.append(_save_upload(upload))
        result = pipeline.run_multi(
            paths,
            image_names=[u.filename for u in files],
            product_name=product_name,
        )
        # best-effort history persistence (never fails the inspection)
        database.save_inspection(result)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inspection failed: {e}")
    finally:
        for path in paths:
            try:
                os.unlink(path)
            except OSError:
                pass


@router.get("/inspections")
def list_inspections(limit: int = 50):
    """Recent inspection history (summaries)."""
    return {"inspections": database.list_inspections(limit=limit)}


@router.get("/inspections/{inspection_id}")
def get_inspection(inspection_id: str):
    """Full stored response payload for one inspection."""
    result = database.get_inspection(inspection_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return result


@router.post("/assess-quality", response_model=QualityResponse)
def assess_quality(upload: UploadFile = File(...), pipeline: InspectionPipeline = Depends(get_pipeline)):
    path = _save_upload(upload)
    try:
        return pipeline.assess_quality(path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quality assessment failed: {e}")
    finally:
        os.unlink(path)


@router.post("/ocr", response_model=OCRResponse)
def run_cr(upload: UploadFile = File(...), pipeline: InspectionPipeline = Depends(get_pipeline)):
    path = _save_upload(upload)
    try:
        return pipeline.ocr(path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {e}")
    finally:
        os.unlink(path)


@router.post("/extract-fields")
def extract_fields(payload: Dict[str, Any], pipeline: InspectionPipeline = Depends(get_pipeline)):
    """Extract fields from pre-computed OCR output.

    Body: {"texts": [...], "confidences": [...], "bounding_boxes": [...]}
    """
    try:
        texts = payload["texts"]
        confidences = payload["confidences"]
        bounding_boxes = payload["bounding_boxes"]
    except KeyError as e:
        raise HTTPException(status_code=422, detail=f"Missing field: {e}")

    fields = pipeline.extract_fields(texts, confidences, bounding_boxes)
    return {
        name: {
            "field_name": f.field_name,
            "value": f.value,
            "ocr_text": f.ocr_text,
            "ocr_confidence": f.ocr_confidence,
            "extraction_confidence": f.extraction_confidence,
            "confidence_level": f.confidence_level,
            "bbox": f.bbox,
            "reason": f.reason,
            "line_index": f.line_index,
        }
        for name, f in fields.items()
    }


@router.post("/evaluate-rules")
def evaluate_rules(payload: EvaluateRulesRequest, pipeline: InspectionPipeline = Depends(get_pipeline)):
    """Evaluate rules against extracted fields (with optional quality context)."""
    rule_results, compliance = pipeline.evaluate_rules(
        payload.extracted_fields, payload.image_quality
    )

    confidence_engine = ConfidenceEngine()
    ocr_result = (
        {"avg_confidence": payload.ocr_avg_confidence, "texts": [""] * 1}
        if payload.ocr_avg_confidence is not None
        else None
    )
    confidence = confidence_engine.compute(
        ocr_result, payload.extracted_fields, payload.image_quality, rule_results
    )
    confidence = confidence_engine.fuse_decision(confidence, compliance)

    return {
        "rule_results": [r.to_dict() for r in rule_results],
        "compliance_decision": compliance.to_dict(),
        "confidence": confidence.to_dict(),
    }


@router.get("/rules")
def list_rules(pipeline: InspectionPipeline = Depends(get_pipeline)):
    """List the loaded ruleset (transparency: severity, source, verification)."""
    return {
        "ruleset": pipeline.rule_engine.ruleset_meta,
        "rules": [
            {
                "rule_id": r.get("rule_id"),
                "requirement": r.get("requirement"),
                "rule_type": r.get("rule_type"),
                "fields": r.get("fields"),
                "validation": r.get("validation"),
                "severity": r.get("severity"),
                "source": r.get("source"),
                "verified": r.get("verified", False),
            }
            for r in pipeline.rule_engine.rules
        ],
    }
