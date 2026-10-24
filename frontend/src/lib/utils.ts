import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const number = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
});

export function formatINR(value: number | null | undefined, compact = false) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return (compact ? inrCompact : inr).format(value);
}

export function formatNumber(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${number.format(value)}${suffix}`;
}

export function formatDate(value: string | null | undefined, pattern = "d MMM yyyy") {
  if (!value) return "—";
  try {
    return format(parseServerDate(value), pattern);
  } catch {
    return value;
  }
}

export function formatRelative(value: string | null | undefined) {
  if (!value) return "";
  try {
    return formatDistanceToNow(parseServerDate(value), { addSuffix: true });
  } catch {
    return "";
  }
}

function parseServerDate(value: string) {
  const normalised = value.includes(" ") ? value.replace(" ", "T") : value;
  const isDateTime = normalised.includes("T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalised);
  return parseISO(isDateTime && !hasTimezone ? `${normalised}Z` : normalised);
}

export function todayISO() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function currentMonthISO() {
  return `${todayISO().slice(0, 7)}-01`;
}

export function addMonthsISO(month: string, offset: number) {
  const date = parseISO(`${month.slice(0, 7)}-01`);
  const next = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  const offsetMinutes = next.getTimezoneOffset();
  return new Date(next.getTime() - offsetMinutes * 60_000).toISOString().slice(0, 10);
}

export function monthLabel(value: string) {
  if (!value) return "";
  try {
    return format(parseISO(`${value.slice(0, 7)}-01`), "MMMM yyyy");
  } catch {
    return value;
  }
}

export function monthShortLabel(value: string) {
  if (!value) return "";
  try {
    return format(parseISO(`${value.slice(0, 7)}-01`), "MMM yy");
  } catch {
    return value;
  }
}

export function percentage(value: number | null | undefined, suffix = "%") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${number.format(value)}${suffix}`;
}

export function deltaTone(value: number | null | undefined, inverse = false) {
  if (value === null || value === undefined || value === 0) return "neutral" as const;
  const positive = inverse ? value < 0 : value > 0;
  return positive ? ("positive" as const) : ("negative" as const);
}

export function appHref(path: string | null | undefined) {
  if (!path) return "/app";
  if (path.startsWith("/app")) return path;
  if (path === "/") return "/app";
  if (path.startsWith("/?")) return `/app${path.slice(1)}`;
  const known = [
    "/transactions",
    "/budgets",
    "/goals",
    "/analytics",
    "/scenarios",
    "/assistant",
    "/notifications",
    "/research",
    "/settings",
  ];
  const match = known.find((route) => path === route || path.startsWith(`${route}?`));
  if (match) return `/app${path}`;
  return "/app";
}

export function titleFromSlug(value: string) {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function parseStoredJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function downloadUrl(url: string, filename?: string) {
  const link = document.createElement("a");
  link.href = url;
  if (filename) link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function stripFileExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}
