"""Spreadsheet-safe CSV cells.

Spreadsheet apps evaluate cells starting with ``=``, ``+``, ``-``, ``@``, tab,
or carriage return as formulas. User-entered text (merchants, notes) and AI
responses (which often start with "- " bullets) are prefixed with an
apostrophe so they display as text and cannot run formulas (CSV injection).
Apply this to free-text columns only; numeric columns are written as numbers.
"""

from __future__ import annotations

FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def csv_text(value: object) -> str:
    text = "" if value is None else str(value)
    if text.startswith(FORMULA_PREFIXES):
        return "'" + text
    return text
