"use client";

import { usePushNotifications } from "@/lib/push";

/** Mounted once in the dashboard layout — never on the login page — so an authenticated admin session gets an FCM token on file. Renders nothing. */
export function PushNotificationRegistrar() {
  usePushNotifications();
  return null;
}
