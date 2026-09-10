"""Email delivery of inspection reports (PRD §29).

Stdlib only: ``smtplib`` + ``email.message``. Gmail works with an app
password; any SMTP server works with the same four environment variables.
Unconfigured, every send fails closed with a clear message - never a silent
"sent" without an actual attempt.
"""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from typing import Optional


def is_configured() -> bool:
    """Whether SMTP credentials are present in the environment."""
    return bool(
        os.environ.get("SMTP_HOST")
        and os.environ.get("SMTP_USER")
        and os.environ.get("SMTP_PASSWORD")
    )


def send_report(
    to: str,
    subject: str,
    body: str,
    pdf_path: str,
    from_name: str = "LabelSure",
) -> str:
    """Send one inspection PDF. Returns a short confirmation string.

    Raises ``ValueError`` whenSMTP is not configured and ``OSError``/
    ``smtplib.SMTPException`` on delivery failure - the caller turns those
    into HTTP errors, never into a false "sent".
    """
    host = (os.environ.get("SMTP_HOST") or "").strip()
    user = (os.environ.get("SMTP_USER") or "").strip()
    password = os.environ.get("SMTP_PASSWORD") or ""
    try:
        port = int(os.environ.get("SMTP_PORT", "587"))
    except ValueError:
        port = 587

    if not (host and user and password):
        raise ValueError(
            "Email is not configured - set SMTP_HOST, SMTP_USER and SMTP_PASSWORD"
        )

    sender = os.environ.get("SMTP_FROM", user)
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{sender}>" if from_name else sender
    msg["To"] = to
    msg.set_content(body)

    with open(pdf_path, "rb") as fh:
        msg.add_attachment(
            fh.read(),
            maintype="application",
            subtype="pdf",
            filename=os.path.basename(pdf_path),
        )

    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.ehlo()
        if port != 465:
            smtp.starttls()
            smtp.ehlo()
        smtp.login(user, password)
        smtp.send_message(msg)

    return f"Report emailed to {to}"


def describe() -> dict:
    """Status for the frontend: which envelope fields exist, never secrets."""
    return {
        "configured": is_configured(),
        "host": os.environ.get("SMTP_HOST") or None,
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER") or None,
    }
