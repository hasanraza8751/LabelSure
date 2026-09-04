from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routers.inspection import router as inspection_router

app = FastAPI(
    title="AI Legal Metrology Compliance Scanner",
    description="Package image -> quality gate -> OCR -> field extraction -> "
    "deterministic rule engine -> confidence-fused compliance decision",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inspection_router, tags=["inspection"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "legal-metrology-scanner"}
