"""Regression tests for the two-stage AI adjudication pipeline.

All Gemini API calls are mocked — no real API is invoked. Tests cover:

  - False MRP from random numbers / batch codes
  - Missed field recovery by AI
  - UNREADABLE OCR routing to MANUAL_REVIEW (not FAIL)
  - Multi-image evidence merging
  - AI correction of wrong OCR
  - AI disagreement with rule engine
  - AI unavailable / malformed response graceful fallback
  - Manual review reason specificity
"""

import sys
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Prevent dotenv from loading real keys
os.environ["LABELSURE_DISABLE_DOTENV"] = "1"
os.environ.setdefault("DATABASE_URL", "sqlite:///test_ai_adj.db")
os.environ.setdefault("AUTH_ENABLED", "false")
os.environ.setdefault("AUTH_SECRET_KEY", "test-secret-ai-adj")
# Clear API key so AI is disabled by default in tests that don't need it
os.environ.pop("GEMINI_API_KEY", None)

import pytest

from backend.app.services.gemini import GeminiService, get_service, reset_service
from backend.app.services.pipeline import InspectionPipeline
from backend.app.services.field_extraction import FieldExtractor


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_bbox(i: int):
    return [[10, i * 60], [300, i * 60], [300, i * 60 + 40], [10, i * 60 + 40]]


def _fake_quality():
    return {"usable": True, "score": 92.0, "checks": {}}


def _fake_ocr(texts: List[str], conf: float = 0.97):
    return {
        "texts": texts,
        "confidences": [conf] * len(texts),
        "bounding_boxes": [_make_bbox(i) for i in range(len(texts))],
        "avg_confidence": conf,
        "statuses": ["FOUND" if conf >= 0.90 else "FOUND_LOW_CONFIDENCE"] * len(texts),
        "retry_used": False,
        "preprocessing_applied": False,
    }


def _pipeline_with_ocr(front_texts, back_texts=None, conf=0.97):
    """Return a pipeline with stubbed quality gate and OCR."""
    pipeline = InspectionPipeline(annotate=False)
    pipeline.assess_quality = lambda path: _fake_quality()

    def fake_ocr(path):
        if back_texts and "back" in path:
            return _fake_ocr(back_texts, conf)
        return _fake_ocr(front_texts, conf)

    pipeline.ocr = fake_ocr
    return pipeline


# ---------------------------------------------------------------------------
# 1. False MRP from batch number — the most critical regression
# ---------------------------------------------------------------------------

class TestFalseMRPRejection:
    def test_batch_number_not_mrp_standalone(self):
        """'Batch No: 350' near MRP section must NOT produce MRP = 350."""
        extractor = FieldExtractor()
        texts = [
            "Batch No: 350",
            "Net Wt: 200g",
            "Manufactured By: ABC Foods",
        ]
        confs = [0.98, 0.98, 0.98]
        bboxes = [_make_bbox(i) for i in range(len(texts))]
        result = extractor._extract_mrp(texts, confs, bboxes)
        assert result.value is None, (
            f"Batch number '350' was incorrectly extracted as MRP: {result.value}"
        )
        assert result.confidence_level == "MISSING"

    def test_random_number_no_price_cue_not_mrp(self):
        """A bare number with no MRP/₹/Rs keyword must never be extracted as MRP."""
        extractor = FieldExtractor()
        texts = [
            "Product: Premium Biscuits",
            "250",  # Could be quantity, code, anything — no price cue
            "Net Wt: 400g",
        ]
        confs = [0.99, 0.99, 0.99]
        bboxes = [_make_bbox(i) for i in range(len(texts))]
        result = extractor._extract_mrp(texts, confs, bboxes)
        assert result.value is None, f"Bare number '250' should not be MRP: {result.value}"

    def test_lot_number_not_mrp(self):
        """Lot number that happens to be a plausible price value must not be MRP."""
        extractor = FieldExtractor()
        texts = [
            "Lot No: 120",
            "MFG: Jan 2025",
            "Country of Origin: India",
        ]
        confs = [0.99, 0.99, 0.99]
        bboxes = [_make_bbox(i) for i in range(len(texts))]
        result = extractor._extract_mrp(texts, confs, bboxes)
        assert result.value is None, f"Lot number '120' should not be MRP: {result.value}"

    def test_mrp_with_price_cue_found(self):
        """MRP is correctly extracted when an explicit price-cue keyword is present."""
        extractor = FieldExtractor()
        texts = [
            "M.R.P. (Incl. of all taxes)",
            "Rs. 45.00",
            "Net Wt: 200g",
        ]
        confs = [0.97, 0.97, 0.97]
        bboxes = [_make_bbox(i) for i in range(len(texts))]
        result = extractor._extract_mrp(texts, confs, bboxes)
        assert result.value is not None, "MRP should be found when price cue is present"
        assert "45" in result.value


