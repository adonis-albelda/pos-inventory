"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getReceiptLayout, getStoreSettings } from "@double-a/api-client/queries";
import { getBrowserApiClient } from "@/lib/api/browser-client";
import { queryKeys } from "./keys";

/** The one store_settings row for the caller's company. */
export function useStoreSettings() {
  return useQuery({
    queryKey: queryKeys.storeSettings.detail(),
    queryFn: () => getStoreSettings(getBrowserApiClient()),
  });
}

/** The one receipt_layout row for the caller's company. */
export function useReceiptLayout() {
  return useQuery({
    queryKey: queryKeys.receiptLayout.detail(),
    queryFn: () => getReceiptLayout(getBrowserApiClient()),
  });
}

/** Call after saveStoreSettings/saveReceiptLayout (Server Actions) succeed — revalidatePath doesn't touch this cache. */
export function useInvalidateSettings() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.storeSettings.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.receiptLayout.all });
  };
}
