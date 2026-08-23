import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof ZodError) {
    return jsonError(err.issues[0]?.message ?? "入力内容が正しくありません。", 400);
  }
  if (err instanceof Error) {
    return jsonError(err.message, 400);
  }
  return jsonError("予期しないエラーが発生しました。", 500);
}
