"""Inspection history storage (SQLAlchemy).

Dev default: SQLite file (`inspections.db`). Production: set DATABASE_URL
to a PostgreSQL DSN (e.g. postgresql://user:pass@host/legal_metrology).

Storage is best-effort: an inspection never fails because the DB is down.
"""

import json
import os
from typing import Dict, Any, List, Optional

from sqlalchemy import (
    create_engine,
    Column,
    String,
    Float,
    Integer,
    Text,
    Boolean,
    desc,
)
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "sqlite:///inspections.db"
)

# Module-level engine (import-time); fallback to sqlite if the configured
# DSN is unreachable at first use is handled by callers being best-effort.
is_sqlite = DATABASE_URL.startswith("sqlite")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if is_sqlite else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

Base = declarative_base()


class InspectionRow(Base):
    __tablename__ = "inspections"

    inspection_id = Column(String, primary_key=True)
    response_schema = Column(String)
    timestamp = Column(String)
    product_name = Column(String)
    decision = Column(String, index=True)
    decision_emoji = Column(String)
    confidence = Column(Float)
    surfaces_total = Column(Integer)
    surfaces_usable = Column(Integer)
    cylindrical_package = Column(Boolean)
    ruleset_id = Column(String)
    ruleset_version = Column(String)
    ruleset_verified = Column(Boolean)
    num_rules_pass = Column(Integer)
    num_rules_fail = Column(Integer)
    num_rules_review = Column(Integer)
    num_review_actions = Column(Integer)
    result_json = Column(Text)  # full frozen response payload


def init_db() -> None:
    Base.metadata.create_all(engine)


def save_inspection(result: Dict[str, Any]) -> Optional[str]:
    """Persist an inspection result (best-effort). Returns the id or None."""
    try:
        init_db()
        counts = {"PASS": 0, "FAIL": 0, "MANUAL_REVIEW": 0}
        for r in result.get("rule_results", []):
            if r.get("status") in counts:
                counts[r["status"]] += 1
        coverage = result.get("coverage", {}) or {}
        ruleset = result.get("ruleset", {}) or {}
        conf = result.get("confidence", {}) or {}
        row = InspectionRow(
            inspection_id=result.get("inspection_id"),
            response_schema=result.get("response_schema"),
            timestamp=result.get("timestamp"),
            product_name=result.get("product_name"),
            decision=result.get("decision"),
            decision_emoji=result.get("decision_emoji"),
            confidence=float(conf.get("overall", 0.0)),
            surfaces_total=int(coverage.get("surfaces_total", 0) or 0),
            surfaces_usable=int(coverage.get("surfaces_usable", 0) or 0),
            cylindrical_package=bool(result.get("cylindrical_package", False)),
            ruleset_id=str(ruleset.get("id", "")),
            ruleset_version=str(ruleset.get("version", "")),
            ruleset_verified=bool(ruleset.get("verified", False)),
            num_rules_pass=counts["PASS"],
            num_rules_fail=counts["FAIL"],
            num_rules_review=counts["MANUAL_REVIEW"],
            num_review_actions=len(result.get("review_actions", []) or []),
            result_json=json.dumps(result),
        )
        with SessionLocal() as session:
            session.merge(row)
            session.commit()
        return row.inspection_id
    except Exception:
        return None


def list_inspections(limit: int = 50) -> List[Dict[str, Any]]:
    """Recent inspection summaries (no full payload)."""
    try:
        init_db()
        with SessionLocal() as session:
            rows = (
                session.query(InspectionRow)
                .order_by(desc(InspectionRow.timestamp))
                .limit(limit)
                .all()
            )
            return [
                {
                    "inspection_id": r.inspection_id,
                    "timestamp": r.timestamp,
                    "product_name": r.product_name,
                    "decision": r.decision,
                    "decision_emoji": r.decision_emoji,
                    "confidence": r.confidence,
                    "surfaces_total": r.surfaces_total,
                    "surfaces_usable": r.surfaces_usable,
                    "ruleset_id": r.ruleset_id,
                    "ruleset_verified": r.ruleset_verified,
                    "num_rules_pass": r.num_rules_pass,
                    "num_rules_fail": r.num_rules_fail,
                    "num_rules_review": r.num_rules_review,
                    "num_review_actions": r.num_review_actions,
                }
                for r in rows
            ]
    except Exception:
        return []


def get_inspection(inspection_id: str) -> Optional[Dict[str, Any]]:
    """Full stored response payload for one inspection."""
    try:
        init_db()
        with SessionLocal() as session:
            row = session.get(InspectionRow, inspection_id)
            if row is None:
                return None
            return json.loads(row.result_json)
    except Exception:
        return None
