"""Gemini vision adjudication (two-stage AI) - stdlib REST, no new SDK.

Wire shape:

    extract fields              AI VISUAL VERIFICATION            adjudicate
    -------------              -------------------------          --------------------
    {"name": {value...}}  --->  corrected structured evidence  ->  FINAL VERDICT
                                  {"name": {value, status, ...}}
                                  RULE ENGINE re-runs first

Two separate calls by design: verification returns JSON fields the
deterministic engine can re-evaluate; adjudication then weighs the original
deterministic results, the corrected evidence and the pictures themselves.
Unconfigured, timed-out, or malformed - the deterministic result stands and
the skipped/error state is recorded, never silently fixed (PRD §33).
"""

from __future__ import annotations

import base64
import json
import os
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

STATUSES = ("FOUND", "FOUND_LOW_CONFIDENCE", "NOT_FOUND", "UNREADABLE", "AMBIGUOUS")

FIELD_STATUS_NUDGE = {
    "FOUND": "present - take the reading",
    "FOUND_LOW_CONFIDENCE": "possible value - flagged for human confirmation",
    "NOT_FOUND": "the information is genuinely absent",
    "UNREADABLE": "something is there but no OCR can read it",
    "AMBIGUOUS": "several possible readings were observed",
}

_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


def _get_api_key() -> Optional[str]:
    return (os.environ.get("GEMINI_API_KEY") or "").strip() or None


def _model_name() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-flash-latest").strip()


def _encode_image(path: str, max_dim: int = 768) -> Tuple[str, bytes]:
    """Resize one image to keep the request under the inline-image limit."""
    try:
        with Image.open(path) as img:
            img = img.convert("RGB")
            w, h = img.size
            m = max(w, h)
            if m > max_dim:
                scale = max_dim / float(m)
                img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return "image/jpeg", buf.getvalue()
    except Exception:
        return "image/jpeg", b""


VERIFY_PROMPT = """You are verifying OCR field extraction against the ORIGINAL package images
for a Legal Metrology (Packaged Commodities) Rules, 2011 screening.

Reply with ONLY a JSON object, no code fence, no prose:
{
  "fields": {
    "<field_name>": {
      "status": "FOUND | FOUND_LOW_CONFIDENCE | NOT_FOUND | UNREADABLE | AMBIGUOUS",
      "value": "<visible text, or null>",
      "source_image": "<image name>",
      "reason": "<short explanation>"
    }
  },
  "notes": "<anything you corrected, e.g. 'Batch No 350 was misread as MRP'>"
}

Rules:
- Field statuses must come from this exact list. Never invent a value for a
  status that is not FOUND or FOUND_LOW_CONFIDENCE.
- A batch number, phone number or nutrition number is never evidence for the
  MRP; the MRP must sit with a price cue (MRP / Rs / ₹ / price).
- If a field reads better on another image, pick that image.
- If OCR got a value but the picture clearly disagrees, call it NOT_FOUND or
  UNREADABLE and explain.
- Field names you may address: mrp, net_quantity, product_name, manufacturer,
  packer, importer, manufacturing_date, packing_date, best_before,
  consumer_care, country_of_origin, batch_number.
"""

ADJUDICATE_PROMPT = """You are the final adjudicator for a Legal Metrology (Packaged
Commodities) Rules, 2011 screening. You see every captured package image,
the OCR evidence, the extracted fields, and the deterministic rule results
with what each rule was waiting on.

Reply with ONLY a JSON object, no code fence, no prose:
{
  "verdict": "COMPLIANT | NON_COMPLIANT | MANUAL_REVIEW",
  "explanation": "<short paragraph reconciling the evidence>",
  "confidence": 0.0,
  "per_rule_overrides": {
    "<rule_id>": "PASS | FAIL | REVIEW"
  }
}

Rules:
- NON_COMPLIANT only when a mandatory declaration is demonstrably wrong or a
  clear violation is visible in the images. If the imaging/OCR leaves doubt,
  route to MANUAL_REVIEW and say exactly which image/region a human picks up.
- Never invent evidence and never fabricate a clause.
"""