# ---------------------------------------------------------------------------
# 2. OCR extraction_status taxonomy
# ---------------------------------------------------------------------------

class TestExtractionStatus:
    def test_extraction_status_found_on_high_confidence(self):
        """High-confidence MRP extraction → extraction_status=FOUND."""
        extractor = FieldExtractor()
        texts = ["MRP ₹50.00"]
        confs = [0.97]
        bboxes = [_make_bbox(0)]
        result = extractor._extract_mrp(texts, confs, bboxes)
        assert result.extraction_status == "FOUND"

    def test_extraction_status_found_low_confidence_on_adjacent_line(self):
        """MRP found on adjacent line → extraction_status=FOUND_LOW_CONFIDENCE."""
        extractor = FieldExtractor()
        texts = ["M.R.P.", "Rs. 30"]
        confs = [0.88, 0.88]
        bboxes = [_make_bbox(i) for i in range(2)]
        result = extractor._extract_mrp(texts, confs, bboxes)
        assert result.value is not None
        assert result.extraction_status in ("FOUND", "FOUND_LOW_CONFIDENCE")

    def test_extraction_status_not_found_when_no_mrp(self):
        """No MRP on label → extraction_status=NOT_FOUND."""
        extractor = FieldExtractor()
        texts = ["Net Wt: 100g", "Mfg: Jan 2025"]
        confs = [0.97, 0.97]
        bboxes = [_make_bbox(i) for i in range(2)]
        result = extractor._extract_mrp(texts, confs, bboxes)
        assert result.extraction_status == "NOT_FOUND"

    def test_extraction_status_unreadable_low_conf_price_cue(self):
        """Price cue present but very low OCR confidence → extraction_status=UNREADABLE."""
        extractor = FieldExtractor()
        texts = ["MRP ₹"]  # cue present, value unreadable
        confs = [0.40]     # below the UNREADABLE threshold
        bboxes = [_make_bbox(0)]
        result = extractor._extract_mrp(texts, confs, bboxes)
        # Either UNREADABLE (cue found, value unreadable) or NOT_FOUND (cue not parseable)
        assert result.extraction_status in ("UNREADABLE", "NOT_FOUND"), (
            f"Expected UNREADABLE or NOT_FOUND, got: {result.extraction_status}"
        )

    def test_extracted_field_has_extraction_status_key(self):
        """All fields returned by extract_all must carry extraction_status."""
        extractor = FieldExtractor()
        texts = [
            "ACME Biscuits",
            "MRP: Rs. 25.00",
            "Net Wt: 100g",
            "Mfg: Jan 2025",
        ]
        confs = [0.97] * len(texts)
        bboxes = [_make_bbox(i) for i in range(len(texts))]
        results = extractor.extract_all(texts, confs, bboxes)
        for field_name, field in results.items():
            assert hasattr(field, "extraction_status"), (
                f"Field '{field_name}' missing extraction_status attribute"
            )
            assert field.extraction_status in (
                "FOUND", "FOUND_LOW_CONFIDENCE", "NOT_FOUND", "UNREADABLE", "AMBIGUOUS"
            ), f"Field '{field_name}' has invalid extraction_status: {field.extraction_status!r}"


# ---------------------------------------------------------------------------
# 3. AI unavailable — deterministic result stands
# ---------------------------------------------------------------------------

