"""AI Legal Metrology Compliance Scanner — Gradio frontend.

Capture package surfaces via webcam or upload (front / back / sides / top /
bottom — up to 6 per package), run the full inspection pipeline in-process
and display the verdict, findings, extracted fields, markdown report and the
raw JSON response.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import gradio as gr

from backend.app.services.pipeline import InspectionPipeline, MAX_SURFACES
from backend.app.services.report_generator import (
    ReportGenerator,
    FIELD_LABELS,
    RULE_STATUS_ICONS,
)
from backend.app import database

pipeline = InspectionPipeline()
report_gen = ReportGenerator(output_dir="reports/inspections")

VERDICT_COLORS = {
    "COMPLIANT": "#1a7f37",
    "NON_COMPLIANT": "#c62828",
    "MANUAL_REVIEW": "#b26a00",
}

FIELDS_HEADERS = ["Field", "Value", "Level", "Confidence", "Found on"]
FINDINGS_HEADERS = ["", "Rule", "Status", "Severity", "Reason"]
REVIEW_HEADERS = ["⚠️ Field", "Check this surface", "Reason", "Source image", "Confidence"]


# ----------------------------------------------------------------------
# Output builders
# ----------------------------------------------------------------------

def verdict_html(result):
    if not result:
        return ""
    decision = result.get("decision") or "—"
    emoji = result.get("decision_emoji", "🟡")
    conf = result.get("confidence")
    conf_str = f"{conf['overall'] * 100:.0f}%" if conf else "n/a"
    cov = result.get("coverage", {})
    cov_str = (
        f"{cov.get('surfaces_usable', '?')}/{cov.get('surfaces_total', '?')} "
        "surfaces readable"
    )
    color = VERDICT_COLORS.get(decision, "#555555")
    downgraded = ""
    if result.get("decision_downgraded_from"):
        downgraded = (
            f"<div style='color:#777; font-size:0.9em'>downgraded from "
            f"{result['decision_downgraded_from'].replace('_', ' ')} by the "
            "confidence guard</div>"
        )
    return f"""
    <div style="border:2px solid {color}; border-radius:14px; padding:18px 22px;
                text-align:center; background:#fafafa;">
      <div style="font-size:2.2em; line-height:1.2">{emoji}</div>
      <div style="font-size:1.7em; font-weight:800; color:{color};
                  letter-spacing:1px; margin-top:2px;">
        {decision.replace('_', ' ')}
      </div>
      <div style="margin-top:6px; color:#333; font-size:1.05em;">
        Confidence: <b>{conf_str}</b> &nbsp;·&nbsp; {cov_str}
      </div>
      {downgraded}
    </div>
    """


def fields_rows(result):
    rows = []
    for name, f in (result.get("extracted_fields") or {}).items():
        label = FIELD_LABELS.get(name, name)
        value = f.get("value")
        value_str = str(value) if value is not None else "— not found —"
        conf = f.get("extraction_confidence", 0.0)
        conf_str = f"{conf * 100:.0f}%" if value is not None else "—"
        rows.append([
            label,
            value_str,
            f.get("confidence_level", "MISSING"),
            conf_str,
            f.get("source_image") or "—",
        ])
    return rows


def findings_rows(result):
    rows = []
    for r in result.get("rule_results") or []:
        rows.append([
            RULE_STATUS_ICONS.get(r.get("status", ""), "?"),
            r.get("rule_id", "?"),
            r.get("status", "?"),
            r.get("severity", "?"),
            r.get("reason", ""),
        ])
    return rows


def review_rows(result):
    """Targeted manual-review actions: exactly where to check, per field."""
    rows = []
    for a in result.get("review_actions") or []:
        conf = a.get("confidence")
        rows.append([
            f"⚠️ {a.get('field_label', a.get('field'))}",
            a.get("check_location", "—"),
            a.get("reason", ""),
            a.get("source_image") or "—",
            f"{conf:.0%}" if isinstance(conf, (int, float)) else "n/a",
        ])
    return rows


def empty_outputs():
    html = (
        "<div style='border:2px solid #999; border-radius:14px; padding:18px; "
        "text-align:center; color:#666; background:#fafafa;'>"
        "Capture or upload at least one package surface, then run the inspection."
        "</div>"
    )
    return html, [], [], [], None, "", None


# ----------------------------------------------------------------------
# Event handlers
# ----------------------------------------------------------------------

def add_surface(capture_img, surfaces):
    if not capture_img:
        return surfaces, surfaces, "⚠️ Capture or select an image first."
    if len(surfaces) >= MAX_SURFACES:
        return surfaces, surfaces, f"⚠️ Maximum {MAX_SURFACES} surfaces per package."
    surfaces = surfaces + [capture_img]
    return surfaces, surfaces, f"✅ Added surface {len(surfaces)}/{MAX_SURFACES}."


def add_files(files, surfaces):
    if not files:
        return surfaces, surfaces, ""
    paths = [f if isinstance(f, str) else f.name for f in files]
    room = MAX_SURFACES - len(surfaces)
    if room <= 0:
        return surfaces, surfaces, f"⚠️ Maximum {MAX_SURFACES} surfaces per package."
    added = paths[:room]
    surfaces = surfaces + added
    msg = f"✅ Added {len(added)} photo(s) — {len(surfaces)}/{MAX_SURFACES} surfaces."
    if len(paths) > room:
        msg += f" ({len(paths) - room} ignored, max {MAX_SURFACES})"
    return surfaces, surfaces, msg


def clear_package():
    return [], [], "Cleared. Add surfaces for a new package."


def run_inspection(surfaces, product_name):
    if not surfaces:
        html, fields, findings, reviews, jsn, md, path = empty_outputs()
        return (
            "<div style='border:2px solid #c62828; border-radius:14px; "
            "padding:18px; text-align:center; color:#c62828; background:#fff5f5;'>"
            "⚠️ No surfaces added. Capture or upload package photos first.</div>",
            fields,
            findings,
            reviews,
            jsn,
            md,
            path,
            "",
        )
    try:
        result = pipeline.run_multi(
            surfaces, product_name=(product_name or "").strip() or None
        )
    except Exception as e:
        return (
            f"<div style='border:2px solid #c62828; border-radius:14px; "
            f"padding:18px; text-align:center; color:#c62828; background:#fff5f5;'>"
            f"❌ Inspection failed: {e}</div>",
            [],
            [],
            [],
            None,
            "",
            None,
            "",
        )
    md = report_gen.generate(result)
    report_path = report_gen.save(result, md)
    database.save_inspection(result)  # best-effort history
    n_actions = len(result.get("review_actions") or [])
    summary = f"**Inspection ID:** `{result['inspection_id']}` · " \
              f"**Time:** {result.get('processing_time_sec', '?')}s · " \
              f"**Review actions:** {n_actions} · " \
              f"Report saved to `{report_path}`"
    return (
        verdict_html(result),
        fields_rows(result),
        findings_rows(result),
        review_rows(result),
        result,
        md,
        report_path,
        summary,
    )


# ----------------------------------------------------------------------
# UI
# ----------------------------------------------------------------------

def build_app():
    try:
        theme = gr.themes.Soft()
    except Exception:
        theme = None

    with gr.Blocks(title="AI Legal Metrology Compliance Scanner", theme=theme) as app:
        gr.Markdown(
            "# 📦 AI Legal Metrology Compliance Scanner\n"
            "Capture up to **6 surfaces** of one package (front · back · sides · "
            "top · bottom) — or a single flat label image — and get a "
            "rule-based compliance verdict with evidence."
        )

        with gr.Row():
            with gr.Column(scale=1):
                gr.Markdown("### 1. Add package surfaces")
                capture = gr.Image(
                    sources=["webcam", "upload"],
                    type="filepath",
                    label="Camera / pick one photo",
                    height=260,
                )
                add_btn = gr.Button("➕ Add this surface", variant="secondary")
                files = gr.File(
                    file_count="multiple",
                    label="…or upload multiple photos at once",
                    file_types=["image"],
                )
                clear_btn = gr.Button("🗑 Clear package", variant="stop", size="sm")
                status = gr.Markdown("")
                gallery = gr.Gallery(
                    label="Surfaces in this package",
                    columns=3,
                    height=200,
                    preview=True,
                )
                surfaces_state = gr.State([])

            with gr.Column(scale=1):
                gr.Markdown("### 2. Run inspection")
                product_name = gr.Textbox(
                    label="Product name (optional)", placeholder="e.g. Haldiram Bhujia 500g"
                )
                run_btn = gr.Button(
                    "🔍 Run Inspection", variant="primary", size="lg"
                )
                verdict = gr.HTML(empty_outputs()[0])
                summary = gr.Markdown("")

        gr.Markdown("### 3. Results")
        with gr.Tabs():
            with gr.Tab("Review Actions"):
                gr.Markdown(
                    "*Unresolved fields with the exact surface to check — "
                    "no need to inspect the whole package.*"
                )
                reviews = gr.Dataframe(
                    headers=REVIEW_HEADERS,
                    datatype=["str", "str", "str", "str", "str"],
                    wrap=True,
                    interactive=False,
                    label="Targeted manual review",
                )
            with gr.Tab("Findings"):
                findings = gr.Dataframe(
                    headers=FINDINGS_HEADERS,
                    datatype=["str", "str", "str", "str", "str"],
                    wrap=True,
                    interactive=False,
                    label="Rule evaluation results",
                )
            with gr.Tab("Extracted Fields"):
                fields = gr.Dataframe(
                    headers=FIELDS_HEADERS,
                    datatype=["str", "str", "str", "str", "str"],
                    wrap=True,
                    interactive=False,
                    label="Fields detected across all surfaces",
                )
            with gr.Tab("Report"):
                report_md = gr.Markdown("")
                download = gr.DownloadButton(label="⬇ Download report (.md)", value=None)
            with gr.Tab("Raw JSON"):
                raw = gr.JSON(label="Full pipeline response")

        # wiring
        add_btn.click(
            add_surface,
            inputs=[capture, surfaces_state],
            outputs=[surfaces_state, gallery, status],
        )
        files.change(
            add_files,
            inputs=[files, surfaces_state],
            outputs=[surfaces_state, gallery, status],
        )
        clear_btn.click(
            clear_package,
            outputs=[surfaces_state, gallery, status],
        )
        run_btn.click(
            run_inspection,
            inputs=[surfaces_state, product_name],
            outputs=[verdict, fields, findings, reviews, raw, report_md, download, summary],
        )

    return app


if __name__ == "__main__":
    demo = build_app()
    demo.launch(server_name="127.0.0.1", server_port=7860, show_error=True)
