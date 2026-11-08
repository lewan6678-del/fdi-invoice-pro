"use client";
import type { ApiErrorShape } from "@/components/ui/alert";

export class ApiError extends Error {
  constructor(public info: ApiErrorShape, public status: number) {
    super(info.message);
  }
}

export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError({ message: "Không kết nối được máy chủ.", hint: "Kiểm tra kết nối Internet rồi thử lại." }, 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !url.includes("/api/auth/login")) window.location.href = "/login";
    throw new ApiError(data.error ?? { message: `Lỗi máy chủ (${res.status}).`, hint: "Thử lại sau ít phút." }, res.status);
  }
  return data as T;
}
