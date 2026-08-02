// React Native has no global Buffer, and react-native-tcp-socket writes Buffers.
import { Buffer } from "buffer";
import type { LocalSaleWithItems } from "@double-a/shared-types";

import type TcpSocketDefault from "react-native-tcp-socket";

type TcpSocketModule = typeof TcpSocketDefault;

export interface PrinterTransport {
  readonly name: string;
  send: (payload: Uint8Array) => Promise<void>;
}

export interface PrinterSettings {
  /** "none" prints to the log, which keeps the sale flow testable in Expo Go. */
  kind: "none" | "network";
  host?: string;
  port?: number;
  /** Characters per line: 32 for 58mm paper, 48 for 80mm. */
  columns: number;
}

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  kind: "none",
  columns: 32,
};

/**
 * Preview transport. Used when no printer is configured, and on any build where
 * the native TCP module is unavailable (Expo Go).
 */
export function previewTransport(): PrinterTransport {
  return {
    name: "preview",
    async send(payload) {
      const text = Array.from(payload)
        .map((byte) => (byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : ""))
        .join("");
      console.warn(`[receipt preview]\n${text}`);
    },
  };
}

/**
 * LAN ESC/POS printer over a raw socket, port 9100 by default.
 *
 * react-native-tcp-socket is a native module, so this needs a dev client or a
 * release build — it will not run in Expo Go. The require is lazy and guarded so
 * that a missing module degrades to the preview transport instead of crashing a
 * sale.
 */
export function networkTransport(host: string, port = 9100): PrinterTransport {
  return {
    name: `network:${host}:${port}`,
    async send(payload) {
      let TcpSocket: TcpSocketModule;
      try {
        // Lazy and guarded: on a build without the native module (Expo Go) this
        // has to degrade to a preview, never throw inside a sale.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        TcpSocket = (require("react-native-tcp-socket") as { default: TcpSocketModule })
          .default;
      } catch {
        await previewTransport().send(payload);
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const socket = TcpSocket.createConnection({ host, port }, () => {
          socket.write(Buffer.from(payload));
          socket.end();
        });

        socket.on("close", () => resolve());
        socket.on("error", (error: Error) => reject(error));
      });
    },
  };
}

export function transportFor(settings: PrinterSettings): PrinterTransport {
  if (settings.kind === "network" && settings.host) {
    return networkTransport(settings.host, settings.port ?? 9100);
  }
  return previewTransport();
}

export type PrintableSale = LocalSaleWithItems;