class GeminiService:
    """Stateful wrapper so the API can describe why it fell back."""

    def __init__(self) -> None:
        self.last_error: Optional[str] = None

    @property
    def available(self) -> bool:
        return _get_api_key() is not None

    # ------------------------------------------------------------------ REST

    def _call(self, prompt: str, image_paths: Optional[List[str]] = None) -> Optional[str]:
        key = _get_api_key()
        if not key:
            self.last_error = "GEMINI_API_KEY not set"
            return None
        endpoint = ENDPOINT.format(model=_model_name(), key=key)

        parts: List[Dict[str, Any]] = [{"text": prompt}]
        for path in image_paths or []:
            mime, data = _encode_image(path)
            if not data:
                continue
            parts.append(
                {
                    "inline_data": {
                        "mime_type": mime,
                        "data": base64.b64encode(data).decode("ascii"),
                    }
                }
            )

        body = json.dumps({"contents": [{"parts": parts}]}).encode("utf-8")
        request = urllib.request.Request(
            endpoint,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"
            return None

        try:
            candidates = payload.get("candidates") or []
            parts_out = candidates[0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts_out if "text" in p).strip()
            if not text:
                self.last_error = "the model returned no text"
                return None
            self.last_error = None
            return text
        except (IndexError, KeyError, TypeError) as exc:
            self.last_error = f"malformed response: {exc}"
            return None

    # -------------------------------------------------------- verification

    @staticmethod
    def _describe_fields(fields: Dict[str, Any]) -> str:
        lines = []
        for name, f in fields.items():
            if not isinstance(f, dict):
                continue
            value = f.get("value")
            status = "present" if value else "absent"
            conf = f.get("extraction_confidence")
            lines.append(
                f"  {name}: {status}"
                + (f" as '{value}'" if value else "")
                + (f" (confidence {conf:.0%})" if isinstance(conf, (int, float)) and conf else "")
            )
        return "\n".join(lines) or "(nothing extracted)"

    @staticmethod
    def _describe_rules(rule_results: List[Dict[str, Any]]) -> str:
        lines = []
        for r in rule_results:
            if not isinstance(r, dict):
                continue
            status = r.get("status")
            reason = (r.get("reason") or "").strip()
            lines.append(f"  {r.get('rule_id')}: {status} - {reason[:120]}")
        return "\n".join(lines) or "(no rule results)"

    def verify_fields(
        self,
        fields: Dict[str, Any],
        rule_results: List[Dict[str, Any]],
        image_paths: List[str],
        image_names: List[str],
        ocr_traces: Dict[str, List[str]],
    ) -> Optional[Dict[str, Dict[str, Any]]]:
        """First AI pass: corrected structured field evidence.

        Returns a dict keyed by field name with entries
        {status, value, source_image, reason}. Only fields the model had an
        opinion on are returned; everything else is left untouched.
        """
        prompt = (
            f"{VERIFY_PROMPT}\n\n"
            f"Images (verbatim order): {', '.join(image_names)}\n\n"
            "Deterministic extraction (raw):\n"
            + self._describe_fields(fields)
            + "\n\nDeterministic rule results (raw):\n"
            + self._describe_rules(rule_results)
            + "\n\nOCR text per image:\n"
            + "\n".join(
                f"  {name}: {texts}" for name, texts in ocr_traces.items()
            )
        )
        text = self._call(prompt, image_paths)
        if text is None:
            return None
        parsed = _parse_json(text)
        if parsed is None or not isinstance(parsed.get("fields"), dict):
            if parsed is None:
                self.last_error = "malformed JSON in verification response"
            return None
        cleaned: Dict[str, Dict[str, Any]] = {}
        for name, entry in parsed["fields"].items():
            if not isinstance(entry, dict):
                continue
            status = entry.get("status")
            if status not in STATUSES:
                continue
            value = entry.get("value")
            allowed = status in ("FOUND", "FOUND_LOW_CONFIDENCE")
            cleaned[name] = {
                "status": status,
                "value": str(value).strip() if allowed and value is not None else None,
                "source_image": entry.get("source_image"),
                "reason": (entry.get("reason") or "").strip(),
            }
        return cleaned

    # ------------------------------------------------------- adjudication

    def adjudicate(
        self,
        corrected_fields: Dict[str, Dict[str, Any]],
        rule_results: List[Dict[str, Any]],
        review_actions: List[Dict[str, Any]],
        image_paths: List[str],
        image_names: List[str],
    ) -> Optional[Dict[str, Any]]:
        """Second AI pass: reconcile evidence and pick the final verdict."""
        corrected_desc = "\n".join(
            f"  {name}: {entry['status']}"
            + (f" => '{entry['value']}'" if entry.get("value") else "")
            + (f" on {entry.get('source_image')}" if entry.get("source_image") else "")
            + (f" ({entry['reason']})" if entry.get("reason") else "")
            for name, entry in corrected_fields.items()
        ) or "(AI verification produced no overrides)"
        review_desc = "\n".join(
            f"  {a.get('field_label')}: {a.get('check_location')} ({a.get('reason', '')[:100]})"
            for a in review_actions
        ) or "(nothing outstanding to check)"
        prompt = (
            f"{ADJUDICATE_PROMPT}\n\n"
            f"Images (verbatim order): {', '.join(image_names)}\n\n"
            f"Deterministic rule results (post-correction):\n{self._describe_rules(rule_results)}\n\n"
            f"AI-verified field evidence:\n{corrected_desc}\n\n"
            f"Outstanding manual-review notes (from the deterministic pass):\n{review_desc}"
        )
        text = self._call(prompt, image_paths)
        if text is None:
            return None
        parsed = _parse_json(text)
        if parsed is None:
            self.last_error = "malformed JSON in adjudication response"
            return None
        verdict = parsed.get("verdict")
        if verdict not in ("COMPLIANT", "NON_COMPLIANT", "MANUAL_REVIEW"):
            self.last_error = f"adjudication returned no verdict: {verdict!r}"
            return None
        result: Dict[str, Any] = {
            "verdict": verdict,
            "explanation": (parsed.get("explanation") or "").strip(),
            "overrides": {},
            "confidence": parsed.get("confidence"),
        }
        overrides = parsed.get("per_rule_overrides")
        if isinstance(overrides, dict):
            result["overrides"] = {
                k: v for k, v in overrides.items() if isinstance(v, str)
            }
        return result


def _parse_json(text: str) -> Optional[Dict[str, Any]]:
    """Find the first JSON object in a model reply."""
    match = _JSON_BLOCK_RE.search(text.strip())
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except (ValueError, TypeError):
        return None


_service: Optional[GeminiService] = None
_singleton_lock = None


def get_service() -> GeminiService:
    global _service
    if _service is None:
        _service = GeminiService()
    return _service


def reset_service() -> None:
    """Test helper: drop the singleton (e.g. after clearing the env var)."""
    global _service
    _service = None
