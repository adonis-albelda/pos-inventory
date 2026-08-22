import type { ApiClient } from "../http";

export type PushPlatform = "ios" | "android" | "web";

/** Idempotent upsert — call once per token value, not on every app open (see apps/mobile/lib/push.ts). */
export async function registerPushToken(
  client: ApiClient,
  token: string,
  platform: PushPlatform,
): Promise<void> {
  await client.request<void>("/fcm-token", { method: "PUT", body: { token, platform } });
}

/** Called on logout — a signed-out session should stop getting pushes. */
export async function unregisterPushToken(client: ApiClient, token: string): Promise<void> {
  await client.request<void>("/fcm-token", { method: "DELETE", body: { token } });
}
