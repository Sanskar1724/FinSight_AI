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


def _upi_rows(pdf: canvas.Canvas, y: float, rows, *, date_x=40, details_x=130, type_x=420, amount_x=560) -> None:
    for when, time, details, extra, kind, amount in rows:
        pdf.drawString(date_x, y, when)
        pdf.drawString(details_x, y, details)
        if kind:
            pdf.drawString(type_x, y, kind)
        pdf.drawRightString(amount_x, y, amount)
        if time:
            pdf.drawString(date_x, y - 10, time)
        for offset, line in enumerate(extra, start=1):
            pdf.drawString(details_x, y - 10 * offset, line)
        y -= 14 + 10 * max(len(extra), 1 if time else 0)


# The built-in PDF fonts have no rupee sign, so these use "Rs." and "INR";
# parsing of "₹" itself is covered by a unit test.


def phonepe_style() -> bytes:
    """Month-first dates, a DEBIT/CREDIT word column and ₹ amounts with no
    paise, with time, transaction ID, UTR and 'Paid by' lines under each row."""
    buffer, pdf = _canvas()
    width, height = A4
    pdf.drawString(40, height - 40, "PhonePe")
    pdf.drawString(40, height - 52, "Transaction Statement for 98XXXXX210")
    pdf.drawString(40, height - 64, "Oct 01, 2026 - Oct 31, 2026")
    y = height - 90
    for x, label in [(40, "Date"), (130, "Transaction Details"), (420, "Type"), (520, "Amount")]:
        pdf.drawString(x, y, label)
    rows = [
        ("Oct 01, 2026", "10:23 am", "Paid to Swiggy", ["Transaction ID T2610011023451234", "UTR No. 412345678901", "Paid by XXXXXX4821"], "DEBIT", "Rs.450"),
        ("Oct 04, 2026", "08:02 pm", "Received from Amit Kumar", ["Transaction ID T2610042002111111", "Credited to XXXXXX4821"], "CREDIT", "Rs. 500"),
        ("Oct 07, 2026", "09:15 am", "Mobile recharged 98XXXXX210", ["Transaction ID T2610070915222222"], "DEBIT", "INR 299"),
        ("Oct 09, 2026", "01:40 pm", "Paid to Blinkit", ["Transaction ID T2610091340333333"], "DEBIT", "Rs.1,234.50"),
    ]
    _upi_rows(pdf, y - 16, rows)
    return _finish(buffer, pdf)


def gpay_style() -> bytes:
    """Day-first dates with the time on the same line, and no type column:
    the 'Paid to' / 'Received from' wording gives the direction."""
    buffer, pdf = _canvas()
    width, height = A4
    pdf.drawString(40, height - 40, "Google Pay")
    pdf.drawString(40, height - 52, "Transaction statement")
    y = height - 80
    for x, label in [(40, "Date & time"), (170, "Transaction details"), (520, "Amount")]:
        pdf.drawString(x, y, label)
    rows = [
        ("02 Oct, 2026 07:45 PM", "", "Paid to Zomato", ["UPI Transaction ID: 427512345678", "Paid by HDFC Bank 4821"], "", "Rs.320"),
        ("05 Oct, 2026 11:10 AM", "", "Received from Priya Sharma", ["UPI Transaction ID: 427598765432"], "", "Rs.1,000"),
    ]
    _upi_rows(pdf, y - 16, rows, details_x=170)
    return _finish(buffer, pdf)


def navi_style() -> bytes:
    """Signed amounts ('- ₹450', '+ ₹50') and a date with a trailing comma
    and time."""
    buffer, pdf = _canvas()
    width, height = A4
    pdf.drawString(40, height - 40, "Navi UPI")
    pdf.drawString(40, height - 52, "Account statement")
    y = height - 80
    for x, label in [(40, "Date"), (170, "Details"), (520, "Amount")]:
        pdf.drawString(x, y, label)
    rows = [
        ("03 Oct 2026, 09:30 AM", "", "Paid to Uber India", ["UTR 412300000001"], "", "- Rs.212"),
        ("06 Oct 2026, 06:00 PM", "", "Cashback received", ["UTR 412300000002"], "", "+ Rs.50"),
    ]
    _upi_rows(pdf, y - 16, rows, details_x=170)
    return _finish(buffer, pdf)
