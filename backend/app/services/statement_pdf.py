"""Read transactions from a bank or credit card statement PDF.

Works on text PDFs (the kind banks email or let you download), including
password-protected ones. Scanned images are not supported because there is no
text to read.

How a statement is read:

1. Words and their positions are extracted with pdfplumber and grouped into
   lines by their vertical position.
2. A header line (for example "Date  Narration  Withdrawal  Deposit  Balance")
   gives the x position of each amount column. Headers repeat on most pages,
   so the latest one seen is used.
3. A line that starts with a date and contains at least one amount is a
   transaction. Lines after it that have no date and no amount are wrapped
   narration and are joined to it.
4. Each amount is put in the column it sits under. With no usable header, the
   running balance decides the direction: if the balance went down, money
   went out. Without a balance, a "Cr"/"Dr" marker or the narration decides.
5. Where the statement prints running balances, every row is checked against
   them (previous balance plus or minus the amount must equal the new
   balance), and opening plus credits minus debits is checked against the
   closing balance. This is the proof shown next to the import.

The PDF and its password are never stored.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

MAX_PAGES = 60
MAX_ROWS = 3000
TOLERANCE = Decimal("0.01")

_MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec"
_DATE_ONE_TOKEN = re.compile(
    rf"^(\d{{1,2}}[/\-.](\d{{1,2}}|{_MONTHS})[/\-.](\d{{2}}|\d{{4}})|\d{{4}}-\d{{2}}-\d{{2}})$",
    re.I,
)
_DAY = re.compile(r"^\d{1,2},?$")
_MONTH = re.compile(rf"^({_MONTHS})[a-z]*,?$", re.I)
_YEAR = re.compile(r"^(\d{2}|\d{4}),?$")
_MONEY = re.compile(r"^\(?-?(?:\d{1,3}(?:,\d{2,3})+|\d+)\.\d{2}\)?(cr|dr)?$", re.I)
_MARKER = re.compile(r"^(cr|dr)\.?$", re.I)
# UPI apps print the direction as a word next to the amount.
_TYPE_WORD = re.compile(r"^(debit|credit|debited|credited|paid|received)$", re.I)
# Amounts with a currency sign may omit the paise: "₹450", "Rs.1,200", "+ ₹50".
_CURRENCY_MONEY = re.compile(
    r"^(?P<sign>[+\-])?(?:₹|rs\.?|inr)\s?(?P<num>(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?)(?P<marker>cr|dr)?$",
    re.I,
)
_CURRENCY_ONLY = re.compile(r"^[+\-]?(₹|rs\.?|inr)$", re.I)
_TIME = re.compile(r"^\d{1,2}:\d{2}(:\d{2})?$|^(am|pm)$", re.I)
# Detail lines UPI apps print under each payment; never part of the payee.
_UPI_META = re.compile(
    r"^(\d{1,2}:\d{2}|transaction\s*id|txn\s*id|utr|upi\s*(ref|transaction)|paid\s*by|debited\s*from|"
    r"credited\s*to|bank\s*reference|order\s*id|note\s*:)",
    re.I,
)
UPI_APPS = [
    (re.compile(r"phonepe", re.I), "PhonePe"),
    (re.compile(r"google\s*pay|\bgpay\b", re.I), "Google Pay"),
    (re.compile(r"paytm", re.I), "Paytm"),
    (re.compile(r"amazon\s*pay", re.I), "Amazon Pay"),
    (re.compile(r"\bbhim\b", re.I), "BHIM"),
    (re.compile(r"\bcred\b", re.I), "CRED"),
    (re.compile(r"\bnavi\b", re.I), "Navi"),
    (re.compile(r"mobikwik", re.I), "MobiKwik"),
    (re.compile(r"super\.?money", re.I), "super.money"),
    (re.compile(r"freecharge", re.I), "Freecharge"),
]

DEBIT_HEADERS = ("withdrawal", "withdrawals", "debit", "debits", "dr", "paid", "withdrawal(dr)")
CREDIT_HEADERS = ("deposit", "deposits", "credit", "credits", "cr", "received", "deposit(cr)")
BALANCE_HEADERS = ("balance", "bal", "closing")
AMOUNT_HEADERS = ("amount", "amt", "amount(rs)", "amount(₹)", "amount(inr)")
STOP_WORDS = (
    "opening balance", "closing balance", "statement summary", "page ", "total", "grand total",
    "this is a computer", "computer generated", "end of statement", "abbreviations", "carried forward",
    "brought forward", "b/f", "c/f", "registered office", "customer care", "toll free",
)

BANKS = [
    (re.compile(r"state\s+bank\s+of\s+india|\bsbi\b", re.I), "State Bank of India"),
    (re.compile(r"hdfc\s*bank", re.I), "HDFC Bank"),
    (re.compile(r"icici\s*bank", re.I), "ICICI Bank"),
    (re.compile(r"axis\s*bank", re.I), "Axis Bank"),
    (re.compile(r"kotak", re.I), "Kotak Mahindra Bank"),
    (re.compile(r"bank\s+of\s+baroda", re.I), "Bank of Baroda"),
    (re.compile(r"punjab\s+national\s+bank|\bpnb\b", re.I), "Punjab National Bank"),
    (re.compile(r"canara\s+bank", re.I), "Canara Bank"),
    (re.compile(r"union\s+bank", re.I), "Union Bank of India"),
    (re.compile(r"idfc\s*first", re.I), "IDFC FIRST Bank"),
    (re.compile(r"yes\s*bank", re.I), "Yes Bank"),
    (re.compile(r"indusind", re.I), "IndusInd Bank"),
    (re.compile(r"federal\s+bank", re.I), "Federal Bank"),
    (re.compile(r"au\s+small\s+finance", re.I), "AU Small Finance Bank"),
]


class StatementError(ValueError):
    """A statement that cannot be read. ``code`` lets the client react, for
    example by asking for a password."""

    def __init__(self, message: str, code: str = "unreadable") -> None:
        super().__init__(message)
        self.code = code


@dataclass
class _Word:
    text: str
    x0: float
    x1: float
    top: float

    @property
    def centre(self) -> float:
        return (self.x0 + self.x1) / 2


@dataclass
class _Line:
    words: list[_Word]
    page: int

    @property
    def text(self) -> str:
        return " ".join(word.text for word in self.words)


@dataclass
class RawRow:
    occurred_on: date
    description: str
    amount: Decimal
    type: str  # income | expense
    balance: Decimal | None = None
    direction_source: str = "column"  # column | balance | marker | narration
    page: int = 1


@dataclass
class BalanceCheck:
    status: str  # verified | mismatch | partial | unchecked
    rows_checked: int = 0
    mismatches: int = 0
    detail: str = ""


@dataclass
class ParsedStatement:
    rows: list[RawRow]
    statement_type: str  # bank | credit_card
    bank: str | None
    account_last4: str | None
    opening_balance: Decimal | None
    closing_balance: Decimal | None
    pages: int
    check: BalanceCheck
    warnings: list[str] = field(default_factory=list)


# ---------- helpers ----------

def parse_money(text: str) -> tuple[Decimal, str | None] | None:
    raw = text.strip()
    currency = _CURRENCY_MONEY.match(raw.replace(" ", ""))
    if currency:
        try:
            value = Decimal(currency.group("num").replace(",", ""))
        except InvalidOperation:
            return None
        marker = (currency.group("marker") or "").lower() or None
        if currency.group("sign") == "+":
            marker = marker or "cr"
        elif currency.group("sign") == "-":
            marker = marker or "dr"
        return value, marker
    token = raw.replace("₹", "")
    match = _MONEY.match(token)
    if not match:
        return None
    marker = match.group(1).lower() if match.group(1) else None
    number = token[: len(token) - len(match.group(1))] if match.group(1) else token
    negative = number.startswith("-") or (number.startswith("(") and number.endswith(")"))
    number = number.strip("()-").replace(",", "")
    try:
        value = Decimal(number)
    except InvalidOperation:
        return None
    if negative:
        marker = marker or "dr"
    return value, marker


def _parse_date_text(text: str) -> date | None:
    cleaned = text.strip().rstrip(",").replace(".", "/")
    cleaned = re.sub(r"\s+", " ", cleaned)
    formats = (
        "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y", "%Y-%m-%d",
        "%d-%b-%Y", "%d-%b-%y", "%d/%b/%Y", "%d/%b/%y", "%d %b %Y", "%d %b %y",
        "%d %B %Y", "%d-%B-%Y", "%d %b, %Y",
    )
    for fmt in formats:
        try:
            parsed = datetime.strptime(cleaned.replace("Sept", "Sep").replace("sept", "sep"), fmt).date()
        except ValueError:
            continue
        if 2000 <= parsed.year <= 2100:
            return parsed
    return None


def _leading_date(words: list[_Word]) -> tuple[date, int] | None:
    """Return the date a line starts with and how many words it used."""
    if not words:
        return None
    first = words[0].text
    if _DATE_ONE_TOKEN.match(first):
        parsed = _parse_date_text(first)
        if parsed:
            return parsed, 1
    if len(words) >= 3 and _DAY.match(first) and _MONTH.match(words[1].text) and _YEAR.match(words[2].text):
        parsed = _parse_date_text(f"{first.rstrip(',')} {words[1].text.rstrip(',')[:3]} {words[2].text.rstrip(',')}")
        if parsed:
            return parsed, 3
    # Month first, as UPI apps print it: "Oct 01, 2026".
    if len(words) >= 3 and _MONTH.match(first) and _DAY.match(words[1].text) and _YEAR.match(words[2].text):
        parsed = _parse_date_text(f"{words[1].text.rstrip(',')} {first.rstrip(',')[:3]} {words[2].text.rstrip(',')}")
        if parsed:
            return parsed, 3
    return None


def _group_lines(page_words: list[dict], page_number: int) -> list[_Line]:
    words = [
        _Word(text=str(w["text"]), x0=float(w["x0"]), x1=float(w["x1"]), top=float(w["top"]))
        for w in page_words
        if str(w.get("text", "")).strip()
    ]
    words.sort(key=lambda w: (round(w.top, 1), w.x0))
    lines: list[_Line] = []
    current: list[_Word] = []
    current_top: float | None = None
    for word in words:
        if current_top is None or abs(word.top - current_top) <= 3:
            current.append(word)
            current_top = word.top if current_top is None else current_top
        else:
            lines.append(_Line(words=sorted(current, key=lambda w: w.x0), page=page_number))
            current = [word]
            current_top = word.top
    if current:
        lines.append(_Line(words=sorted(current, key=lambda w: w.x0), page=page_number))
    return lines


@dataclass
class _Columns:
    debit: float | None = None
    credit: float | None = None
    balance: float | None = None
    amount: float | None = None
    # Left edge of an "Account" column that UPI apps print between the
    # payee and the amount (the bank account the money came from).
    account: float | None = None

    @property
    def usable(self) -> bool:
        return (self.debit is not None and self.credit is not None) or self.amount is not None


def _header_columns(line: _Line) -> _Columns | None:
    lowered = line.text.lower()
    if "date" not in lowered:
        return None
    columns = _Columns()
    for word in line.words:
        token = word.text.lower().strip(".:()")
        is_debit = token == "dr" or any(token.startswith(h) for h in DEBIT_HEADERS if len(h) > 2)
        is_credit = token == "cr" or any(token.startswith(h) for h in CREDIT_HEADERS if len(h) > 2)
        if is_debit:
            if columns.debit is None:
                columns.debit = word.centre
        elif is_credit:
            if columns.credit is None:
                columns.credit = word.centre
        elif columns.balance is None and token in BALANCE_HEADERS:
            columns.balance = word.centre
        elif columns.amount is None and token in AMOUNT_HEADERS:
            columns.amount = word.centre
        elif columns.account is None and token == "account":
            columns.account = word.x0
    return columns if columns.usable else None


def _in_account_column(word: _Word, columns: _Columns | None, statement_type: str) -> bool:
    return (
        statement_type == "upi_app"
        and columns is not None
        and columns.account is not None
        and word.x0 >= columns.account - 2
    )


def _money_spans(words: list[_Word]) -> list[tuple[_Word, Decimal, str | None, set[int]]]:
    """Find amounts in a line. Each result has the word that marks its
    position, the value, a direction marker ("cr"/"dr") if one is printed
    next to it, and the ids of every word it used."""
    found: list[tuple[_Word, Decimal, str | None, set[int]]] = []
    index = 0
    while index < len(words):
        word = words[index]
        used = {id(word)}
        parsed = parse_money(word.text)
        if parsed is None and _CURRENCY_ONLY.match(word.text) and index + 1 < len(words):
            parsed = parse_money(word.text + words[index + 1].text)
            if parsed is not None:
                index += 1
                word = words[index]
                used.add(id(word))
        if parsed is None:
            index += 1
            continue
        value, marker = parsed
        start = index - (len(used) - 1)
        if marker is None and start > 0 and words[start - 1].text in {"+", "-", "−"}:
            marker = "cr" if words[start - 1].text == "+" else "dr"
            used.add(id(words[start - 1]))
        if marker is None and index + 1 < len(words) and _MARKER.match(words[index + 1].text):
            marker = words[index + 1].text.lower().rstrip(".")[:2]
            used.add(id(words[index + 1]))
        before = index - len(used) if len(used) > 1 else index - 1
        for neighbour in (index + 1, before):
            if marker is None and 0 <= neighbour < len(words) and _TYPE_WORD.match(words[neighbour].text):
                text = words[neighbour].text.lower()
                marker = "cr" if text in {"credit", "credited", "received"} else "dr"
                used.add(id(words[neighbour]))
        found.append((word, value, marker, used))
        index += 1
    return found


def _amount_tokens(words: list[_Word]) -> list[tuple[_Word, Decimal, str | None]]:
    return [(word, value, marker) for word, value, marker, _ in _money_spans(words)]


def _nearest(centre: float, options: dict[str, float | None]) -> str | None:
    best: tuple[float, str] | None = None
    for name, x in options.items():
        if x is None:
            continue
        distance = abs(centre - x)
        if best is None or distance < best[0]:
            best = (distance, name)
    return best[1] if best else None


def _detect_bank(text: str) -> str | None:
    # The bank's own name is normally printed first, before any narration
    # that mentions another bank (for example "SBI ATM" on an HDFC statement).
    best: tuple[int, str] | None = None
    for pattern, name in BANKS:
        match = pattern.search(text)
        if match and (best is None or match.start() < best[0]):
            best = (match.start(), name)
    return best[1] if best else None


def _detect_upi_app(text: str) -> str | None:
    best: tuple[int, str] | None = None
    for pattern, name in UPI_APPS:
        match = pattern.search(text)
        if match and (best is None or match.start() < best[0]):
            best = (match.start(), name)
    return best[1] if best else None


def _detect_last4(text: str, statement_type: str) -> str | None:
    if statement_type == "credit_card":
        card = re.search(r"\b(?:\d{4}|[xX*]{4})[\s\-]?(?:[\dxX*]{4}[\s\-]?){2}(\d{4})\b", text)
        if card:
            return card.group(1)
    account = re.search(
        r"(?:a/?c|account)\s*(?:no\.?|number|#)?\s*[:\-]?\s*[xX*\d]*?(\d{4})\b", text, re.I
    )
    return account.group(1) if account else None


def _summary_balance(lines: list[_Line], label: str) -> Decimal | None:
    for line in lines:
        lowered = line.text.lower()
        if label in lowered and not _leading_date(line.words):
            amounts = _amount_tokens(line.words)
            if amounts:
                return amounts[0][1]
    return None


def _direction_hint(description: str) -> str | None:
    lowered = description.lower()
    if re.search(r"^(paid\s+to|sent\s+to|money\s+sent|payment\s+to|bill\s+paid|recharge)", lowered):
        return "expense"
    if re.search(r"^(received\s+from|money\s+received|cashback|refund)", lowered):
        return "income"
    if re.search(r"(/cr/|\bcr\b|credited|by transfer|\bdeposit|salary|refund|reversal|cashback|interest|int\.pd)", lowered):
        return "income"
    if re.search(r"(/dr/|\bdr\b|debited|to transfer|withdrawal|\bpos\b|\batm\b|purchase)", lowered):
        return "expense"
    return None


# ---------- main entry point ----------

def _open_pdf(content: bytes, password: str | None):
    import pdfplumber
    from pdfminer.pdfdocument import PDFPasswordIncorrect

    try:
        pdf = pdfplumber.open(io.BytesIO(content), password=password or "")
        # Touch the first page so encryption and structure errors surface here.
        if pdf.pages:
            _ = pdf.pages[0].width
        return pdf
    except Exception as exc:  # pdfplumber wraps pdfminer errors
        chain: list[BaseException] = []
        current: BaseException | None = exc
        while current is not None and len(chain) < 6:
            chain.append(current)
            current = current.__cause__ or current.__context__
        if any(isinstance(item, PDFPasswordIncorrect) for item in chain) or "password" in str(exc).lower():
            if password:
                raise StatementError("That password did not open the PDF. Check it and try again.", "password_incorrect") from None
            raise StatementError("This PDF is password protected. Enter its password to read it.", "password_required") from None
        raise StatementError("This file could not be read as a PDF.", "unreadable") from None


def read_statement(content: bytes, password: str | None = None) -> ParsedStatement:
    if not content.startswith(b"%PDF"):
        raise StatementError("Choose a PDF statement file.", "not_pdf")
    pdf = _open_pdf(content, password)
    try:
        page_count = len(pdf.pages)
        if page_count == 0:
            raise StatementError("The PDF has no pages.")
        warnings: list[str] = []
        if page_count > MAX_PAGES:
            warnings.append(f"Only the first {MAX_PAGES} of {page_count} pages were read.")
        lines: list[_Line] = []
        full_text_parts: list[str] = []
        for number, page in enumerate(pdf.pages[:MAX_PAGES], start=1):
            # Some apps print every character twice to fake bold text.
            page = page.dedupe_chars(tolerance=1)
            words = page.extract_words(x_tolerance=1.5, y_tolerance=3, keep_blank_chars=False)
            page_lines = _group_lines(words, number)
            lines.extend(page_lines)
            full_text_parts.extend(line.text for line in page_lines[:400])
    finally:
        pdf.close()

    full_text = "\n".join(full_text_parts)
    if not full_text.strip():
        raise StatementError(
            "No text was found in this PDF. It may be a scanned image; download the statement as a "
            "text PDF from your bank instead.",
            "no_text",
        )
    lowered_text = full_text.lower()
    upi_app = _detect_upi_app(full_text[:3000])
    if "credit card" in lowered_text and re.search(
        r"(minimum\s+amount\s+due|total\s+amount\s+due|payment\s+due\s+date)", lowered_text
    ):
        statement_type = "credit_card"
    elif upi_app and not re.search(r"(withdrawal|deposit)", lowered_text[:3000]):
        statement_type = "upi_app"
    else:
        statement_type = "bank"

    columns: _Columns | None = None
    rows: list[RawRow] = []
    continuation = 0
    last_row_line: _Line | None = None
    for line in lines:
        header = _header_columns(line)
        if header is not None:
            columns = header
            last_row_line = None
            continue
        lowered = line.text.lower()
        dated = _leading_date(line.words)
        amounts = _amount_tokens(line.words)
        if dated and amounts:
            when, used = dated
            rest = line.words[used:]
            # Skip a second (value) date column if present.
            second = _leading_date(rest)
            if second:
                rest = rest[second[1]:]
            # A time printed after the date ("10:23 AM") is not narration.
            while rest and _TIME.match(rest[0].text):
                rest = rest[1:]
            skip: set[int] = set()
            for _, _, _, used_ids in _money_spans(rest):
                skip |= used_ids
            description_words = [w for w in rest if id(w) not in skip and not _in_account_column(w, columns, statement_type)]
            description = " ".join(w.text for w in description_words).strip()
            if any(stop in lowered for stop in ("opening balance", "closing balance", "brought forward", "b/f")) and not description.strip("-"):
                continue
            if "opening balance" in description.lower() or "brought forward" in description.lower():
                continue
            row_amounts = _amount_tokens(rest)
            row = _row_from_amounts(when, description, row_amounts, columns, rows, statement_type, line.page)
            if row is not None:
                rows.append(row)
                last_row_line = line
                continuation = 0
                if len(rows) >= MAX_ROWS:
                    warnings.append(f"Only the first {MAX_ROWS} rows were read.")
                    break
            continue
        # Wrapped narration under the previous row.
        if (
            rows
            and last_row_line is not None
            and line.page == last_row_line.page
            and not dated
            and not amounts
            and continuation < 3
            and not any(stop in lowered for stop in STOP_WORDS)
            and not _UPI_META.match(line.text.strip())
            and abs(line.words[0].top - last_row_line.words[0].top) < 40 * (continuation + 1)
        ):
            extra = " ".join(w.text for w in line.words if not _in_account_column(w, columns, statement_type))
            if extra:
                rows[-1].description = f"{rows[-1].description} {extra}".strip()
            continuation += 1
        else:
            last_row_line = None if dated or amounts else last_row_line

    opening = _summary_balance(lines, "opening balance")
    closing = _summary_balance(lines, "closing balance")
    if statement_type == "credit_card":
        opening = opening or _summary_balance(lines, "previous balance")
        closing = closing or _summary_balance(lines, "total amount due") or _summary_balance(lines, "total dues")

    _fix_directions_from_balance(rows, opening)
    check = _check_balances(rows, opening, closing, statement_type)
    if not rows:
        warnings.append(
            "No transactions were found. FinSight reads text statements with a date at the start of each row."
        )
    last4 = _detect_last4(full_text[:4000], statement_type)
    return ParsedStatement(
        rows=rows,
        statement_type=statement_type,
        bank=upi_app if statement_type == "upi_app" else _detect_bank(full_text[:6000]),
        account_last4=last4,
        opening_balance=opening,
        closing_balance=closing,
        pages=min(page_count, MAX_PAGES),
        check=check,
        warnings=warnings,
    )


def _row_from_amounts(
    when: date,
    description: str,
    amounts: list[tuple[_Word, Decimal, str | None]],
    columns: _Columns | None,
    previous: list[RawRow],
    statement_type: str,
    page: int,
) -> RawRow | None:
    if not amounts:
        return None
    amount: Decimal | None = None
    txn_type: str | None = None
    balance: Decimal | None = None
    source = "column"

    if columns is not None and columns.usable:
        options = {
            "debit": columns.debit,
            "credit": columns.credit,
            "balance": columns.balance,
            "amount": columns.amount,
        }
        for word, value, marker in amounts:
            slot = _nearest(word.centre, options)
            if slot == "balance":
                balance = -value if marker == "dr" and statement_type == "bank" else value
            elif slot in {"debit", "credit"} and value > 0 and amount is None:
                amount, txn_type = value, "expense" if slot == "debit" else "income"
            elif slot == "amount" and value > 0 and amount is None:
                amount = value
                if marker:
                    txn_type = "income" if marker == "cr" else "expense"
                    source = "marker"
                else:
                    # One amount column with no Cr/Dr: the wording decides
                    # ("Received from", "Refund"), otherwise it is spending.
                    hint = _direction_hint(description)
                    txn_type = hint or "expense"
                    source = "narration" if hint else "column"
    if amount is None:
        source = "balance"
        values = [(value, marker) for _, value, marker in amounts]
        if len(values) >= 2:
            amount, marker = values[-2]
            balance = values[-1][0]
            txn_type = "income" if marker == "cr" else "expense" if marker == "dr" else None
            if txn_type is not None:
                source = "marker"
        else:
            amount, marker = values[0]
            txn_type = "income" if marker == "cr" else "expense" if marker == "dr" else None
            source = "marker" if txn_type else "narration"
        if txn_type is None:
            txn_type = _direction_hint(description) or "expense"
            if source != "balance":
                source = "narration"
    if amount is None or amount <= 0:
        return None
    return RawRow(
        occurred_on=when,
        description=description or "Statement entry",
        amount=amount,
        type=txn_type or "expense",
        balance=balance,
        direction_source=source,
        page=page,
    )


def _fix_directions_from_balance(rows: list[RawRow], opening: Decimal | None) -> None:
    """Where the direction was guessed, let the running balance decide it."""
    previous = opening
    for row in rows:
        if row.balance is not None and previous is not None and row.direction_source in {"balance", "narration"}:
            if abs((previous - row.amount) - row.balance) <= TOLERANCE:
                row.type = "expense"
                row.direction_source = "balance"
            elif abs((previous + row.amount) - row.balance) <= TOLERANCE:
                row.type = "income"
                row.direction_source = "balance"
        if row.balance is not None:
            previous = row.balance
    # The first row has no previous balance unless the statement printed an
    # opening balance; infer it from the second row when possible.
    if rows and opening is None and rows[0].balance is not None and rows[0].direction_source in {"balance", "narration"}:
        hint = _direction_hint(rows[0].description)
        if hint:
            rows[0].type = hint


def _check_balances(
    rows: list[RawRow], opening: Decimal | None, closing: Decimal | None, statement_type: str
) -> BalanceCheck:
    if not rows:
        return BalanceCheck(status="unchecked", detail="No rows to check.")
    checked = 0
    mismatches = 0
    previous = opening
    for row in rows:
        if row.balance is not None and previous is not None:
            sign = 1 if row.type == "income" else -1
            if statement_type == "credit_card":
                sign = -sign
            checked += 1
            if abs(previous + sign * row.amount - row.balance) > TOLERANCE:
                mismatches += 1
        if row.balance is not None:
            previous = row.balance

    total_ok: bool | None = None
    if opening is not None and closing is not None:
        credits = sum((row.amount for row in rows if row.type == "income"), Decimal("0"))
        debits = sum((row.amount for row in rows if row.type == "expense"), Decimal("0"))
        expected = opening + credits - debits if statement_type == "bank" else opening + debits - credits
        total_ok = abs(expected - closing) <= TOLERANCE

    if checked == 0 and total_ok is None:
        return BalanceCheck(
            status="unchecked",
            detail="The statement has no running balance or opening and closing totals to check against.",
        )
    if mismatches == 0 and total_ok is not False:
        parts = []
        if checked:
            parts.append(f"all {checked} rows match the running balance")
        if total_ok:
            parts.append("opening plus credits minus debits equals the closing balance")
        return BalanceCheck(status="verified", rows_checked=checked, detail="Checked: " + " and ".join(parts) + ".")
    detail = []
    if mismatches:
        detail.append(f"{mismatches} of {checked} rows do not match the running balance")
    if total_ok is False:
        detail.append("the totals do not add up to the closing balance")
    return BalanceCheck(
        status="mismatch",
        rows_checked=checked,
        mismatches=mismatches,
        detail="Review before importing: " + " and ".join(detail) + ". A row may have been read wrongly or missed.",
    )
