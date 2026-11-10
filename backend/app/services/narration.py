"""Turn Indian bank statement narrations into a merchant, payment method and
category.

A narration is the free-text description a bank prints for each row, such as
``UPI/DR/412345678901/SWIGGY/YESB/swiggy@yespay/Payment`` or
``NEFT-N123456789-ACME TECHNOLOGIES PVT LTD-HDFC0000123``. Each bank uses its
own layout, so the parser removes the parts that are never the counterparty
(channel words, reference numbers, IFSC and bank codes, UPI handles) and keeps
the first readable name that is left.

Everything here is deterministic and runs offline: no data leaves the server.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Words that describe the channel or direction, never the counterparty.
_NOISE_WORDS = {
    "upi", "dr", "cr", "p2a", "p2m", "p2p", "neft", "imps", "rtgs", "ach", "nach", "ecs", "mb", "ib",
    "inb", "net", "netbanking", "mobile", "banking", "to", "by", "from", "transfer", "trf", "txn",
    "transaction", "payment", "pay", "paid", "via", "ref", "refno", "no", "na", "null", "inward",
    "outward", "debit", "credit", "pos", "ecom", "vps", "ips", "mmt", "bil", "billpay", "onl",
    "online", "collect", "request", "sent", "using", "app", "upiintent", "intent", "ok", "self",
    "others", "other", "chq", "cheque", "clg", "deposit", "fund", "funds", "remarks", "tp", "d",
}
# Short names that read better in capitals.
_ACRONYMS = {
    "irctc", "kfc", "act", "hp", "bpcl", "hpcl", "iocl", "lic", "sbi", "hdfc", "icici", "llp", "ltd",
    "pvt", "upi", "atm", "emi", "gst", "dth", "bsnl", "bses", "tneb", "oyo", "h&m", "uk", "us", "it",
}
# Four-letter bank codes that appear on their own in UPI and IMPS narrations.
_BANK_CODES = {
    "sbin", "hdfc", "icic", "utib", "kkbk", "yesb", "pytm", "airp", "barb", "punb", "cnrb", "ubin",
    "idib", "ioba", "indb", "fdrl", "idfb", "aubl", "ratn", "sibl", "kvbl", "cbin", "bkid", "mahb",
    "jaka", "esfb", "fino", "jsfb", "ucba", "psib", "dbss", "scbl", "citi", "hsbc", "axis", "icici",
    "kotak", "paytm", "ybl", "ibl", "axl", "okaxis", "okhdfcbank", "okicici", "oksbi", "apl",
}
_IFSC = re.compile(r"^[a-z]{4}0[a-z0-9]{6}$", re.I)
_DIGITS = re.compile(r"^[\d\-:.]+$")
_REF_LIKE = re.compile(r"^(?=.*\d)[a-z0-9]{10,}$", re.I)
_SPLIT = re.compile(r"[/|\\*]+|\s-\s|(?<=\w)-(?=\w)|\s{2,}")

# (pattern, merchant label) for rows that are never real spending or income
# but money moving between your own accounts.
TRANSFER_RULES: list[tuple[re.Pattern[str], str, str]] = [
    (re.compile(r"\b(atm|nwd|atw|cash\s*wdl|cash\s*withdrawal|awb)\b", re.I), "ATM cash withdrawal", "Cash"),
    (
        re.compile(
            r"(credit\s*card\s*(payment|bill)|\bcc\s*(payment|bill|pmt)\b|card\s*bill|"
            r"\bcred\s*club\b|\bcred\b.*\b(card|bill)\b|billdesk.*card|autopay.*card|"
            r"payment\s*received.*thank|thank\s*you.*payment|\bbbps\b.*card)",
            re.I,
        ),
        "Credit card bill payment",
        "Net Banking",
    ),
    (re.compile(r"\b(self\s*transfer|own\s*account|to\s*self|sweep|fd\s*(booking|creation))\b", re.I), "Own account transfer", "Net Banking"),
]

# (keywords, category slug). Checked against the merchant and narration, in order.
EXPENSE_RULES: list[tuple[tuple[str, ...], str]] = [
    (("swiggy", "zomato", "dominos", "domino's", "pizza", "mcdonald", "kfc", "burger", "cafe", "coffee",
      "starbucks", "chai", "restaurant", "hotel saravana", "haldiram", "eatsure", "biryani", "bakery",
      "pizzaa", "eatclub", "chicken", "ice cream", "icecream", "sweet", "sweets", "nasta", "dhaba", "mess", "canteen",
      "juice", "snacks", "food", "vada pav", "misal", "tea stall"), "food-dining"),
    (("bigbasket", "blinkit", "zepto", "instamart", "dmart", "d mart", "jiomart", "grofers", "reliance fresh",
      "more retail", "spencer", "nature's basket", "kirana", "grocery", "supermarket", "milkbasket", "country delight",
      "super market", "dairy", "general store", "provision", "kirana store", "vegetable", "fruits"), "groceries"),
    (("uber", "ola", "rapido", "irctc", "metro", "redbus", "fastag", "petrol", "diesel", "fuel", "hpcl",
      "bpcl", "indian oil", "iocl", "shell", "parking", "namma yatri", "blusmart",
      "pmpml", "bmtc", "best bus", "ksrtc", "msrtc"), "transport"),
    (("netflix", "spotify", "hotstar", "disney", "prime video", "amazon prime", "youtube premium", "jiocinema",
      "sonyliv", "zee5", "apple.com", "google play", "icloud", "chatgpt", "openai", "notion", "subscription"), "subscriptions"),
    (("airtel", "jio", "vodafone", "vi prepaid", "bsnl", "electricity", "bescom", "msedcl", "tata power",
      "adani electricity", "bses", "tneb", "water bill", "gas bill", "indane", "hp gas", "bharat gas",
      "broadband", "act fibernet", "hathway", "recharge", "dth", "tata play"), "utilities"),
    (("apollo", "pharmeasy", "netmeds", "1mg", "medplus", "hospital", "clinic", "diagnostic", "pharmacy",
      "chemist", "medical", "practo", "lal path", "dr lal", "thyrocare"), "healthcare"),
    (("makemytrip", "goibibo", "cleartrip", "yatra", "indigo", "air india", "vistara", "spicejet", "akasa",
      "oyo", "airbnb", "booking.com", "agoda", "ixigo"), "travel"),
    (("udemy", "coursera", "byju", "unacademy", "college", "school", "university", "tuition", "exam fee",
      "fees", "vedantu", "physics wallah", "books", "xerox", "stationery"), "education"),
    (("rent", "nobroker", "housing.com", "landlord", "pg ", "hostel"), "rent"),
    (("amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa", "tatacliq", "croma", "reliance digital",
      "decathlon", "ikea", "lifestyle", "shoppers stop", "westside", "zara", "h&m", "lenskart", "purplle"), "shopping"),
]
INCOME_RULES: list[tuple[tuple[str, ...], str]] = [
    (("salary", "sal ", "payroll", "sal/", "sal-"), "salary"),
    (("stipend", "scholarship", "internship"), "stipend"),
    (("upwork", "fiverr", "freelance", "invoice", "consulting", "payoneer"), "freelance-income"),
    (("interest", "int.pd", "int pd", "int.coll", "cashback", "refund", "reversal", "dividend"), "other-income"),
]
CHARGE_WORDS = re.compile(r"\b(chrg|chg|charges?|fee|gst|sms\s*alert|amc|penalty|min\s*bal)\b", re.I)


_APP_PHRASE = re.compile(
    r"^(?:paid\s+to|sent\s+to|money\s+sent\s+to|payment\s+to|transferred\s+to|received\s+from|"
    r"money\s+received\s+from|bill\s+paid\s*[-:]?|recharged?\s*(?:of|for)?|paid\s+for)\s*(?P<payee>.+)$",
    re.I,
)
_APP_DETAILS = re.compile(
    r"\s+(?:transaction\s*id|txn\s*id|utr|upi\s*(?:ref|transaction)|paid\s*by|debited\s*from|credited\s*to|"
    r"order\s*id|bank\s*reference|\d{1,2}:\d{2})",
    re.I,
)


@dataclass
class Narration:
    merchant: str
    payment_method: str
    vpa: str | None = None
    transfer_reason: str | None = None


def _title(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip(" .,-_*:")
    words = []
    for word in value.split():
        lowered = word.lower()
        if lowered in {"ltd", "pvt"}:
            words.append(lowered.capitalize())
        elif lowered in _ACRONYMS:
            words.append(word.upper())
        else:
            words.append(word[:1].upper() + word[1:].lower())
    return " ".join(words)


def payment_method_for(text: str) -> str:
    lowered = text.lower()
    if "upi" in lowered:
        return "UPI"
    if re.search(r"\b(atm|nwd|atw|cash)\b", lowered):
        return "Cash"
    if re.search(r"\b(nach|ach|ecs|si|autopay|auto\s*debit|mandate)\b", lowered):
        return "Auto Debit"
    if re.search(r"\b(pos|ecom|vps|ips|debit\s*card|card)\b", lowered):
        return "Debit Card"
    if re.search(r"\b(neft|imps|rtgs|ib|inb|net\s*banking|mb|fund\s*transfer|trf)\b", lowered):
        return "Net Banking"
    return "Other"


def _is_noise(token: str) -> bool:
    clean = token.strip(" .,:;*#()[]").lower()
    if not clean or len(clean) < 2:
        return True
    if clean in _NOISE_WORDS or clean in _BANK_CODES:
        return True
    if _DIGITS.match(clean) or _IFSC.match(clean) or _REF_LIKE.match(clean):
        return True
    if "@" in clean:
        return True
    # Mostly digits (e.g. masked card numbers like XXXX1234).
    letters = sum(ch.isalpha() for ch in clean)
    if letters < 2 or re.fullmatch(r"x+\d+", clean):
        return True
    return False


def parse_narration(text: str, statement_type: str = "bank") -> Narration:
    raw = re.sub(r"\s+", " ", text or "").strip()
    method = payment_method_for(raw)
    if statement_type == "credit_card":
        method = "Credit Card"
    elif statement_type == "upi_app":
        method = "UPI"

    # UPI apps describe each payment in words: "Paid to Swiggy",
    # "Received from Amit Kumar", "Bill paid - Airtel". The payee is the text
    # after the verb, up to the detail fields printed after it.
    if re.match(r"^cashback\b", raw, re.I):
        return Narration(merchant="Cashback", payment_method=method)
    if re.match(r"^(mobile\s+|dth\s+|fastag\s+)?recharg", raw, re.I):
        kind = raw.split()[0].lower()
        label = {"dth": "DTH recharge", "fastag": "FASTag recharge"}.get(kind, "Mobile recharge")
        return Narration(merchant=label, payment_method="UPI" if statement_type == "upi_app" else method)
    app_style = _APP_PHRASE.match(raw)
    if app_style:
        payee = _APP_DETAILS.split(app_style.group("payee"))[0]
        payee = re.sub(r"\s+(xx|\*\*)\d{2,}.*$", "", payee, flags=re.I).strip(" -:,")
        payee = re.sub(r"\s+upi$", "", payee, flags=re.I)
        if sum(ch.isalpha() for ch in payee) >= 2:
            if statement_type != "credit_card":
                method = "UPI" if statement_type == "upi_app" or "upi" in raw.lower() else method
            transfer = next((label for pattern, label, _ in TRANSFER_RULES if pattern.search(payee)), None)
            return Narration(
                merchant=_title(payee)[:80] if not transfer else transfer,
                payment_method=method,
                transfer_reason=transfer,
            )

    for pattern, label, transfer_method in TRANSFER_RULES:
        if pattern.search(raw):
            return Narration(
                merchant=label,
                payment_method=transfer_method if statement_type == "bank" else method,
                transfer_reason=label,
            )

    vpa_match = re.search(r"([a-z0-9.\-_]{2,})@([a-z]{2,})", raw, re.I)
    vpa = vpa_match.group(0).lower() if vpa_match else None

    if re.search(r"\b(int\.?\s*pd|interest|int\.?\s*coll|int\s*cr)\b", raw, re.I):
        return Narration(merchant="Interest", payment_method="Other", vpa=vpa)
    if CHARGE_WORDS.search(raw) and not re.search(r"\bupi\b", raw, re.I):
        return Narration(merchant="Bank charges", payment_method="Other", vpa=vpa)

    # Drop channel prefixes like "TO TRANSFER-" or "BY TRANSFER-" first.
    body = re.sub(r"^(to|by)\s+transfer\s*[-:]?\s*", "", raw, flags=re.I)
    tokens = [token.strip() for token in _SPLIT.split(body) if token and token.strip()]
    candidates: list[str] = []
    for token in tokens:
        words = [word for word in token.split() if not _is_noise(word)]
        if not words:
            continue
        candidates.append(" ".join(words))
    merchant = next((c for c in candidates if sum(ch.isalpha() for ch in c) >= 3), "")
    if not merchant and vpa:
        merchant = re.sub(r"[.\-_]+", " ", vpa.split("@")[0])
        merchant = re.sub(r"\d+", "", merchant).strip() or vpa
    if not merchant:
        merchant = raw[:60] or "Statement entry"
    return Narration(merchant=_title(merchant)[:80], payment_method=method, vpa=vpa)


def category_slug_for(text: str, txn_type: str) -> str | None:
    lowered = f" {text.lower()} "
    rules = INCOME_RULES if txn_type == "income" else EXPENSE_RULES
    for keywords, slug in rules:
        if any(_keyword_pattern(keyword).search(lowered) for keyword in keywords):
            return slug
    return None


_PATTERNS: dict[str, re.Pattern[str]] = {}


def _keyword_pattern(keyword: str) -> re.Pattern[str]:
    """Match a keyword as a whole word, so "ola" does not match "cola"."""
    pattern = _PATTERNS.get(keyword)
    if pattern is None:
        pattern = re.compile(r"(?<![a-z0-9])" + re.escape(keyword.strip()) + r"(?![a-z0-9])")
        _PATTERNS[keyword] = pattern
    return pattern
