// React Native has no global Buffer, and react-native-tcp-socket writes Buffers.
import { Buffer } from "buffer";
import type { LocalSaleWithItems } from "@double-a/shared-types";
import { RECEIPT_COLUMNS } from "@double-a/shared-types";
import { ensureBluetoothPermissions } from "./bluetooth-permissions";

import type TcpSocketDefault from "react-native-tcp-socket";

type TcpSocketModule = typeof TcpSocketDefault;

export interface PrinterTransport {
  readonly name: string;
  send: (payload: Uint8Array) => Promise<void>;
}

export interface PrinterSettings {
  /** "none" prints to the log — useful before hardware arrives or in Expo Go. */
  kind: "none" | "network" | "bluetooth";
  host?: string;
  port?: number;
  /** Bluetooth MAC of the paired PT-210. */
  bluetoothAddress?: string;
  bluetoothName?: string;
  /** Always 32 for this shop's 58mm PT-210. */
  columns: number;
}

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  kind: "none",
  columns: RECEIPT_COLUMNS,
};

/**
 * Preview transport. Used when no printer is configured, and on any build where
 * the native module is unavailable (Expo Go).
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

type BluetoothPrinterModule = {
  connectDevice: (deviceId: string) => Promise<boolean>;
  printRaw: (base64Data: string) => Promise<boolean>;
  getConnectedDevice: () => { id: string; name: string } | null;
};

/**
 * Bluetooth Classic PT-210 via rn-bluetooth-classic-printer.
 * Sends the same ESC/POS bytes the network path uses — layout stays one builder.
 */
export function bluetoothTransport(address: string): PrinterTransport {
  return {
    name: `bluetooth:${address}`,
    async send(payload) {
      const allowed = await ensureBluetoothPermissions();
      if (!allowed) {
        throw new Error("Bluetooth permission not granted");
      }

      let Bluetooth: BluetoothPrinterModule;
      try {
        // Lazy: Expo Go / a build without the native module must not crash a sale.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        Bluetooth = require("rn-bluetooth-classic-printer") as BluetoothPrinterModule;
      } catch {
        await previewTransport().send(payload);
        return;
      }

      const connected = Bluetooth.getConnectedDevice();
      if (!connected || connected.id !== address) {
        await Bluetooth.connectDevice(address);
      }

      const base64 = Buffer.from(payload).toString("base64");
      await Bluetooth.printRaw(base64);
    },
  };
}

export function transportFor(settings: PrinterSettings): PrinterTransport {
  if (settings.kind === "bluetooth" && settings.bluetoothAddress) {
    return bluetoothTransport(settings.bluetoothAddress);
  }
  if (settings.kind === "network" && settings.host) {
    return networkTransport(settings.host, settings.port ?? 9100);
  }
  return previewTransport();
}

export type PrintableSale = LocalSaleWithItems;
