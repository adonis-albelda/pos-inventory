export interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

export function assertCredentials(
  url: string | undefined,
  anonKey: string | undefined,
  hint: string,
): SupabaseCredentials {
  if (!url || !anonKey) {
    throw new Error(
      `Supabase credentials are missing. Set ${hint} (see .env.example at the repo root).`,
    );
  }
  return { url, anonKey };
}
