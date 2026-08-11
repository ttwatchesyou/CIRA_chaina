function withoutTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function configuredOrigin(value: string | undefined) {
  if (!value?.trim()) return null;
  try {
    return withoutTrailingSlash(new URL(value.trim()).origin);
  } catch {
    return null;
  }
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim().replace(/^"|"$/g, "") || null;
}

function forwardedValues(value: string | null) {
  const values = new Map<string, string>();
  for (const part of value?.split(",")[0]?.split(";") || []) {
    const [name, ...rawValue] = part.trim().split("=");
    const headerValue = rawValue.join("=").trim().replace(/^"|"$/g, "");
    if (name && headerValue) values.set(name.toLowerCase(), headerValue);
  }
  return values;
}

function originFrom(protocol: string | null, host: string | null) {
  if (!protocol || !host) return null;
  try {
    const url = new URL(`${protocol.replace(/:$/, "")}://${host}`);
    return withoutTrailingSlash(url.origin);
  } catch {
    return null;
  }
}

function isLoopbackOrigin(value: string) {
  const hostname = new URL(value).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/**
 * Returns the address seen by the caller, including reverse-proxy headers.
 * A configured URL is only a fallback for requests received on loopback, so a
 * copied .env cannot make links point back to the machine where it was created.
 */
export function requestAppUrl(request: Request, fallbackUrl?: string) {
  const requestUrl = new URL(request.url);
  const forwarded = forwardedValues(request.headers.get("forwarded"));
  const protocol = forwarded.get("proto")
    || firstHeaderValue(request.headers.get("x-forwarded-proto"))
    || requestUrl.protocol.replace(/:$/, "");
  const host = forwarded.get("host")
    || firstHeaderValue(request.headers.get("x-forwarded-host"))
    || firstHeaderValue(request.headers.get("host"))
    || requestUrl.host;
  const requestOrigin = originFrom(protocol, host) || withoutTrailingSlash(requestUrl.origin);

  if (!isLoopbackOrigin(requestOrigin)) return requestOrigin;
  return configuredOrigin(fallbackUrl) || requestOrigin;
}

export function publicAppUrl(request: Request) {
  return requestAppUrl(request, process.env.PUBLIC_APP_URL);
}