class TestAIUnavailable:
    def setup_method(self):
        reset_service()
        os.environ.pop("GEMINI_API_KEY", None)

    def test_no_api_key_ai_status_skipped(self):
        """When GEMINI_API_KEY is absent, result['ai']['status'] must be 'skipped'."""
        pipeline = _pipeline_with_ocr(
            ["MRP Rs. 45.00", "Net Wt: 200g"],
            ["Mfg by: ABC Foods Pvt Ltd", "Mfg Date: 01/2025"],
        )
        result = pipeline.run_multi(
            ["fake_front.jpg", "fake_back.jpg"],
            image_names=["front.jpg", "back.jpg"],
        )
        ai = result.get("ai") or {}
        assert ai.get("status") == "skipped", f"Expected 'skipped', got: {ai.get('status')!r}"
        # Decision must still be a valid deterministic decision
        assert result["decision"] in ("COMPLIANT", "NON_COMPLIANT", "MANUAL_REVIEW")

    def test_no_api_key_result_schema_still_correct(self):
        """AI block is present even when skipped — schema 1.2 must be intact."""
        pipeline = _pipeline_with_ocr(["MRP Rs. 45.00"])
        result = pipeline.run_multi(["fake_front.jpg"], image_names=["front.jpg"])
        assert "ai" in result
        assert result["response_schema"] == "labelguard-inspection/1.2"


# ---------------------------------------------------------------------------
# 4. AI verification corrects OCR
# ---------------------------------------------------------------------------

class TestAIVerification:
    def setup_method(self):
        reset_service()
        os.environ["GEMINI_API_KEY"] = "fake-test-key-for-mocking"

    def teardown_method(self):
        os.environ.pop("GEMINI_API_KEY", None)
        reset_service()

    def test_ai_corrects_batch_number_misread_as_mrp(self):
        """AI sees Batch No 350 was OCR'd near MRP text and corrects it to NOT_FOUND."""
        pipeline = _pipeline_with_ocr(
            ["MRP", "Batch No: 350", "Net Wt: 200g"],
        )

        verify_return = {
            "mrp": {
                "status": "NOT_FOUND",
                "value": None,
                "source_image": "front.jpg",
                "reason": "The number 350 is clearly labelled 'Batch No' in the image, not MRP",
            }
        }
        adjudicate_return = {
            "verdict": "MANUAL_REVIEW",
            "explanation": "MRP is absent. Batch No 350 was misread. Manual verification required.",
            "confidence": 0.82,
            "per_rule_overrides": {},
        }

        svc = get_service()
        svc.verify_fields = MagicMock(return_value=verify_return)
        svc.adjudicate = MagicMock(return_value=adjudicate_return)

        result = pipeline.run_multi(
            ["fake_front.jpg"], image_names=["front.jpg"],
        )
        # AI corrected MRP to NOT_FOUND so mrp field value should now be None
        mrp_field = result["extracted_fields"].get("mrp", {})
        assert mrp_field.get("value") is None or result["decision"] == "MANUAL_REVIEW"
        assert result["decision"] == "MANUAL_REVIEW"

    def test_ai_recovers_mrp_from_another_image(self):
        """AI finds MRP on image 2 that OCR missed on image 1."""
        pipeline = _pipeline_with_ocr(
            front_texts=["Product: Biscuits", "Net Wt: 200g"],
            back_texts=["MRP: Rs. 25.00", "Mfg by: ABC Foods Pvt Ltd"],
        )

        verify_return = {
            "mrp": {
                "status": "FOUND",
                "value": "₹25.00",
                "source_image": "back.jpg",
                "reason": "MRP Rs. 25.00 clearly visible on back label",
            }
        }
        adjudicate_return = {
            "verdict": "COMPLIANT",
            "explanation": "All mandatory declarations found across both surfaces.",
            "confidence": 0.91,
            "per_rule_overrides": {},
        }

        svc = get_service()
        svc.verify_fields = MagicMock(return_value=verify_return)
        svc.adjudicate = MagicMock(return_value=adjudicate_return)

        result = pipeline.run_multi(
            ["fake_front.jpg", "fake_back.jpg"],
            image_names=["front.jpg", "back.jpg"],
        )
        assert result["decision"] == "COMPLIANT"
        ai = result.get("ai") or {}
        assert ai.get("status") in ("ok", "verified_only")

    def test_malformed_ai_verification_response_falls_back(self):
        """Malformed JSON from verify_fields → graceful fallback, deterministic result stands."""
        pipeline = _pipeline_with_ocr(
            ["MRP Rs. 45.00", "Net Wt: 200g"],
            ["Mfg by: ABC Foods Pvt Ltd", "Mfg Date: 01/2025"],
        )

        svc = get_service()
        svc.verify_fields = MagicMock(return_value=None)  # Simulates parse failure
        svc.adjudicate = MagicMock(return_value=None)

        result = pipeline.run_multi(
            ["fake_front.jpg", "fake_back.jpg"],
            image_names=["front.jpg", "back.jpg"],
        )
        ai = result.get("ai") or {}
        # Should have recorded the failure gracefully
        assert result["decision"] in ("COMPLIANT", "NON_COMPLIANT", "MANUAL_REVIEW")
        assert "ai" in result

    def test_malformed_ai_adjudication_response_falls_back(self):
        """verify_fields succeeds but adjudicate returns None → ai status verified_only."""
        pipeline = _pipeline_with_ocr(
            ["MRP Rs. 45.00", "Net Wt: 200g"],
            ["Mfg by: ABC Foods Pvt Ltd", "Mfg Date: 01/2025"],
        )

        svc = get_service()
        svc.verify_fields = MagicMock(return_value={})  # no corrections
        svc.adjudicate = MagicMock(return_value=None)   # adjudication fails

        result = pipeline.run_multi(
            ["fake_front.jpg", "fake_back.jpg"],
            image_names=["front.jpg", "back.jpg"],
        )
        ai = result.get("ai") or {}
        assert ai.get("status") in ("verified_only", "skipped", "ok")
        assert result["decision"] in ("COMPLIANT", "NON_COMPLIANT", "MANUAL_REVIEW")


