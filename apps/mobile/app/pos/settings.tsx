import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { timeAgo } from "@double-a/shared-types";
import { getSyncMeta } from "@/db/meta";
import { countLocalProducts } from "@/db/products";
import { countPendingSales } from "@/db/sales";
import { countLocalUsers } from "@/db/users";
import { getDeviceId, getDeviceLabel } from "@/lib/device";
import { useLayout } from "@/lib/layout";
import { useSession } from "@/lib/session";
import { useStoreSettings } from "@/lib/store";
import { useSync } from "@/sync/sync-provider";
import { buildReceipt, getPrinterSettings, savePrinterSettings } from "@/printing/receipt";
import { transportFor, type PrinterSettings } from "@/printing/transport";
import {
  Check,
  FileText,
  LogOut,
  Printer,
  Send,
  Smartphone,
  Store,
} from "lucide-react-native";
import { Badge, Button, Card, ErrorNote, SectionTitle, SuccessNote } from "@/components/ui";
import { color, fontSize, radius, space, styles } from "@/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const layout = useLayout();
  const { lock } = useSession();
  const { dataVersion } = useSync();
  const store = useStoreSettings();

  const [settings, setSettings] = useState<PrinterSettings | null>(null);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("9100");
  const [columns, setColumns] = useState("32");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [info, setInfo] = useState({
    deviceId: "",
    label: "",
    products: 0,
    users: 0,
    pending: 0,
    lastSyncedAt: null as string | null,
  });

  useEffect(() => {
    async function load() {
      const stored = await getPrinterSettings();
      setSettings(stored);
      setHost(stored.host ?? "");
      setPort(String(stored.port ?? 9100));
      setColumns(String(stored.columns));

      const [deviceId, label, products, users, pending, meta] = await Promise.all([
        getDeviceId(),
        getDeviceLabel(),
        countLocalProducts(),
        countLocalUsers(),
        countPendingSales(),
        getSyncMeta(),
      ]);

      setInfo({
        deviceId,
        label: label ?? "",
        products,
        users,
        pending,
        lastSyncedAt: meta.lastSyncedAt,
      });
    }

    void load();
    // Counts and "last synced" are stale the moment a pull finishes, and the
    // sync bar sits at the top of this screen too.
  }, [dataVersion]);

  async function save(kind: PrinterSettings["kind"]) {
    const next: PrinterSettings = {
      kind,
      host: host.trim() || undefined,
      port: Number(port) || 9100,
      columns: Number(columns) === 48 ? 48 : 32,
    };

    if (kind === "network" && !next.host) {
      setError("Enter the printer's address on the shop network.");
      return;
    }

    await savePrinterSettings(next);
    setSettings(next);
    setError(null);
    setMessage("Printer saved.");
  }

  async function testPrint() {
    if (!settings) return;

    setError(null);
    try {
      const payload = buildReceipt(
        {
          id: "00000000-0000-4000-8000-000000000000",
          userId: null,
          totalAmount: 123.45,
          discountAmount: 0,
          paymentMethod: "cash",
          status: "completed",
          deviceId: info.deviceId,
          createdAt: new Date().toISOString(),
          // A test print checks the paper and the alignment, not the customer
          // block — nothing here is a real sale to anybody.
          customerName: null,
          customerAddress: null,
          customerContact: null,
          customerId: null,
          isPaid: true,
          fulfillment: "pickup",
          deliveryCompleted: false,
          syncStatus: "synced",
          syncedAt: null,
          items: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              saleId: "00000000-0000-4000-8000-000000000000",
              productId: null,
              productName: "Test item",
              quantity: 1,
              unitPrice: 123.45,
              listPrice: 123.45,
              unitCost: 0,
              subtotal: 123.45,
            },
          ],
        },
        { columns: settings.columns },
      );

      await transportFor(settings).send(payload);
      setMessage("Test receipt sent.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Printer did not answer: ${cause.message}`
          : "Printer did not answer.",
      );
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: layout.gutter,
        gap: space.lg,
        // A settings form stretched across a tablet is unreadable, so it keeps a
        // column width and centres.
        width: "100%",
        maxWidth: layout.readableMaxWidth,
        alignSelf: "center",
      }}
    >
      <Card style={{ gap: space.sm }}>
        <SectionTitle icon={Smartphone} title="This terminal" />
        <Row label="Name" value={info.label || "Not named"} />
        <Row label="Terminal id" value={info.deviceId.slice(0, 8)} />
        <Row label="Products held" value={String(info.products)} />
        <Row label="Cashiers held" value={String(info.users)} />
        <Row label="Last synced" value={timeAgo(info.lastSyncedAt)} />
        {info.pending > 0 ? (
          <Badge tone="warning" label={`${info.pending} sales waiting to send`} />
        ) : (
          <Badge tone="success" label="All sales sent" />
        )}
      </Card>

      <Card style={{ gap: space.sm }}>
        <SectionTitle
          icon={Store}
          title="Shop"
          hint="Set in the office. Changes arrive on the next sync."
        />
        <Row label="Name" value={store.name} />
        <Row label="Address" value={store.address ?? "Not set"} />
        <Row label="Phone" value={store.phone ?? "Not set"} />
      </Card>

      <Card style={{ gap: space.md }}>
        <SectionTitle icon={Printer} title="Receipt printer" />
        <Text style={styles.muted}>
          A network ESC/POS printer on the shop wifi. Leave it off to print receipts to
          the log instead, which is useful before the hardware arrives.
        </Text>

        <Labelled label="Address">
          <TextInput
            value={host}
            onChangeText={setHost}
            placeholder="192.168.1.50"
            placeholderTextColor={color.inkMuted}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            style={inputStyle}
          />
        </Labelled>

        <View style={{ flexDirection: "row", gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Labelled label="Port">
              <TextInput
                value={port}
                onChangeText={setPort}
                keyboardType="number-pad"
                style={inputStyle}
              />
            </Labelled>
          </View>
          <View style={{ flex: 1 }}>
            <Labelled label="Paper width">
              <TextInput
                value={columns}
                onChangeText={setColumns}
                keyboardType="number-pad"
                style={inputStyle}
              />
            </Labelled>
          </View>
        </View>
        <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
          32 characters for 58mm paper, 48 for 80mm.
        </Text>

        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {message ? <SuccessNote>{message}</SuccessNote> : null}

        <Button
          label="Use this printer"
          icon={Check}
          onPress={() => void save("network")}
        />
        <Button
          label="Print to log instead"
          variant="secondary"
          icon={FileText}
          onPress={() => void save("none")}
        />
        <Button
          label="Send a test receipt"
          variant="secondary"
          icon={Send}
          onPress={() => void testPrint()}
        />
      </Card>

      <Card style={{ gap: space.md }}>
        <SectionTitle icon={LogOut} title="Shift" />
        <Button
          label="End shift"
          variant="secondary"
          icon={LogOut}
          onPress={() => {
            lock();
            router.replace("/unlock");
          }}
        />
      </Card>
    </ScrollView>
  );
}

const inputStyle = {
  minHeight: 48,
  borderWidth: 1,
  borderColor: color.border,
  borderRadius: radius.sm,
  backgroundColor: color.surface,
  paddingHorizontal: space.md,
  fontSize: fontSize.bodyLg,
  color: color.ink,
} as const;

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontSize: fontSize.caption, color: color.inkMuted, fontWeight: "600" }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.numeric, { fontSize: fontSize.body }]}>{value}</Text>
    </View>
  );
}
