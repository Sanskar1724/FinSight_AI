"""Build small statement PDFs in the layouts Indian banks use, for tests.

All names, numbers and handles are made up. Each builder returns PDF bytes.
"""

from __future__ import annotations

import io

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def _canvas(password: str | None = None):
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4, encrypt=password)
    pdf.setFont("Helvetica", 8)
    return buffer, pdf


def _finish(buffer: io.BytesIO, pdf: canvas.Canvas) -> bytes:
    pdf.save()
    return buffer.getvalue()


def hdfc_style(password: str | None = None, *, break_balance: bool = False) -> bytes:
    """Withdrawal and deposit columns, wrapped narrations, opening and
    closing balance in a summary, and a header repeated on page 2."""
    buffer, pdf = _canvas(password)
    width, height = A4
    pdf.drawString(40, height - 40, "HDFC BANK LTD")
    pdf.drawString(40, height - 52, "Statement of account  Account No : XXXXXXXX4821")
    pdf.drawString(40, height - 64, "Opening Balance 50,000.00")
    rows = [
        ("01/10/26", ["UPI-SWIGGY-swiggy@yespay-YESB0YESUPI-", "412345678901-Dinner"], "450.00", "", "49,550.00"),
        ("02/10/26", ["NEFT CR-HDFC0000123-ACME TECHNOLOGIES", "PVT LTD-SALARY OCT"], "", "85,000.00", "1,34,550.00"),
        ("03/10/26", ["ATM WDL-SBI ATM KORAMANGALA"], "2,000.00", "", "1,32,550.00"),
        ("05/10/26", ["UPI-BIGBASKET-bigbasket@icici-ICIC0DC0099-", "512345678901-Order"], "1,234.50", "", "1,31,315.50"),
        ("06/10/26", ["CREDIT CARD PAYMENT XX9034"], "12,480.00", "", "1,18,835.50"),
    ]
    page_two = [
        ("10/10/26", ["UPI-NETFLIX COM-netflix@hdfcbank-HDFC0000499-"], "649.00", "", "1,18,186.50"),
        ("15/10/26", ["IMPS-312345678901-PRIYA SHARMA-HDFC-RENT"], "18,000.00", "", "1,00,186.50"),
    ]

    def header(y: float) -> None:
        for x, label in [(40, "Date"), (90, "Narration"), (330, "Withdrawal Amt."), (420, "Deposit Amt."), (510, "Closing Balance")]:
            pdf.drawString(x, y, label)

    def draw_rows(items, y: float) -> float:
        for when, narration, debit, credit, balance in items:
            if break_balance and when == "05/10/26":
                balance = "1,31,000.00"
            pdf.drawString(40, y, when)
            pdf.drawString(90, y, narration[0])
            if debit:
                pdf.drawRightString(380, y, debit)
            if credit:
                pdf.drawRightString(465, y, credit)
            pdf.drawRightString(570, y, balance)
            for extra in narration[1:]:
                y -= 11
                pdf.drawString(90, y, extra)
            y -= 16
        return y

    header(height - 90)
    draw_rows(rows, height - 106)
    pdf.showPage()
    pdf.setFont("Helvetica", 8)
    header(height - 50)
    y = draw_rows(page_two, height - 66)
    pdf.drawString(40, y - 10, "Closing Balance 1,00,186.50")
    pdf.drawString(40, y - 22, "This is a computer generated statement")
    return _finish(buffer, pdf)


def sbi_style() -> bytes:
    """Txn date and value date as '1 Oct 2026', debit and credit columns, and
    a balance with a 'Cr' marker."""
    buffer, pdf = _canvas()
    width, height = A4
    pdf.drawString(40, height - 40, "State Bank of India")
    pdf.drawString(40, height - 52, "Account Number 00000031234567890")
    y = height - 80
    for x, label in [(40, "Txn Date"), (100, "Value Date"), (160, "Description"), (400, "Debit"), (460, "Credit"), (520, "Balance")]:
        pdf.drawString(x, y, label)
    rows = [
        ("1 Oct 2026", ["TO TRANSFER-UPI/DR/330112345678/", "ZOMATO/YESB/zomato@ybl/Food"], "320.00", "", "9,680.00 Cr"),
        ("3 Oct 2026", ["BY TRANSFER-UPI/CR/330212345678/", "AMIT/ICIC/amit@okicici/split"], "", "500.00", "10,180.00 Cr"),
        ("4 Oct 2026", ["TO TRANSFER-UPI/DR/330312345678/", "UBER INDIA/HDFC/uber@hdfc/ride"], "212.40", "", "9,967.60 Cr"),
    ]
    y -= 16
    for when, narration, debit, credit, balance in rows:
        pdf.drawString(40, y, when)
        pdf.drawString(100, y, when)
        pdf.drawString(160, y, narration[0])
        if debit:
            pdf.drawRightString(430, y, debit)
        if credit:
            pdf.drawRightString(490, y, credit)
        pdf.drawRightString(570, y, balance)
        pdf.drawString(160, y - 10, narration[1])
        y -= 24
    return _finish(buffer, pdf)


def no_header_style() -> bytes:
    """No column header at all: one amount and a running balance per row."""
    buffer, pdf = _canvas()
    width, height = A4
    pdf.drawString(40, height - 40, "Kotak Mahindra Bank")
    pdf.drawString(40, height - 52, "Opening Balance 5,000.00")
    rows = [
        ("01-Oct-2026", "UPI/RAPIDO/rapido@axl/ride", "120.00", "4,880.00"),
        ("02-Oct-2026", "INT.PD 01-07-2026 TO 30-09-2026", "35.00", "4,915.00"),
        ("03-Oct-2026", "POS 512345XXXXXX1234 DMART BANGALORE", "1,415.00", "3,500.00"),
    ]
    y = height - 80
    for when, narration, amount, balance in rows:
        pdf.drawString(40, y, when)
        pdf.drawString(110, y, narration)
        pdf.drawRightString(470, y, amount)
        pdf.drawRightString(560, y, balance)
        y -= 16
    return _finish(buffer, pdf)


def credit_card_style() -> bytes:
    """One amount column with 'Cr' on payments and refunds."""
    buffer, pdf = _canvas()
    width, height = A4
    pdf.drawString(40, height - 40, "ICICI Bank Credit Card Statement")
    pdf.drawString(40, height - 52, "Card Number 4375 XXXX XXXX 9034")
    pdf.drawString(40, height - 64, "Payment Due Date 20/11/2026   Minimum Amount Due 500.00")
    y = height - 90
    for x, label in [(40, "Date"), (110, "Transaction Details"), (480, "Amount (in Rs.)")]:
        pdf.drawString(x, y, label)
    rows = [
        ("02/10/2026", "AMAZON PAY INDIA PVT LTD BANGALORE", "2,499.00"),
        ("05/10/2026", "PAYMENT RECEIVED - THANK YOU", "12,480.00 Cr"),
        ("08/10/2026", "MAKEMYTRIP INDIA PVT LTD GURGAON", "6,250.00"),
        ("09/10/2026", "REFUND AMAZON PAY INDIA", "499.00 Cr"),
    ]
    y -= 16
    for when, details, amount in rows:
        pdf.drawString(40, y, when)
        pdf.drawString(110, y, details)
        pdf.drawRightString(560, y, amount)
        y -= 16
    return _finish(buffer, pdf)


def scanned_style() -> bytes:
    """A page with no text, like a scanned image."""
    buffer, pdf = _canvas()
    pdf.rect(40, 400, 200, 200, fill=1)
    return _finish(buffer, pdf)