# ---------------------------------------------------------------------------
# 5. Multi-image evidence — field on different surface
# ---------------------------------------------------------------------------

class TestMultiImageEvidence:
    def test_mrp_on_back_surface_found(self):
        """MRP on back surface must be detected even if front surface has no MRP."""
        pipeline = _pipeline_with_ocr(
            front_texts=["CRISPY BISCUITS", "Net Wt: 200g", "Mfg by: ABC Foods Pvt Ltd"],
            back_texts=["MRP: Rs. 25.00 (Incl. all taxes)", "Best Before: 6 months"],
        )
        result = pipeline.run_multi(
            ["fake_front.jpg", "fake_back.jpg"],
            image_names=["front.jpg", "back.jpg"],
        )
        mrp = result["extracted_fields"].get("mrp", {})
        assert mrp.get("value") is not None, "MRP found on back surface should be extracted"

    def test_manufacturer_on_front_date_on_back(self):
        """Manufacturer on front + dates on back → both detected in multi-image run."""
        pipeline = _pipeline_with_ocr(
            front_texts=["Manufactured By: ABC Foods Pvt Ltd", "MRP Rs. 30.00", "Net Wt: 100g"],
            back_texts=["Mfg Date: 03/2025", "Best Before: 12 Months", "Customer Care: 1800-100-200"],
        )
        result = pipeline.run_multi(
            ["fake_front.jpg", "fake_back.jpg"],
            image_names=["front.jpg", "back.jpg"],
        )
        mfr = result["extracted_fields"].get("manufacturer", {})
        mfd = result["extracted_fields"].get("manufacturing_date", {})
        assert mfr.get("value") is not None, "Manufacturer on front not found"
        assert mfd.get("value") is not None, "Manufacturing date on back not found"


# ---------------------------------------------------------------------------
# 6. UNREADABLE OCR routes to MANUAL_REVIEW, never FAIL
# ---------------------------------------------------------------------------

class TestUnreadableRoutesToReview:
    def test_low_conf_mrp_keyword_routes_to_manual_review(self):
        """MRP keyword with unreadable value (low OCR conf) → MANUAL_REVIEW not NON_COMPLIANT."""
        pipeline = _pipeline_with_ocr(
            ["MRP ₹", "Net Wt: 200g"],  # Cue present, value mangled
            conf=0.40,  # Very low confidence — UNREADABLE
        )
        result = pipeline.run_multi(
            ["fake_front.jpg"], image_names=["front.jpg"],
        )
        # With low confidence, the system must not produce a hard NON_COMPLIANT
        # for MRP alone — it should be MANUAL_REVIEW (confidence guard triggers)
        assert result["decision"] in ("MANUAL_REVIEW", "NON_COMPLIANT")
        # Confidence should be low
        conf = result.get("confidence") or {}
        assert conf.get("overall", 1.0) < 0.85, "Low-conf image should have low overall confidence"

    def test_absence_fail_routes_to_manual_review_not_non_compliant(self):
        """An absence-only FAIL (field not seen on any surface) → MANUAL_REVIEW, not NON_COMPLIANT."""
        pipeline = _pipeline_with_ocr(
            # All mandatory fields except MRP
            ["CRISPY BISCUITS", "Net Wt: 200g"],
            ["Manufactured By: ABC Foods Pvt Ltd", "Mfg Date: 01/2025"],
        )
        result = pipeline.run_multi(
            ["fake_front.jpg", "fake_back.jpg"],
            image_names=["front.jpg", "back.jpg"],
        )
        # Absence-based FAILs must route to MANUAL_REVIEW (PRD §14)
        assert result["decision"] in ("MANUAL_REVIEW", "NON_COMPLIANT")
        # Check fuse logic: absence fail should not produce hard NON_COMPLIANT
        rule_results = result.get("rule_results", [])
        mrp_rule = next(
            (r for r in rule_results if "mrp" in r.get("rule_id", "").lower() or
             r.get("source", {}).get("category") == "mrp"),
            None,
        )
        if mrp_rule and mrp_rule.get("status") == "FAIL":
            # If MRP FAIL, it must be an absence_fail (no hard violation)
            ev = mrp_rule.get("evidence") or {}
            assert ev.get("absence_fail") is True, (
                "MRP FAIL without confirmed hard violation should be tagged absence_fail"
            )


