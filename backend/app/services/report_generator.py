import os
from typing import Dict, Any, List, Optional

STATUS_ICONS = {
    "PASS": "✅ PASS",
    "FAIL": "❌ FAIL",
    "MANUAL_REVIEW": "🟡 MANUAL REVIEW",
    "NOT_APPLICABLE": "⚪ NOT APPLICABLE",
    "UNVERIFIED": "❓ UNVERIFIED",
}

RULE_STATUS_ICONS = {
    "PASS": "✅",
    "FAIL": "❌",
    "MANUAL_REVIEW": "🟡",
    "NOT_APPLICABLE": "⚪",
    "UNVERIFIED": "❓",
}

FIELD_LABELS = {
    "mrp": "MRP",
    "product_name": "Product Name",
    "net_quantity": "Net Quantity",
    "manufacturer": "Manufacturer",
    "packer": "Packer",
    "importer": "Importer",
    "manufacturing_date": "Manufacturing Date",
    "packing_date": "Packing Date",
    "best_before": "Best Before",
    "batch_number": "Batch Number",
    "consumer_care": "Consumer Care",
    "country_of_origin": "Country of Origin",
}


class ReportGenerator:
    """Render a multi-image inspection result as a human-readable markdown
    report. Every finding carries its rule, reason and evidence trail."""

    def __init__(self, output_dir: str = "reports/inspections"):
        self.output_dir = output_dir

    # ------------------------------------------------------------------

    def generate(self, result: Dict[str, Any]) -> str:
        lines: List[str] = []
        lines.append("# Compliance Inspection Report")
        lines.append("")
        lines.append(
            f"**Inspection ID:** `{result.get('inspection_id', 'n/a')}`  "
        )
        lines.append(f"**Date:** {result.get('timestamp', 'n/a')}  ")
        product = result.get("product_name") or "Unknown"
        lines.append(f"**Product:** {product}  ")
        ruleset = result.get("ruleset", {})
        lines.append(f"**Ruleset:** {ruleset.get('id', '?')} v{ruleset.get('version', '?')}")
        if not ruleset.get("verified", False):
            lines.append("")
            lines.append(
                "> ⚠️ **DRAFT RULESET** — rule definitions are pending verification "
                "against the official Legal Metrology documents. Do not use this "
                "report for enforcement decisions."
            )
        lines.append("")

        # Overall result
        lines.append("## Overall Result")
        lines.append("")
        decision = result.get("decision", "MANUAL_REVIEW")
        emoji = result.get("decision_emoji", "🟡")
        conf = result.get("confidence")
        conf_str = f"{conf['overall']:.0%}" if conf else "n/a"
        lines.append(f"### {emoji} {decision.replace('_', ' ')}")
        lines.append(f"**Confidence:** {conf_str}")
        coverage = result.get("coverage", {})
        lines.append(
            f"**Coverage:** {coverage.get('surfaces_usable', '?')}/"
            f"{coverage.get('surfaces_total', '?')} captured surfaces readable"
        )
        if result.get("decision_downgraded_from"):
            lines.append(
                f"**Note:** downgraded from {result['decision_downgraded_from']} "
                "by the confidence guard (evidence below review threshold)."
            )
        lines.append("")
        reasons = result.get("decision_reasons") or []
        if reasons:
            lines.append("**Reasons:**")
            lines.append("")
            for reason in reasons:
                lines.append(f"- {reason}")
            lines.append("")

        # Extracted information
        lines.append("## Extracted Information")
        lines.append("")
        lines.append("| Field | Value | Confidence | Level | Found on |")
        lines.append("|---|---|---|---|---|")
        fields = result.get("extracted_fields", {})
        for name, f in fields.items():
            label = FIELD_LABELS.get(name, name)
            value = f.get("value")
            value_str = str(value) if value is not None else "— not found —"
            level = f.get("confidence_level", "MISSING")
            conf_val = f.get("extraction_confidence", 0.0)
            conf_cell = f"{conf_val:.0%}" if value is not None else "—"
            source = f.get("source_image") or "—"
            lines.append(
                f"| {label} | {value_str} | {conf_cell} | {level} | {source} |"
            )
        lines.append("")

        # Compliance findings
        lines.append("## Compliance Findings")
        lines.append("")
        rule_results = result.get("rule_results", [])
        for r in rule_results:
            icon = RULE_STATUS_ICONS.get(r.get("status", ""), "?")
            lines.append(f"### {icon} {r.get('rule_id', '?')} — {r.get('status', '?')}")
            lines.append("")
            lines.append(f"**Requirement:** {r.get('requirement', '')}  ")
            lines.append(f"**Severity:** {r.get('severity', '')}  ")
            reason = r.get("reason", "")
            lines.append(f"**Reason:** {reason}")
            source = r.get("source", {})
            if source:
                src_str = source.get("document", "?")
                if source.get("rule"):
                    src_str += f", {source['rule']}"
                if source.get("page"):
                    src_str += f" (p.{source['page']})"
                if source.get("status"):
                    src_str += f" [{source['status']}]"
                lines.append(f"**Source:** {src_str}  ")
                if source.get("evidence_text"):
                    quote = str(source["evidence_text"]).strip()
                    if len(quote) > 160:
                        quote = quote[:157] + "..."
                    lines.append(f"> *\"{quote}\"*")
                    lines.append("")
            evidence = r.get("evidence", {})
            ev_parts: List[str] = []
            if isinstance(evidence, dict) and evidence.get("detected"):
                ev_parts.append(f"value `{evidence.get('value')}`")
                if evidence.get("ocr_text"):
                    ev_parts.append(f"OCR text: \"{evidence.get('ocr_text')}\"")
                ev_parts.append(
                    f"OCR conf {evidence.get('ocr_confidence', 0):.2f}, "
                    f"extraction conf {evidence.get('extraction_confidence', 0):.2f}"
                )
                if evidence.get("bbox"):
                    ev_parts.append("bounding box captured")
            elif isinstance(evidence, dict) and evidence.get("detected") is False:
                ev_parts.append("not detected on any captured surface")
                rp = evidence.get("reference_pointer")
                if rp:
                    ev_parts.append(
                        f"label pointer: \"{str(rp.get('text', ''))[:60]}\" "
                        f"(see {rp.get('location', '?')} of package)"
                    )
            elif isinstance(evidence, dict) and evidence:
                for k, v in evidence.items():
                    if isinstance(v, dict) and v.get("detected"):
                        ev_parts.append(f"{k}: `{v.get('value')}`")
            if ev_parts:
                lines.append(f"**Evidence:** {'; '.join(ev_parts)}")
            lines.append("")

        # Targeted review actions - tell the reviewer exactly where to look
        actions = result.get("review_actions") or []
        if actions:
            lines.append("## Targeted Review Actions")
            lines.append("")
            lines.append(
                f"{len(actions)} unresolved item(s) - each points to the exact "
                "surface to check. Verified (PASS) fields are not repeated here."
            )
            lines.append("")
            for a in actions:
                lines.append(f"### ⚠️ {a.get('field_label', a.get('field'))}")
                lines.append("")
                conf = a.get("confidence")
                conf_str = f"{conf:.0%}" if isinstance(conf, (int, float)) else "n/a"
                lines.append(f"**Check:** {a.get('check_location', '—')}  ")
                if a.get("source_image"):
                    lines.append(f"**Surface:** {a['source_image']}  ")
                lines.append(f"**Reason:** {a.get('reason', '—')}  ")
                if a.get("current_value"):
                    lines.append(f"**Detected value:** `{a['current_value']}` (confidence {conf_str})  ")
                else:
                    lines.append(f"**Evidence confidence:** {conf_str}  ")
                if a.get("rule_reference"):
                    lines.append(f"**Rule:** {a['rule_reference']}  ")
                lines.append("")

        # Reference pointers ("see base of can" etc.)
        pointers = result.get("reference_pointers") or []
        if pointers:
            lines.append("## Reference Pointers on Label")
            lines.append("")
            lines.append(
                "The label states that some mandatory information is located on "
                "another part of the package. Fields depending on those locations "
                "are routed to manual review unless the referenced surface was "
                "captured and readable."
            )
            lines.append("")
            lines.append("| Pointer text | Points to | Field hints | Surface |")
            lines.append("|---|---|---|---|")
            for p in pointers:
                fields_str = ", ".join(p.get("fields") or []) or "—"
                lines.append(
                    f"| \"{p.get('text', '')[:80]}\" | {p.get('location', '?')} "
                    f"| {fields_str} | {p.get('image', '?')} |"
                )
            lines.append("")

        # Unclaimed evidence - nothing detected by OCR is discarded
        unclaimed = result.get("unclaimed_evidence") or []
        if unclaimed:
            lines.append("## Unclaimed Evidence (Manual Review)")
            lines.append("")
            lines.append(
                f"OCR detected {len(unclaimed)} value(s) that could not be "
                "confidently associated with a mandatory field. They are retained "
                "here so no captured information is wasted."
            )
            lines.append("")
            lines.append("| Type | Value | OCR text | Surface | OCR conf | Note |")
            lines.append("|---|---|---|---|---|---|")
            for c in unclaimed[:30]:
                note = c.get("hint") or ""
                if c.get("in_base_region"):
                    note = (note + " — in base region").strip(" —")
                if not c.get("surface_usable", True):
                    note = (note + " — surface unreadable (hint only)").strip(" —")
                lines.append(
                    f"| {c.get('kind', '?')} | `{c.get('value', '')}` "
                    f"| \"{str(c.get('text', ''))[:40]}\" | {c.get('image', '?')} "
                    f"| {c.get('confidence', 0):.2f} | {note} |"
                )
            lines.append("")

        # Image quality
        lines.append("## Image Quality")
        lines.append("")
        lines.append("| Surface | Score | Usable | OCR lines | OCR confidence |")
        lines.append("|---|---|---|---|---|")
        for img in result.get("images", []):
            usable = "yes" if img.get("usable") else "no"
            ocr_conf = img.get("ocr_avg_confidence")
            ocr_conf_str = f"{ocr_conf:.3f}" if ocr_conf is not None else "—"
            lines.append(
                f"| {img.get('name', '?')} | {img.get('quality', {}).get('score', 0):.0f}/100 "
                f"| {usable} | {img.get('num_lines', 0)} | {ocr_conf_str} |"
            )
        lines.append("")

        conf = result.get("confidence")
        if conf:
            lines.append("## Confidence Breakdown")
            lines.append("")
            comps = conf.get("components", {})
            lines.append("| Component | Value |")
            lines.append("|---|---|")
            lines.append(f"| OCR confidence | {comps.get('ocr', 0):.2f} |")
            lines.append(f"| Field extraction | {comps.get('extraction', 0):.2f} |")
            lines.append(f"| Image quality | {comps.get('image_quality', 0):.2f} |")
            lines.append(f"| Rule applicability | {comps.get('rule_applicability', 0):.2f} |")
            lines.append(f"| **Overall** | **{conf.get('overall', 0):.2f}** |")
            lines.append("")

        lines.append("---")
        lines.append(
            f"*Generated by AI Legal Metrology Compliance Scanner — "
            f"processing time {result.get('processing_time_sec', '?')}s*"
        )
        return "\n".join(lines)

    # ------------------------------------------------------------------

    def save(self, result: Dict[str, Any], markdown: Optional[str] = None) -> str:
        os.makedirs(self.output_dir, exist_ok=True)
        md = markdown if markdown is not None else self.generate(result)
        filename = f"{result.get('inspection_id', 'inspection')}.md"
        path = os.path.join(self.output_dir, filename)
        with open(path, "w") as f:
            f.write(md)
        return path
