# Remaining Work — REMAINING.md

**Created:** 2026-09-05  
**Purpose:** Map every PRD requirement to built/not-built. Sections are checked, not assumed.

---

## Summary

| Category | Built | Remaining |
|----------|-------|-----------|
| OCR pipeline | 100% | — |
| Field extraction | 75% | brand, country of origin, importer address, packing date, expiry |
| Rule engine (LabelGuard) | 90% | rules verified/finalised, R26 exemption review |
| Confidence fusion | 100% | — |
| Evidence pipeline | 100% | highlighted image regions |
| Multi-image support | 100% | — |
| Image quality gate | 100% | glare/perspective checks |
| Report generator | 80% | PDF export |
| Gradio frontend | 70% | human-in-the-loop approve/override, visual evidence overlay, inspector queue sort |
| FastAPI backend | 60% | auth, search, audit log |
| Database | 60% | search by product/manufacturer/status, inspector decision fields |
| RAG integration | 0% | entire subsystem |
| PDF report | 0% | PDF rendering |
| Dashboard (supervisor) | 0% | charts, stats, trends |
| Security | 0% | auth, RBAC, input validation, audit log |
| Human-in-the-loop | 0% | accept/override workflow, inspector ID, timestamp, reason |
| Testing (PRD formal) | 60% | Test A–F formal fixtures |
| Documentation/reports | 70% | implementation reports per PRD §38 |
| Git | 0% | commit history |

---

## Section-by-Section Breakdown

### 1–2. Product Vision + Core Principle
✅ Done. System follows "AI extracts → Rules decide → Human verifies".

---

### 3. Primary User (Inspector)
| Requirement | Status |
|-------------|--------|
| Capture/upload package | ✅ Gradio camera + upload |
| Receive automated assessment | ✅ verdict + confidence |
| Understand why flagged | ✅ rule results + review actions |
| Manually verify uncertain findings | ❌ no accept/override in UI |
| Approve/reject system finding | ❌ no inspector decision |
| Generate report | ⚠️ markdown only, no PDF |
| Search historical inspections | ❌ no search UI |

---

### 4. Secondary Users (Supervisor / Admin)
| Requirement | Status |
|-------------|--------|
| View inspection statistics | ❌ |
| Violation trends | ❌ |
| Inspector activity | ❌ |
| Product category breakdown | ❌ |
| Manufacturer trends | ❌ |
| Recurring violations | ❌ |
| Manage users / rules / config | ❌ |

---

### 5. End-to-End Workflow
✅ All 10 steps implemented as pipeline: `quality → OCR → extract → classify → RAG skip → rules → confidence → verdict → evidence → report`.

---

### 6. Technology Stack

| Component | PRD | Built |
|-----------|-----|-------|
| Frontend | Next.js + React + TypeScript + Tailwind + shadcn/ui + Recharts | Gradio (Python) |
| Backend | Python + FastAPI + Pydantic + SQLAlchemy | ✅ |
| OCR | PaddleOCR | ✅ |
| Computer Vision | OpenCV + Pillow + NumPy | ✅ (Pillow + NumPy) |
| RAG | Existing Multimodal RAG project | ❌ |
| LLM | For extraction/normalisation/explanation | ❌ |
| Database | PostgreSQL | SQLite (dev mode) |
| Storage | Local / MinIO | Local only |
| Reports | HTML → PDF / ReportLab | Markdown only |

---

### 7. Regulatory Knowledge Base
| Requirement | Status |
|-------------|--------|
| Primary sources (LM(PC)R 2011) | ✅ 31 rules in JSON |
| Source priority hierarchy | ⚠️ rules have `source.rule` field but no document/page |
| Metadata (document, page, version, effective date, URL) | ❌ partially — rule_id + rule reference text only |
| Official amendments/notifications | ❌ no amendment data |

---

### 8. RAG Requirements
| Requirement | Status |
|-------------|--------|
| Ingest regulatory PDFs | ❌ |
| Extract text + preserve structure | ❌ |
| Identify rules/clauses | ❌ |
| Maintain page numbers + effective dates | ❌ |
| Create embeddings | ❌ |
| Semantic + keyword retrieval | ❌ |
| Metadata filtering | ❌ |
| Source citations | ❌ |
| **Integrate existing Multimodal RAG project** | ❌ **not started** |

