import { timingSafeEqual } from "node:crypto";

const DEVELOPMENT_WORKER_TOKEN = "ivp-local-worker-token";

export function isWorkerRequestAuthorized(request: Request) {
  const authorization = request.headers.get("authorization");
  const suppliedToken = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const expectedToken = process.env.WORKER_API_TOKEN || DEVELOPMENT_WORKER_TOKEN;
  if (!suppliedToken) return false;

  const supplied = Buffer.from(suppliedToken);
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

