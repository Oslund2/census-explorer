import uuid
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, Response
from ..services.pdf_generator import generate_report_html, generate_pdf

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory report storage
reports: dict[str, dict] = {}


@router.post("/api/report/generate")
async def generate_report(data: dict):
    """Store report data and return report ID."""
    report_id = str(uuid.uuid4())
    reports[report_id] = data
    return {"report_id": report_id}


@router.get("/api/report/{report_id}/html")
async def get_report_html(report_id: str):
    """Return rendered HTML report."""
    if report_id not in reports:
        raise HTTPException(status_code=404, detail="Report not found")
    html = generate_report_html(reports[report_id])
    return HTMLResponse(content=html)


@router.get("/api/report/{report_id}/pdf")
async def get_report_pdf(report_id: str):
    """Return PDF download of the report."""
    if report_id not in reports:
        raise HTTPException(status_code=404, detail="Report not found")
    html = generate_report_html(reports[report_id])
    pdf_bytes = generate_pdf(html)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=census-report-{report_id[:8]}.pdf"},
    )