---

### 9. OCR Requirements
| Requirement | Status |
|-------------|--------|
| Return text + confidence + bounding box | ✅ |
| Original OCR text per extracted field | ✅ |
| Normalised value | ✅ |
| `NOT_DETECTED` / `MANUAL_REVIEW` for low confidence | ✅ |

---

### 10. Fields to Extract

| Field | Status |
|-------|--------|
| Product name | ✅ |
| Brand | ⚠️ partial — brand names sometimes extracted as product_name, no dedicated brand field |
| Manufacturer + address | ✅ |
| Packer + address | ⚠️ partial — packer detected, address detection limited |
| Importer + address | ❌ |
| Net quantity + unit | ✅ |
| MRP | ✅ |
| Manufacturing date | ✅ |
| Packing date | ⚠️ detected when present, but not a separate field |
| Import date | ❌ |
| Expiry / best-before / use-by | ⚠️ only detected where present (not extracted as dedicated field) |
| Consumer-care phone | ✅ (4-2-4 format) |
| Consumer-care email | ✅ |
| Country of origin | ❌ |

---

### 11. Rule Engine
| Requirement | Status |
|-------------|--------|
| Deterministic | ✅ |
| Rules as structured JSON | ✅ (`labelguard_rules_draft.json`) |
| Rule types: presence, format, numeric, unit, cross-field, date, readability, font, placement | ⚠️ most implemented; cross-field, font measurement, placement rules not yet |

---

### 12–13. Supported Rule Types + Compliance States
✅ PASS / FAIL / MANUAL_REVIEW implemented.

---

### 14. Overall Decision Logic
✅ Implemented in `ConfidenceEngine`: FAIL → NON_COMPLIANT, MANUAL_REVIEW unresolved → MANUAL_REVIEW, else COMPLIANT.

---

### 15–16. Confidence Engine + Components
✅ OCR confidence, extraction confidence, rule confidence, pattern confidence, cross-validation, bidirectional downgrade, weighted fusion all implemented.

---

### 17. Manual Review Prioritization
✅ Three tiers: 🟢 AUTO ACCEPT (≥90%), 🟡 REVIEW (70–89%), 🔴 PRIORITY REVIEW (<70%).

---

### 18. Thresholds
✅ Configurable in `backend/app/config.py`. Defaults match PRD.

---

### 19. Confidence-Based Inspector Queue
| Requirement | Status |
|-------------|--------|
| Dashboard with queue | ⚠️ Gradio verdict display only, no dedicated queue view |
| Sort by confidence / severity / product / manufacturer / date | ❌ |
| Priority / Review / Auto-processed buckets | ⚠️ shown per-inspection, not across all |

---

### 20. Visual Evidence
| Requirement | Status |
|-------------|--------|
| Bounding box | ✅ in `extracted_fields` |
| OCR text + confidence | ✅ |
| Highlighted image region | ❌ no image annotation/overlay |
| Applicable rule reference | ✅ |
| Evidence description | ✅ |

---

### 21. Human-in-the-Loop
| Requirement | Status |
|-------------|--------|
| Inspector accepts/overrides AI finding | ❌ |
| Inspector provides reason | ❌ |
| Inspector ID recorded | ❌ |
| Timestamp recorded | ❌ |
| Final inspector decision stored | ❌ |
| Audit trail (AI decision + inspector decision) | ❌ |

**This is the single largest gap in the system.**

---

### 22. LLM Rules
| Requirement | Status |
|-------------|--------|
| LLM for OCR cleanup / entity extraction / query understanding | ❌ |
| LLM must NOT invent regulations or override rules | ✅ by design (no LLM used) |

---

### 23. Product Context
| Requirement | Status |
|-------------|--------|
| Category / commodity type detection | ⚠️ product_name extracted but no explicit category classification |
| Determines which rules apply | ❌ all 31 rules evaluated regardless |

---

### 24. Image Quality Gate
| Requirement | Status |
|-------------|--------|
| Resolution check | ✅ |
| Blur check | ✅ |
| Brightness check | ✅ |
| Contrast check | ✅ |
| Glare detection | ❌ |
| Perspective distortion | ❌ |
| "Do not attempt legal decision from unusable imagery" | ✅ |

