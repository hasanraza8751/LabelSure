from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class QualityResponse(BaseModel):
    usable: bool
    score: float
    checks: Dict[str, Any]


class OCRResponse(BaseModel):
    avg_confidence: float
    num_lines: int
    texts: List[str]
    confidences: List[float]
    bounding_boxes: List[Any]


class EvaluateRulesRequest(BaseModel):
    extracted_fields: Dict[str, Any]
    image_quality: Optional[Dict[str, Any]] = None
    ocr_avg_confidence: Optional[float] = None


class ReviewAction(BaseModel):
    field: str
    field_label: str
    rule_id: str
    rule_reference: str
    status: str
    severity: str
    reason: str
    check_location: str
    source_image: Optional[str] = None
    confidence: float
    current_value: Optional[Any] = None


class InspectionResponse(BaseModel):
    """FROZEN response schema `labelguard-inspection/1.0`.

    Enforced by tests/test_schema_freeze.py - any change here requires a
    schema version bump.
    """

    inspection_id: str
    response_schema: str
    timestamp: str
    product_name: Optional[str] = None
    ruleset: Dict[str, Any]
    images: List[Dict[str, Any]]
    coverage: Dict[str, Any]
    extracted_fields: Dict[str, Any]
    reference_pointers: List[Dict[str, Any]]
    unclaimed_evidence: List[Dict[str, Any]]
    evidence_pool_size: int
    cylindrical_package: bool
    rule_results: List[Dict[str, Any]]
    compliance_decision: Optional[Dict[str, Any]] = None
    confidence: Optional[Dict[str, Any]] = None
    decision: Optional[str] = None
    decision_reasons: Optional[List[str]] = None
    decision_downgraded_from: Optional[str] = None
    decision_emoji: Optional[str] = None
    review_actions: List[ReviewAction] = []
    processing_time_sec: Optional[float] = None