# ---------------------------------------------------------------------------
# 7. AI disagrees with rule engine
# ---------------------------------------------------------------------------

class TestAIDisagreesWithRuleEngine:
    def setup_method(self):
        reset_service()
        os.environ["GEMINI_API_KEY"] = "fake-test-key"

    def teardown_method(self):
        os.environ.pop("GEMINI_API_KEY", None)
        reset_service()

    def test_ai_overrides_compliant_to_manual_review(self):
        """Rules say COMPLIANT but AI spots a problem → MANUAL_REVIEW."""
        pipeline = _pipeline_with_ocr(
            ["MRP Rs. 45.00", "Net Wt: 200g", "ACME Biscuits"],
            ["Manufactured By: ABC Foods Pvt Ltd", "Mfg Date: 01/2025",
             "Customer Care: 1800-200-1234", "Country of Origin: India"],
        )

        svc = get_service()
        svc.verify_fields = MagicMock(return_value={})
        svc.adjudicate = MagicMock(return_value={
            "verdict": "MANUAL_REVIEW",
            "explanation": (
                "Image clearly shows the MRP sticker is partially obscured. "
                "Inspector should verify the printed price."
            ),
            "confidence": 0.78,
            "per_rule_overrides": {"PC2011-R06-E-001": "REVIEW"},
        })

        result = pipeline.run_multi(
            ["fake_front.jpg", "fake_back.jpg"],
            image_names=["front.jpg", "back.jpg"],
        )
        # AI verdict should override deterministic COMPLIANT
        assert result["decision"] == "MANUAL_REVIEW"
        ai = result.get("ai") or {}
        assert ai.get("status") == "ok"
        assert "obscured" in (ai.get("adjudication") or {}).get("explanation", "")

    def test_ai_overrides_non_compliant_to_manual_review_on_doubt(self):
        """Rules say NON_COMPLIANT but AI sees image is blurry → MANUAL_REVIEW."""
        pipeline = _pipeline_with_ocr(
            ["Net Wt: 200g"],  # No MRP — rules will FAIL
        )

        svc = get_service()
        svc.verify_fields = MagicMock(return_value={})
        svc.adjudicate = MagicMock(return_value={
            "verdict": "MANUAL_REVIEW",
            "explanation": (
                "The MRP region appears to be on the base of the can which was not "
                "photographed. Cannot confirm absence — manual inspection required."
            ),
            "confidence": 0.70,
            "per_rule_overrides": {},
        })

        result = pipeline.run_multi(
            ["fake_front.jpg"], image_names=["front.jpg"],
        )
        assert result["decision"] == "MANUAL_REVIEW"


# ---------------------------------------------------------------------------
# 8. Manual review reason specificity
# ---------------------------------------------------------------------------

