import { NextResponse } from "next/server";

export type ApiSuccess<T> = {
  data: T;
};

export type ApiFailure = {
  error: {
    code: string;
    message: string;
    issues?: Record<string, string[] | undefined>;
  };
};

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ data }, { status });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  issues?: Record<string, string[] | undefined>,
) {
  return NextResponse.json<ApiFailure>({ error: { code, message, issues } }, { status });
}