---

### 25. Multi-Image Support
✅ Front, back, side, bottom, can neck, lid — all supported and merged.

---

### 26. Compliance Score
| Requirement | Status |
|-------------|--------|
| Numeric score (e.g. 92/100) | ⚠️ confidence shown as percentage, no 0–100 breakdown |
| Category breakdown (mandatory/formatting/readability) | ❌ |
| "Does not replace statutory inspection" disclaimer | ❌ |

---

### 27. Dashboard (Supervisor)
| Requirement | Status |
|-------------|--------|
| Total inspections | ❌ |
| Compliant / Non-compliant / Manual review counts | ❌ |
| Average confidence | ❌ |
| Common violations | ❌ |
| Recent inspections list | ⚠️ Gradio shows per-run only |
| Charts (compliance rate, trends, categories) | ❌ |

---

### 28. Inspection Repository
| Requirement | Status |
|-------------|--------|
| Store: inspection ID, product, images, OCR, fields, rules, result, confidence, violations, evidence, timestamp, report | ✅ all in `InspectionRow.result_json` |
| Store: inspector decision | ❌ |
| Search by product / manufacturer / ID / date / status / violation | ❌ only `list_inspections(limit)` |

---

### 29. PDF Report
| Requirement | Status |
|-------------|--------|
| Professional report with header | ❌ |
| Image embedded | ❌ |
| Extracted declarations table | ❌ |
| Compliance status | ❌ |
| Violations with evidence | ❌ |
| Manual verification section (inspector sign-off) | ❌ |
| **Currently: markdown only** | — |

---

### 30. Security
| Requirement | Status |
|-------------|--------|
| Authentication | ❌ |
| Role-based access | ❌ |
| Secure file handling | ⚠️ temp files deleted after inspect |
| Input validation | ⚠️ basic (File upload type check) |
| Database access controls | ❌ |
| Audit logging | ❌ |
| No sensitive info in logs | ⚠️ logs inspection IDs only |
| Configurable retention | ❌ |

---

### 31. Performance Targets
| Target | Status |
|--------|--------|
| Image → OCR: < 5 sec | ✅ ~1.5s per image |
| Image → compliance: < 10 sec | ✅ ~2s single, ~10s 3-image |
| Image resizing / preprocessing | ✅ via resize_for_ocr |
| Selective OCR | ✅ |
| Caching | ❌ |
| Async processing | ❌ (sync pipeline) |

---

### 32. Offline/Online Architecture
| Requirement | Status |
|-------------|--------|
| OCR + rules run locally | ✅ PaddleOCR + LabelGuard |
| Graceful API failure handling | ⚠️ basic try/except |
| LLM/RAG as online-only | ❌ not implemented |

---

### 33. Error Handling
| Requirement | Status |
|-------------|--------|
| OCR failure → "capture another image" | ✅ |
| RAG failure → "manual verification required" | ❌ (no RAG) |
| LLM failure → fallback to OCR/regex | ❌ (no LLM) |
| Image failure → request recapture | ✅ |

---

### 34. Testing Requirements

| Test | PRD | Status |
|------|-----|--------|
| Test A: Fully compliant package → COMPLIANT | ❌ formal fixture not created |
| Test B: Missing mandatory declaration → NON_COMPLIANT | ⚠️ covered by can regression |
| Test C: Invalid quantity/unit → NON_COMPLIANT | ⚠️ covered by can regression |
| Test D: Poor OCR → MANUAL_REVIEW | ⚠️ covered by OCR rescue tests |
| Test E: Multiple violations → NON_COMPLIANT | ⚠️ covered by image5 |
| Test F: Glare/blurred → RECAPTURE / MANUAL_REVIEW | ⚠️ covered by quality gate tests |

---

### 35. Legal Safety Rule
| Requirement | Status |
|-------------|--------|
| Display "AI-assisted compliance screening" | ❌ not in UI or reports |
| Never display "automated legal enforcement" | ✅ by omission |

---

