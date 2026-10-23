const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

type QueryValue = string | number | boolean | null | undefined;

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function buildQuery(params?: Record<string, QueryValue>) {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const isForm = init.body instanceof FormData;
  if (init.body && !isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      "Cannot reach the FinSight server. Check that the API is running and try again.",
      0,
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let details: unknown;
    try {
      details = await response.json();
      if (details && typeof details === "object" && "detail" in details) {
        const detail = (details as { detail: unknown }).detail;
        if (typeof detail === "string") {
          message = detail;
        } else if (Array.isArray(detail)) {
          message = detail
            .map((item) => {
              if (item && typeof item === "object" && "msg" in item) {
                return String((item as { msg: unknown }).msg);
              }
              return String(item);
            })
            .join("; ");
        }
      }
    } catch {
      message = response.statusText || message;
    }
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent("finsight:unauthorized"));
    }
    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return (await response.text()) as T;
  return (await response.json()) as T;
}

export const api = {
  get<T>(path: string) {
    return request<T>(path);
  },
  post<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  },
  put<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  patch<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  delete<T>(path: string) {
    return request<T>(path, { method: "DELETE" });
  },
  download(path: string) {
    return fetch(`${API_BASE}${path}`, { credentials: "include" }).then(async (response) => {
      if (!response.ok) {
        let message = "Download failed";
        try {
          const body = await response.json();
          if (body && typeof body.detail === "string") message = body.detail;
        } catch {
          // Keep the generic message when the server returns non-JSON content.
        }
        throw new ApiError(message, response.status);
      }
      return response.blob();
    });
  },
};

export async function downloadBlob(path: string, filename: string) {
  const blob = await api.download(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
