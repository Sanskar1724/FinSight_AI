"""Outgoing email over plain SMTP.

Any SMTP provider works (Brevo, Mailgun, Amazon SES, Gmail with an app
password); switching providers only changes environment variables. Without
SMTP_HOST, messages are logged instead of sent so local development needs no
mail server, and they are kept in ``outbox`` for tests.
"""

from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr, parseaddr

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OutgoingEmail:
    to: str
    subject: str
    text: str
    html: str | None = None


outbox: list[OutgoingEmail] = []


def _build(message: OutgoingEmail) -> EmailMessage:
    email = EmailMessage()
    name, address = parseaddr(settings.mail_from)
    email["From"] = formataddr((name, address)) if address else settings.mail_from
    email["To"] = message.to
    email["Subject"] = message.subject
    email.set_content(message.text)
    if message.html:
        email.add_alternative(message.html, subtype="html")
    return email


def send_email(message: OutgoingEmail) -> bool:
    """Send one email. Returns False instead of raising so callers never leak
    delivery failures to the client."""
    if not settings.smtp_host:
        outbox.append(message)
        logger.info("Email not sent (SMTP_HOST unset). To: %s | %s\n%s", message.to, message.subject, message.text)
        return True
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(_build(message))
        return True
    except (smtplib.SMTPException, OSError):
        logger.exception("Could not send email to the configured SMTP server")
        return False


def password_reset_email(to: str, name: str, link: str, minutes: int) -> OutgoingEmail:
    text = (
        f"Hi {name},\n\n"
        "Someone asked to reset the password for your FinSight AI account.\n"
        f"Open this link within {minutes} minutes to choose a new password:\n\n"
        f"{link}\n\n"
        "If you didn't ask for this, you can ignore this email; your password stays the same.\n\n"
        "- FinSight AI"
    )
    html = f"""\
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;color:#0b1f1a">
  <h2 style="margin:0 0 12px">Reset your FinSight AI password</h2>
  <p>Hi {name},</p>
  <p>Someone asked to reset the password for your account. This link works for {minutes} minutes:</p>
  <p style="margin:24px 0">
    <a href="{link}" style="background:#0f6b52;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Choose a new password</a>
  </p>
  <p style="color:#5b6b66;font-size:13px">If you didn't ask for this, ignore this email; your password stays the same.</p>
</div>"""
    return OutgoingEmail(to=to, subject="Reset your FinSight AI password", text=text, html=html)
