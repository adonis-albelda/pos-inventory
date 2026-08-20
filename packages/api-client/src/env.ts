export function assertApiUrl(url: string | undefined, hint: string): string {
  if (!url) {
    throw new Error(
      `Tally API base URL is missing. Set ${hint} (see .env.example at the repo root).`,
    );
  }
  return url.replace(/\/+$/, "");
}