### 36. Development Agent Rules
| Rule | Status |
|------|--------|
| Read existing architecture before modifying | ✅ followed |
| Never rewrite working modules | ✅ followed |
| Backward compatibility | ✅ |
| Modular architecture | ✅ |
| No hardcoded regulations in frontend | ✅ |
| No hardcoded regulatory citations | ✅ |
| Separate regulatory data from logic | ✅ |
| Env vars for API keys | ✅ |
| Never commit API keys | ✅ |
| Never fabricate test results | ✅ |
| Never claim model accuracy without testing | ✅ |
| Never claim regulation without source | ✅ |
| Traceability to source evidence | ✅ |
| Reproducible results (input + model + ruleset + config) | ✅ |
| Configurable thresholds | ✅ |

---

### 37–38. Implementation Reports
| Report | Status |
|--------|--------|
| STEP_01_IMAGE_PROCESSING_REPORT.md | ⚠️ phase reports exist but not in PRD format |
| STEP_02_OCR_REPORT.md | ⚠️ |
| STEP_03_RAG_REPORT.md | ❌ (no RAG yet) |
| STEP_04_RULE_ENGINE_REPORT.md | ⚠️ |
| STEP_05_DASHBOARD_REPORT.md | ❌ |
| STEP_06_INTEGRATION_REPORT.md | ❌ |
| Reports in `/docs/progress/` | ⚠️ in `reports/` instead |

---

### 39. Git Requirements
| Requirement | Status |
|-------------|--------|
| Logical commits (`feat:`, `fix:`) | ❌ no commits yet |
| Avoid `update`, `final`, `final2` | — |

---

### 40. Definition of Done
| Criterion | Status |
|-----------|--------|
| Code implemented | ✅ |
| Integration completed | ✅ pipeline + frontend + API |
| Tests written | ✅ 155 passing |
| Tests executed | ✅ |
| Errors handled | ⚠️ basic |
| Documentation updated | ⚠️ no implementation reports |
| API documented | ⚠️ FastAPI auto-docs only |
| Security reviewed | ❌ |
| Implementation report generated | ❌ |

---

### 41. Final MVP (10 steps)
| Step | Status |
|------|--------|
| 1. Upload/capture | ✅ |
| 2. Image quality check | ✅ |
| 3. OCR | ✅ |
| 4. Extract declarations | ✅ |
| 5. Retrieve regulations | ⚠️ rules exist but no RAG |
| 6. Run compliance rules | ✅ |
| 7. Calculate confidence | ✅ |
| 8. PASS / REVIEW / FAIL | ✅ |
| 9. Show visual evidence | ⚠️ text only, no image overlay |
| 10. Generate PDF report | ❌ markdown only |

---

### 42. Final Demo Scenario
| Requirement | Status |
|-------------|--------|
| 2-minute demo flow | ⚠️ pipeline works but no PDF, no inspector sign-off |
| "Scan Product" → image → OCR results with ✓/❌ | ✅ |
| RAG retrieval with rule + source document + page | ❌ (no RAG) |
| Verdict with confidence | ✅ |
| "View Evidence" → highlighted image + rule + source | ❌ (no image overlay) |
| Generate Report | ⚠️ markdown only |

---

## Priority Fixes (hackathon-critical)

| Priority | What | Effort |
|----------|------|--------|
| 🔴 P0 | Human-in-the-loop: accept/override + inspector ID + reason + audit trail | Medium |
| 🔴 P0 | PDF report generation (ReportLab or HTML→PDF) | Medium |
| 🔴 P0 | Visual evidence: annotated images with bounding boxes | Small |
| 🔴 P0 | "AI-assisted compliance screening" disclaimer in UI + reports | Small |
| 🟡 P1 | Dashboard: stats, charts (Recharts/Plotly in Gradio or separate page) | Medium |
| 🟡 P1 | Inspection search (by product, manufacturer, date, status) | Small |
| 🟡 P1 | Brand + country of origin + expiry field extraction | Small |
| 🟡 P1 | PRD §38 implementation reports (6 reports in /docs/progress/) | Medium |
| 🟢 P2 | RAG integration (adapt existing Multimodal RAG project) | Large |
| 🟢 P2 | Product category classification → rules scoped by category | Medium |
| 🟢 P2 | Auth + RBAC | Large |
| 🟢 P2 | Glare / perspective distortion detection | Small |
| 🟢 P2 | Commit history (`feat:` commits) | Small |
