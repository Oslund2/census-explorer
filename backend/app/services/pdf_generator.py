import io
import base64
import logging
from jinja2 import Environment, FileSystemLoader
from pathlib import Path

logger = logging.getLogger(__name__)

templates_dir = Path(__file__).resolve().parent.parent / "templates"
env = Environment(loader=FileSystemLoader(str(templates_dir)))


def render_chart_image(chart_data: dict) -> str:
    """Render a chart as a base64 PNG using matplotlib. Returns data URI."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(8, 5))
        chart_type = chart_data.get("type", "bar")
        data = chart_data.get("data", {})
        labels = data.get("labels", [])
        datasets = data.get("datasets", [])

        if chart_type == "bar":
            import numpy as np
            x = np.arange(len(labels))
            width = 0.8 / max(len(datasets), 1)
            for i, ds in enumerate(datasets):
                offset = (i - len(datasets) / 2 + 0.5) * width
                ax.bar(x + offset, ds.get("data", []), width, label=ds.get("label", ""))
            ax.set_xticks(x)
            ax.set_xticklabels(labels, rotation=45, ha="right")
        elif chart_type == "line":
            for ds in datasets:
                ax.plot(labels, ds.get("data", []), marker="o", label=ds.get("label", ""))
        elif chart_type in ("pie", "doughnut"):
            if datasets:
                ax.pie(datasets[0].get("data", []), labels=labels, autopct="%1.1f%%")

        ax.set_title(chart_data.get("title", ""))
        if chart_type not in ("pie", "doughnut"):
            ax.legend()
        fig.tight_layout()

        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=150)
        plt.close(fig)
        buf.seek(0)
        b64 = base64.b64encode(buf.read()).decode()
        return f"data:image/png;base64,{b64}"
    except Exception as e:
        logger.error(f"Chart rendering failed: {e}")
        return ""


def generate_report_html(report_data: dict) -> str:
    """Render a Census report as HTML."""
    # Pre-render charts as images for the template
    charts = report_data.get("charts", [])
    chart_images = [render_chart_image(c) for c in charts]
    report_data["chart_images"] = chart_images

    template = env.get_template("report.html")
    return template.render(**report_data)


def generate_pdf(html_string: str) -> bytes:
    """Convert HTML to PDF using WeasyPrint."""
    try:
        from weasyprint import HTML
        return HTML(string=html_string).write_pdf()
    except ImportError:
        logger.error("WeasyPrint not installed. Cannot generate PDF.")
        raise