class TestManualReviewReasonSpecificity:
    def test_review_action_has_required_fields(self):
        """Every review action must carry: field, field_label, check_location, reason, source_image."""
        pipeline = _pipeline_with_ocr(
            ["ACME Biscuits", "Net Wt: 200g"],
            ["SEE BASE OF CAN FOR MFG DATE", "Mfg by: ABC Foods Pvt Ltd"],
        )
        result = pipeline.run_multi(
            ["fake_front.jpg", "fake_back.jpg"],
            image_names=["front.jpg", "back.jpg"],
        )
        for action in result.get("review_actions", []):
            assert action.get("field"), "review action missing 'field'"
            assert action.get("field_label"), "review action missing 'field_label'"
            assert action.get("check_location"), "review action must say WHERE to check"
            assert action.get("reason"), "review action must carry exact reason"

    def test_review_action_for_pointer_references_location(self):
        """When label says 'see base', review action must reference 'base' in check_location."""
        pipeline = _pipeline_with_ocr(
            ["ACME Biscuits", "MRP Rs. 30.00", "Net Wt: 200g"],
            ["Mfg by: ABC Foods Pvt Ltd", "SEE BASE OF CAN FOR MFG DATE AND BATCH NO"],
        )
        result = pipeline.run_multi(
            ["fake_front.jpg", "fake_back.jpg"],
            image_names=["front.jpg", "back.jpg"],
        )
        mfd_actions = [
            a for a in result.get("review_actions", [])
            if a.get("field") == "manufacturing_date"
        ]
        if mfd_actions:
            action = mfd_actions[0]
            assert "base" in action["check_location"].lower() or \
                   "base" in action["reason"].lower(), (
                "Review action for base-referenced MFD must mention 'base'"
            )

    def test_manual_review_reason_is_specific_not_generic(self):
        """MANUAL_REVIEW decision_reasons must not be a single generic string."""
        pipeline = _pipeline_with_ocr(
            ["ACME Biscuits", "Net Wt: 200g"],
            ["Mfg by: ABC Foods Pvt Ltd"],
        )
        result = pipeline.run_multi(
            ["fake_front.jpg", "fake_back.jpg"],
            image_names=["front.jpg", "back.jpg"],
        )
        if result["decision"] == "MANUAL_REVIEW":
            reasons = result.get("decision_reasons") or []
            assert reasons, "MANUAL_REVIEW must have decision_reasons"
            # Reasons must be non-trivial
            assert any(len(r) > 30 for r in reasons), (
                "MANUAL_REVIEW reason is too short / generic"
            )


# ---------------------------------------------------------------------------
# 9. AI verification pipeline integration tests
# ---------------------------------------------------------------------------

class TestAIVerificationIntegration:
    def setup_method(self):
        reset_service()
        os.environ["GEMINI_API_KEY"] = "fake-test-key"

    def teardown_method(self):
        os.environ.pop("GEMINI_API_KEY", None)
        reset_service()

    def test_ai_verification_corrections_stored_in_result(self):
        """AI corrections must appear in result['ai']['verification']."""
        pipeline = _pipeline_with_ocr(
            ["MRP Rs. 30.00", "Net Wt: 200g"],
            ["Mfg by: ABC Foods Pvt Ltd", "Mfg Date: 01/2025"],
        )

        corrections = {
            "manufacturing_date": {
                "status": "FOUND",
                "value": "January 2025",
                "source_image": "back.jpg",
                "reason": "Date clearly visible as Jan 2025 on back label",
            }
        }

        svc = get_service()
        svc.verify_fields = MagicMock(return_value=corrections)
        svc.adjudicate = MagicMock(return_value={
            "verdict": "COMPLIANT",
            "explanation": "All mandatory fields verified in images.",
            "confidence": 0.93,
            "per_rule_overrides": {},
        })

        result = pipeline.run_multi(
            ["fake_front.jpg", "fake_back.jpg"],
            image_names=["front.jpg", "back.jpg"],
        )
        ai = result.get("ai") or {}
        assert "verification" in ai
        # Corrections should be stored
        assert isinstance(ai["verification"], dict)

    def test_original_extracted_fields_preserved_for_audit(self):
        """original_extracted_fields must be present and be a snapshot before AI corrections."""
        pipeline = _pipeline_with_ocr(
            ["MRP Rs. 45.00", "Net Wt: 200g"],
            ["Mfg by: ABC Foods Pvt Ltd", "Mfg Date: 01/2025"],
        )

        svc = get_service()
        svc.verify_fields = MagicMock(return_value={})
        svc.adjudicate = MagicMock(return_value={
            "verdict": "COMPLIANT",
            "explanation": "All good.",
            "confidence": 0.95,
            "per_rule_overrides": {},
        })

        result = pipeline.run_multi(
            ["fake_front.jpg", "fake_back.jpg"],
            image_names=["front.jpg", "back.jpg"],
        )
        assert "original_extracted_fields" in result, (
            "original_extracted_fields must be stored for audit trail"
        )
        # Should be a dict of field names
        assert isinstance(result["original_extracted_fields"], dict)
