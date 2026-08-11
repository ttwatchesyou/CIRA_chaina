function withoutTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function publicAppUrl(request: Request) {
  const configuredUrl = process.env.PUBLIC_APP_URL?.trim();
  if (configuredUrl) {
    try {
      return withoutTrailingSlash(new URL(configuredUrl).origin);
    } catch {
      // An invalid setting falls back to the current request origin in development.
    }
  }

  return withoutTrailingSlash(new URL(request.url).origin);
}
