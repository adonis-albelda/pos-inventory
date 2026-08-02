import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { timeAgo } from "@double-a/shared-types";
import { CloudUpload, Info, RefreshCw, Smartphone } from "lucide-react-native";
import { getSyncMeta } from "@/db/meta";
import { countLocalProducts } from "@/db/products";
import { countPendingSales } from "@/db/sales";
import { countLocalUsers } from "@/db/users";
import { useLayout } from "@/lib/layout";
import { useSync } from "@/sync/sync-provider";
import { SyncBar } from "@/components/sync-bar";
import { Badge, Card, ErrorNote, SectionTitle } from "@/components/ui";
import { color, fontSize, space, styles } from "@/theme";

/**
 * Where the two sync actions live, and what they moved.
 *
 * The header on every screen says how far behind this terminal is; this is the
 * screen a cashier lands on from it. The order on the Sync button is unchanged
 * and deliberate: sales go up first, and only if that succeeds does anything
 * come down.
 */
export default function SyncScreen() {
  const layout = useLayout();
  const { dataVersion, error, phase } = useSync();

  const [info, setInfo] = useState({
    products: 0,
    users: 0,
    pending: 0,
    lastSyncedAt: null as string | null,
  });

  useEffect(() => {
    async function load() {
      const [products, users, pending, meta] = await Promise.all([
        countLocalProducts(),
        countLocalUsers(),
        countPendingSales(),
        getSyncMeta(),
      ]);

      setInfo({ products, users, pending, lastSyncedAt: meta.lastSyncedAt });
    }

    void load();
    // Every count here is stale the moment a pull finishes, and the sync bar
    // that starts one sits at the top of this screen.
  }, [dataVersion]);

  return (
    <View style={styles.screen}>
      <SyncBar />

      <ScrollView
        contentContainerStyle={{
          padding: layout.gutter,
          gap: space.lg,
          width: "100%",
          maxWidth: layout.readableMaxWidth,
          alignSelf: "center",
        }}
      >
        {phase === "failed" && error ? <ErrorNote>{error}</ErrorNote> : null}

        <Card style={{ gap: space.sm }}>
          <SectionTitle icon={Smartphone} title="On this terminal" />
          <Row label="Last synced" value={timeAgo(info.lastSyncedAt)} />
          <Row label="Sales waiting to send" value={String(info.pending)} />
          <Row label="Products held" value={String(info.products)} />
          <Row label="Cashiers held" value={String(info.users)} />
          {info.pending > 0 ? (
            <Badge tone="warning" label={`${info.pending} not sent yet`} />
          ) : (
            <Badge tone="success" label="All sales sent" />
          )}
        </Card>

        <Card style={{ gap: space.md }}>
          <SectionTitle icon={Info} title="What each one does" />

          <Explainer
            icon={CloudUpload}
            title="Sync"
            body="Sends every sale still on this terminal, then brings down the latest prices, products and cashiers. If sending fails, nothing is fetched and the sales stay here for the next attempt."
          />
          <Explainer
            icon={RefreshCw}
            title="Refresh"
            body="Only brings changes down. Use it to pick up a price change mid-shift. Sales stay where they are and go out on the next Sync."
          />

          <Text style={styles.muted}>
            Nothing syncs on its own. Selling and printing work exactly the same
            with no connection at all.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

function Explainer({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof CloudUpload;
  title: string;
  body: string;
}) {
  return (
    <View style={{ flexDirection: "row", gap: space.sm }}>
      <View style={[styles.iconWell, { width: 30, height: 30 }]}>
        <Icon size={16} color={color.primary} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: fontSize.body, fontWeight: "700", color: color.ink }}>
          {title}
        </Text>
        <Text style={styles.muted}>{body}</Text>
      </View>
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
