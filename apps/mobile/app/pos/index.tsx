import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  Bookmark,
  BookmarkCheck,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Info,
  MapPin,
  Minus,
  PackageSearch,
  Pencil,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Smartphone,
  Tag,
  Trash2,
  TriangleAlert,
  Truck,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react-native";
import {
  cartDiscount,
  cartTotal,
  checkPriceOverride,
  CUSTOMER_FIELD_MAX_LENGTH,
  formatMoney,
  formatPercent,
  hasCustomerDetails,
  lineProfit,
  lineSubtotal,
  marginPercent,
  normaliseCustomerDetails,
  priceForQuantity,
  roundMoney,
  timeAgo,
  type CartLine,
  type CustomerDetails,
  type Fulfillment,
  type PaymentMethod,
  type ProductWithEstimatedStock,
} from "@double-a/shared-types";
import { listLocalCategories, type LocalCategory } from "@/db/categories";
import { searchLocalCustomers, upsertLocalCustomer } from "@/db/customers";
import { findLocalProductByBarcode, listLocalProducts } from "@/db/products";
import { completeSale } from "@/db/sales";
import {
  addCartDraft,
  listCartDrafts,
  removeCartDraft,
  type CartDraft,
} from "@/lib/cart-draft";
import { getDeviceId } from "@/lib/device";
import { useLayout } from "@/lib/layout";
import { useSession } from "@/lib/session";
import { printReceipt } from "@/printing/receipt";
import { useSync } from "@/sync/sync-provider";
import { BottomSheet } from "@/components/bottom-sheet";
import { CategoryTabs, type CategoryFilter } from "@/components/category-tabs";
import { ProductTile } from "@/components/product-tile";
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  LedgerLine,
  Money,
  WarningNote,
} from "@/components/ui";
import { color, fontSize, radius, space, styles } from "@/theme";

/** What a cart with no customer attached looks like. Also the state after a sale. */
const NO_CUSTOMER: CustomerDetails = { customerId: null, name: null, address: null, contact: null };

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "gcash", label: "GCash", icon: Smartphone },
  { value: "card", label: "Card", icon: CreditCard },
];

export default function SellScreen() {
  const router = useRouter();
  const { cashier } = useSession();
  const { refresh, dataVersion } = useSync();

  // A phone cannot hold a grid and a cart side by side, so below the compact
  // breakpoint the cart moves behind a summary bar the cashier taps to pay.
  const layout = useLayout();
  const { compact, columns } = layout;

  const [products, setProducts] = useState<ProductWithEstimatedStock[]>([]);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  // Lines whose price the attendant typed in. A manual price is a decision, so
  // it outranks the bulk tier and survives every quantity change after it.
  const [overridden, setOverridden] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  // Optional, and empty for most sales. Held on the cart rather than asked for
  // at the end, so a cashier can take a name while the order is still being
  // built and never has a dialog between them and completing the sale.
  const [customer, setCustomer] = useState<CustomerDetails>(NO_CUSTOMER);
  const [fulfillment, setFulfillment] = useState<Fulfillment>("pickup");
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [drafts, setDrafts] = useState<CartDraft[]>([]);
  const [draftPickerOpen, setDraftPickerOpen] = useState(false);
  const [categories, setCategories] = useState<LocalCategory[]>([]);
  const [category, setCategory] = useState<CategoryFilter>(null);

  const refreshDrafts = useCallback(async () => {
    const next = await listCartDrafts();
    setDrafts(next);
    setHasDraft(next.length > 0);
  }, []);

  const load = useCallback(async () => {
    const [nextProducts, nextCategories] = await Promise.all([
      listLocalProducts(),
      listLocalCategories(),
    ]);

    setProducts(nextProducts);
    setCategories(nextCategories);
    // A pull can retire the shelf the cashier is standing on. Falling back to
    // everything is the honest thing: a lit tab for a category that no longer
    // exists, filtering nothing, would read as an empty catalogue.
    setCategory((current) =>
      current && nextCategories.some((entry) => entry.id === current) ? current : null,
    );
  }, []);

  // Reload on focus so a sync or a finished sale is reflected in estimated stock.
  useFocusEffect(
    useCallback(() => {
      void load();
      void refreshDrafts();
    }, [load, refreshDrafts]),
  );

  /**
   * `dataVersion` changes when a pull has written to SQLite. The sync bar is on
   * this screen, so a Refresh happens with the grid already mounted and on
   * focus — without this, a new price or name would sit in the database unread
   * until the cashier navigated away and back.
   */
  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  const byId = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  /**
   * The selected category and everything under it. Matching is on ids, not on
   * the path text a product carries: that text is a snapshot kept for receipts
   * and reports, and it survives the category being deleted in the office.
   */
  const branch = useMemo(() => {
    const selected = categories.find((entry) => entry.id === category);
    return selected ? new Set(selected.subtreeIds) : null;
  }, [categories, category]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    // Search reaches the whole catalogue on purpose: a cashier typing a name
    // wants the product, not an explanation of which tab it is filed under.
    const pool =
      branch === null || needle
        ? products
        : products.filter(
            (product) => product.categoryId !== null && branch.has(product.categoryId),
          );

    if (!needle) return pool;
    return pool.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        (product.sku ?? "").toLowerCase().includes(needle) ||
        (product.barcode ?? "").toLowerCase().includes(needle),
    );
  }, [products, search, branch]);

  const total = cartTotal(lines);
  const discount = cartDiscount(lines);
  const shelfTotal = roundMoney(
    lines.reduce((sum, line) => sum + line.listPrice * line.quantity, 0),
  );
  const inCart = useMemo(
    () => new Map(lines.map((line) => [line.productId, line.quantity])),
    [lines],
  );

  /**
   * The price a line should carry at a given quantity. Bulk pricing applies
   * itself as the quantity crosses the contractor threshold — unless the
   * attendant has typed a price, which nothing here may overwrite.
   */
  function repricedFor(line: CartLine, quantity: number): CartLine {
    const product = byId.get(line.productId);
    if (!product || overridden.includes(line.productId)) {
      return { ...line, quantity };
    }

    return { ...line, quantity, unitPrice: priceForQuantity(product, quantity) };
  }

  /** No confirmation here on purpose — adding to a cart is speed critical. */
  function addToCart(product: ProductWithEstimatedStock) {
    const stockCap = Math.max(0, Math.floor(product.estimatedStock));
    if (stockCap <= 0) return;

    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        if (existing.quantity >= stockCap) return current;
        return current.map((line) =>
          line.productId === product.id
            ? repricedFor(line, Math.min(line.quantity + 1, stockCap))
            : line,
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          unitPrice: priceForQuantity(product, 1),
          // The shelf price, kept whatever the line ends up selling at, so the
          // office can see exactly what was given away.
          listPrice: product.price,
          unitCost: product.costPrice,
          unit: product.unit,
          quantity: 1,
          availableStock: stockCap,
        },
      ];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setLines((current) =>
      current
        .map((line) => {
          if (line.productId !== productId) return line;
          const stockCap = Math.max(0, Math.floor(line.availableStock));
          const next = line.quantity + delta;
          if (delta > 0 && next > stockCap) return line;
          return repricedFor(line, next);
        })
        .filter((line) => line.quantity > 0),
    );

    const line = lines.find((entry) => entry.productId === productId);
    if (line && line.quantity + delta <= 0) forgetOverride(productId);
  }

  function forgetOverride(productId: string) {
    setOverridden((current) => current.filter((id) => id !== productId));
  }

  function applyPrice(productId: string, price: number) {
    setLines((current) =>
      current.map((line) =>
        line.productId === productId ? { ...line, unitPrice: roundMoney(price) } : line,
      ),
    );
    setOverridden((current) =>
      current.includes(productId) ? current : [...current, productId],
    );
    setEditingId(null);
  }

  /** Back to whatever the product is priced at for this quantity, bulk included. */
  function resetPrice(productId: string) {
    setOverridden((current) => current.filter((id) => id !== productId));
    setLines((current) =>
      current.map((line) => {
        const product = byId.get(line.productId);
        if (line.productId !== productId || !product) return line;
        return { ...line, unitPrice: priceForQuantity(product, line.quantity) };
      }),
    );
    setEditingId(null);
  }

  /**
   * A hardware barcode scanner is a keyboard: it types the code and presses
   * enter. An exact match goes straight into the cart and the field clears,
   * ready for the next scan. Anything else stays put as an ordinary search.
   */
  async function submitSearch() {
    const code = search.trim();
    if (!code) return;

    const scanned = await findLocalProductByBarcode(code);
    if (!scanned) return;

    addToCart(scanned);
    setSearch("");
  }

  function confirmClearCart() {
    Alert.alert("Empty the cart?", "Every item on this sale is removed.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Empty cart",
        style: "destructive",
        onPress: () => {
          setLines([]);
          setOverridden([]);
          setCustomer(NO_CUSTOMER);
          setFulfillment("pickup");
        },
      },
    ]);
  }

  /** Park this cart so the cashier can help someone else, then come back. */
  async function saveDraft() {
    if (lines.length === 0) return;

    await addCartDraft({
      lines,
      overridden,
      payment,
      customer,
      fulfillment,
    });
    setLines([]);
    setOverridden([]);
    setCustomer(NO_CUSTOMER);
    setFulfillment("pickup");
    setPayment("cash");
    await refreshDrafts();
  }

  function openDraftPicker() {
    void refreshDrafts().then(() => setDraftPickerOpen(true));
  }

  function applyDraft(draft: CartDraft) {
    setLines(draft.lines);
    setOverridden(draft.overridden);
    setPayment(draft.payment);
    setCustomer(draft.customer);
    setFulfillment(draft.fulfillment);
    void removeCartDraft(draft.id).then(() => refreshDrafts());
    setDraftPickerOpen(false);
  }

  function resumeDraft(draft: CartDraft) {
    if (lines.length > 0) {
      Alert.alert(
        "Replace the open cart?",
        "Loading this draft clears what is in the cart now.",
        [
          { text: "Keep cart", style: "cancel" },
          { text: "Load draft", onPress: () => applyDraft(draft) },
        ],
      );
      return;
    }
    applyDraft(draft);
  }

  function discardDraft(draft: CartDraft) {
    Alert.alert("Delete this draft?", "The parked cart is removed from this terminal.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete draft",
        style: "destructive",
        onPress: () => void removeCartDraft(draft.id).then(() => refreshDrafts()),
      },
    ]);
  }

  /**
   * Writes the sale locally, fires the receipt, and moves on. Nothing here waits
   * on the network, so this behaves identically offline and online.
   */
  async function finishSale() {
    if (!cashier || lines.length === 0) return;

    setSaving(true);
    try {
      let saleCustomer = normaliseCustomerDetails(customer);
      if (hasCustomerDetails(saleCustomer)) {
        const name =
          saleCustomer.name ??
          saleCustomer.contact ??
          saleCustomer.address ??
          "Customer";
        const customerId = saleCustomer.customerId ?? Crypto.randomUUID();
        await upsertLocalCustomer({
          id: customerId,
          name,
          address: saleCustomer.address,
          contact: saleCustomer.contact,
          pending: true,
        });
        saleCustomer = { ...saleCustomer, customerId, name };
      }

      const sale = await completeSale({
        lines,
        userId: cashier.id,
        deviceId: await getDeviceId(),
        paymentMethod: payment,
        customer: saleCustomer,
        fulfillment,
      });

      setLines([]);
      setOverridden([]);
      // The next customer is a different customer. Carrying details over would
      // put a stranger's name and address on the following receipt.
      setCustomer(NO_CUSTOMER);
      setFulfillment("pickup");
      setConfirmOpen(false);
      setCartOpen(false);
      void load();
      void refresh();

      // Deliberately not awaited: a printer that is off or unreachable must not
      // be able to hold up, or undo, a completed sale.
      void printReceipt(sale, cashier.name).catch((error: unknown) => {
        console.warn("Receipt did not print", error);
      });

      router.push(`/pos/sale/${sale.id}`);
    } finally {
      setSaving(false);
    }
  }

  const oversellRisk = lines.some((line) => line.quantity > line.availableStock);
  const itemCount = lines.reduce((count, line) => count + line.quantity, 0);
  const editingLine = lines.find((line) => line.productId === editingId) ?? null;

  return (
    <View style={{ flex: 1, flexDirection: compact ? "column" : "row" }}>
      {/* On a wide tablet the grid is capped and centred rather than letting
          tiles grow to billboard size. */}
      <View
        style={{
          flex: 1,
          padding: layout.gutter,
          gap: space.md,
          width: "100%",
          maxWidth: compact ? undefined : layout.gridMaxWidth,
          alignSelf: "center",
          minHeight: 0,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            minHeight: compact ? 48 : 56,
            borderWidth: 1,
            borderColor: color.primarySoft,
            borderRadius: radius.sm,
            backgroundColor: color.surface,
            paddingHorizontal: space.md,
          }}
        >
          <Search size={18} color={color.primary} strokeWidth={2} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => void submitSearch()}
            // Focus stays put so a scanner can fire code after code.
            submitBehavior="submit"
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={compact ? "Search or scan" : "Search by name or SKU, or scan a barcode"}
            placeholderTextColor={color.inkMuted}
            numberOfLines={1}
            style={{
              flex: 1,
              minHeight: compact ? 48 : 56,
              fontSize: fontSize.bodyLg,
              color: color.ink,
            }}
          />
          {search ? (
            <IconButton
              icon={X}
              label="Clear search"
              size={36}
              style={{ borderWidth: 0, backgroundColor: "transparent" }}
              onPress={() => setSearch("")}
            />
          ) : null}
        </View>

        {/* Hidden while searching: the results already ignore the filter, so a
            lit-up tab beside them would be a lie. */}
        {search.trim() ? null : (
          <CategoryTabs
            categories={categories}
            value={category}
            onChange={setCategory}
          />
        )}

        <View style={{ flex: 1, minHeight: 0, gap: space.sm }}>
          {products.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No products on this terminal"
              instruction="Press Refresh to bring the product list down from the office."
            />
          ) : (
            <FlatList
              data={visible}
              style={{ flex: 1 }}
              keyExtractor={(item) => item.id}
              // numColumns cannot change on a mounted list, so the column count is
              // part of the key and a rotation remounts the grid.
              key={`grid-${columns}`}
              numColumns={columns}
              columnWrapperStyle={{ gap: layout.gap }}
              contentContainerStyle={{
                gap: layout.gap,
                paddingBottom: space.sm,
                flexGrow: 1,
              }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <EmptyState
                  icon={PackageSearch}
                  title="Nothing matches that"
                  instruction="Check the spelling, or scan the barcode on the item itself."
                />
              }
              renderItem={({ item }) => (
                <ProductTile
                  product={item}
                  inCart={inCart.get(item.id) ?? 0}
                  compact={compact}
                  minHeight={layout.tileMinHeight}
                  padding={space.md}
                  onPress={() => addToCart(item)}
                  onRemove={() => changeQuantity(item.id, -1)}
                />
              )}
            />
          )}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              gap: space.xs,
              paddingHorizontal: space.sm,
              paddingVertical: space.xs,
              borderRadius: radius.sm,
              backgroundColor: color.primarySoft,
            }}
          >
            <Info size={13} color={color.primary} strokeWidth={2.5} />
            <Text style={{ fontSize: fontSize.caption, color: color.primary }}>
              Stock counts are an estimate until you sync.
            </Text>
          </View>
        </View>
      </View>

      <CartShell
        compact={compact}
        width={layout.cartWidth}
        padding={layout.gutter}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
      >
        {/* Column fills the panel: lines grow, checkout stays docked bottom. */}
        <View style={{ flex: 1, minHeight: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={[styles.iconWell, { width: 34, height: 34 }]}>
              <ShoppingCart size={18} color={color.primary} strokeWidth={2} />
            </View>
            <Text style={styles.subheading}>Cart</Text>
            {itemCount > 0 ? (
              <View
                style={{
                  backgroundColor: color.primary,
                  borderRadius: radius.sm,
                  paddingHorizontal: space.sm,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{
                    color: color.onPrimary,
                    fontSize: fontSize.caption,
                    fontWeight: "700",
                  }}
                >
                  {itemCount} items
                </Text>
              </View>
            ) : null}

            <View
              style={{
                marginLeft: "auto",
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
              }}
            >
              {lines.length > 0 ? (
                <IconButton
                  icon={Bookmark}
                  label="Save as draft"
                  onPress={() => void saveDraft()}
                />
              ) : null}
              {hasDraft ? (
                <IconButton
                  icon={BookmarkCheck}
                  label={
                    drafts.length === 1
                      ? "Open drafts"
                      : `Open drafts, ${drafts.length} saved`
                  }
                  onPress={openDraftPicker}
                />
              ) : null}
              {lines.length > 0 ? (
                <IconButton
                  icon={Trash2}
                  label="Empty the cart"
                  tone="danger"
                  onPress={confirmClearCart}
                />
              ) : null}
              {compact ? (
                <IconButton icon={X} label="Close cart" onPress={() => setCartOpen(false)} />
              ) : null}
            </View>
          </View>

          <View style={{ flex: 1, minHeight: 0, marginTop: space.sm }}>
            {lines.length === 0 ? (
              <View style={{ flex: 1, justifyContent: "center" }}>
                <EmptyState
                  icon={ShoppingCart}
                  title="Nothing in the cart"
                  instruction={
                    hasDraft
                      ? `${drafts.length} draft${drafts.length === 1 ? "" : "s"} saved — tap the bookmark to open one, or tap a product.`
                      : "Tap a product to start a sale."
                  }
                />
              </View>
            ) : (
              <FlatList
                style={{ flex: 1 }}
                data={lines}
                keyExtractor={(line) => line.productId}
                keyboardShouldPersistTaps="handled"
                ItemSeparatorComponent={() => (
                  <View style={{ height: 1, backgroundColor: color.border }} />
                )}
                renderItem={({ item }) => (
                  <CartRow
                    line={item}
                    product={byId.get(item.productId)}
                    overridden={overridden.includes(item.productId)}
                    onChange={(delta) => changeQuantity(item.productId, delta)}
                    onEditPrice={() => setEditingId(item.productId)}
                  />
                )}
              />
            )}
          </View>

          {/* Docked checkout — stays visible while the line list scrolls above. */}
          <View style={{ flexShrink: 0, paddingTop: space.sm }}>
            <LedgerLine />

            {discount > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: space.sm,
                  marginBottom: space.sm,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
                  <Tag size={14} color={color.accentInk} strokeWidth={2.5} />
                  <Text style={{ fontSize: fontSize.body, color: color.accentInk }}>
                    Discount given
                  </Text>
                </View>
                <Text
                  style={[
                    styles.numeric,
                    { fontSize: fontSize.bodyLg, fontWeight: "700", color: color.accentInk },
                  ]}
                >
                  -{formatMoney(discount)}
                </Text>
              </View>
            ) : null}

            {/* The one number the cashier reads out loud, so it sits on its own
                tinted band rather than blending into the line items. */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: space.sm,
                padding: space.md,
                borderRadius: radius.sm,
                backgroundColor: color.primaryTint,
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: fontSize.bodyLg,
                    fontWeight: "700",
                    color: color.primaryDark,
                  }}
                >
                  TOTAL
                </Text>
                {itemCount > 0 ? (
                  <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                    {itemCount} item{itemCount === 1 ? "" : "s"}
                  </Text>
                ) : null}
              </View>
              <Money
                value={total}
                style={[
                  styles.total,
                  {
                    fontSize: compact ? fontSize.headingMd : fontSize.headingLg,
                    color: color.primaryDark,
                  },
                ]}
              />
            </View>

            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
              {PAYMENT_METHODS.map((method) => {
                const selected = payment === method.value;
                const MethodIcon = method.icon;

                return (
                  <Pressable
                    key={method.value}
                    onPress={() => setPayment(method.value)}
                    accessibilityState={{ selected }}
                    style={{
                      flex: 1,
                      minHeight: compact ? 48 : 52,
                      flexDirection: "row",
                      gap: space.xs,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: space.xs,
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      // The chosen method is filled, not outlined — one glance has to
                      // settle what the customer is paying with.
                      borderColor: selected ? color.primary : color.border,
                      backgroundColor: selected ? color.primary : color.surface,
                    }}
                  >
                    <MethodIcon
                      size={16}
                      color={selected ? color.onPrimary : color.inkMuted}
                      strokeWidth={2}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: fontSize.body,
                        fontWeight: "600",
                        color: selected ? color.onPrimary : color.ink,
                      }}
                    >
                      {method.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
              {([
                { value: "pickup" as const, label: "Pickup" },
                { value: "delivery" as const, label: "Delivery", icon: Truck },
              ]).map((option) => {
                const selected = fulfillment === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setFulfillment(option.value)}
                    accessibilityState={{ selected }}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      flexDirection: "row",
                      gap: space.xs,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: selected ? color.primary : color.border,
                      backgroundColor: selected ? color.primarySoft : color.surface,
                    }}
                  >
                    {option.icon ? (
                      <Truck
                        size={15}
                        color={selected ? color.primary : color.inkMuted}
                        strokeWidth={2}
                      />
                    ) : null}
                    <Text
                      style={{
                        fontSize: fontSize.body,
                        fontWeight: "600",
                        color: selected ? color.primaryDark : color.ink,
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Optional, and it looks optional: one quiet row, never a required
                step between the cashier and the total. */}
            <CustomerButton
              customer={customer}
              onPress={() => setEditingCustomer(true)}
              onClear={() => setCustomer(NO_CUSTOMER)}
            />

            {oversellRisk ? (
              <View style={{ marginTop: space.sm }}>
                <WarningNote>
                  This sells more than the last counted stock. It still goes through — the
                  office will see it after you sync.
                </WarningNote>
              </View>
            ) : null}

            <Button
              label="Complete sale"
              large
              icon={CheckCircle2}
              disabled={lines.length === 0 || saving}
              style={{ marginTop: space.md }}
              onPress={() => setConfirmOpen(true)}
            />
          </View>
        </View>

        {/* Inside the cart on purpose: on a phone the cart is itself a modal,
            and a sheet presented from outside it would open underneath. */}
        <PriceSheet
          key={editingId ?? "closed"}
          line={editingLine}
          onClose={() => setEditingId(null)}
          onApply={applyPrice}
          onReset={resetPrice}
        />

        <CustomerSheet
          key={editingCustomer ? "customer-open" : "customer-closed"}
          open={editingCustomer}
          customer={customer}
          onClose={() => setEditingCustomer(false)}
          onApply={(next) => {
            setCustomer(next);
            setEditingCustomer(false);
          }}
        />

        <ConfirmSaleSheet
          key={confirmOpen ? "confirm-open" : "confirm-closed"}
          open={confirmOpen}
          shelfTotal={shelfTotal}
          discount={discount}
          amountDue={total}
          payment={payment}
          itemCount={itemCount}
          busy={saving}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => void finishSale()}
        />

        <DraftPickerSheet
          open={draftPickerOpen}
          drafts={drafts}
          onClose={() => setDraftPickerOpen(false)}
          onPick={resumeDraft}
          onDiscard={discardDraft}
        />
      </CartShell>

      {compact ? (
        <CartSummaryBar
          itemCount={itemCount}
          total={total}
          onPress={() => setCartOpen(true)}
        />
      ) : null}
    </View>
  );
}

function CartRow({
  line,
  product,
  overridden,
  onChange,
  onEditPrice,
}: {
  line: CartLine;
  product: ProductWithEstimatedStock | undefined;
  overridden: boolean;
  onChange: (delta: number) => void;
  onEditPrice: () => void;
}) {
  const stockCap = Math.max(0, Math.floor(line.availableStock));
  const remaining = Math.max(0, stockCap - line.quantity);
  const atMax = line.quantity >= stockCap;
  const oversell = line.quantity > stockCap;
  const discounted = line.unitPrice < line.listPrice;
  const belowCost = line.unitPrice < line.unitCost;
  const bulkMin = product?.bulkMinQuantity ?? null;
  const bulkApplied = !overridden && bulkMin !== null && line.quantity >= bulkMin;
  // At one, decrementing drops the line entirely, so the control says so.
  const RemoveIcon = line.quantity === 1 ? Trash2 : Minus;
  const showFlags = bulkApplied || belowCost || oversell;
  const priceTone = belowCost
    ? color.dangerInk
    : overridden
      ? color.accentInk
      : color.inkMuted;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingVertical: space.sm,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            minWidth: 0,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              minWidth: 0,
              fontSize: fontSize.body,
              fontWeight: "700",
              color: color.ink,
            }}
          >
            {line.productName}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 0,
              fontSize: fontSize.caption,
              fontWeight: "600",
              color: oversell || remaining === 0 ? color.warningInk : color.inkMuted,
            }}
          >
            {oversell
              ? `${stockCap} in stock`
              : remaining === 0
                ? "At limit"
                : `${remaining} left`}
          </Text>
        </View>

        <Pressable
          onPress={onEditPrice}
          accessibilityRole="button"
          accessibilityLabel={`Change the price of ${line.productName}`}
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: space.xs,
            paddingVertical: 2,
            paddingHorizontal: overridden ? space.xs : 0,
            borderRadius: radius.sm,
            backgroundColor: pressed
              ? color.primarySoft
              : overridden
                ? belowCost
                  ? color.dangerSoft
                  : color.accentSoft
                : "transparent",
          })}
        >
          <Text
            style={[styles.numeric, { fontSize: fontSize.caption, color: color.inkMuted }]}
          >
            {line.quantity} {line.unit} ×
          </Text>
          {overridden && discounted ? (
            <Text
              style={[
                styles.numeric,
                {
                  fontSize: fontSize.caption,
                  color: color.inkMuted,
                  textDecorationLine: "line-through",
                },
              ]}
            >
              {formatMoney(line.listPrice)}
            </Text>
          ) : null}
          <Text
            style={[
              styles.numeric,
              {
                fontSize: fontSize.caption,
                fontWeight: overridden ? "700" : "600",
                color: priceTone,
              },
            ]}
          >
            {formatMoney(line.unitPrice)}
          </Text>
          {overridden ? (
            <Pencil size={11} color={priceTone} strokeWidth={2.5} />
          ) : (
            <Pencil size={11} color={color.inkMuted} strokeWidth={2} />
          )}
        </Pressable>

        {showFlags ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: space.xs,
              marginTop: 2,
            }}
          >
            {bulkApplied ? (
              <Badge tone="success" icon={Tag} label={`Bulk from ${bulkMin}`} />
            ) : null}
            {belowCost ? (
              <Badge tone="danger" icon={TriangleAlert} label="Below cost" />
            ) : null}
            {oversell ? <Badge tone="warning" label="Over stock" /> : null}
          </View>
        ) : null}
      </View>

      <View style={{ alignItems: "flex-end", gap: space.xs, flexShrink: 0 }}>
        <Money
          value={lineSubtotal(line.unitPrice, line.quantity)}
          style={{
            fontSize: fontSize.body,
            fontWeight: "700",
            color: color.ink,
          }}
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: color.border,
            borderRadius: radius.sm,
            overflow: "hidden",
            backgroundColor: color.paper,
          }}
        >
          <StepperButton
            icon={RemoveIcon}
            label={
              line.quantity === 1
                ? `Remove ${line.productName} from the cart`
                : `One less ${line.productName}`
            }
            tint={line.quantity === 1 ? color.danger : color.ink}
            onPress={() => onChange(-1)}
          />
          <Text
            style={[
              styles.numeric,
              {
                minWidth: 28,
                textAlign: "center",
                fontSize: fontSize.body,
                fontWeight: "700",
              },
            ]}
          >
            {line.quantity}
          </Text>
          <StepperButton
            icon={Plus}
            label={
              atMax
                ? `${line.productName} is at stock limit`
                : `One more ${line.productName}`
            }
            tint={atMax ? color.inkMuted : color.primary}
            disabled={atMax}
            onPress={() => onChange(1)}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Typing the price a line actually sold for.
 *
 * Selling below cost is allowed — clearing dead stock and matching a rival are
 * both real decisions the owner wants attendants to be able to make. It is
 * called out plainly so nobody does it by accident, and the margin updates as
 * the price is typed, because cashiers on this shop floor are trusted with cost.
 */
function PriceSheet({
  line,
  onClose,
  onApply,
  onReset,
}: {
  line: CartLine | null;
  onClose: () => void;
  onApply: (productId: string, price: number) => void;
  onReset: (productId: string) => void;
}) {
  // Seeded once, at mount. The caller keys this component on the line being
  // edited, so opening a different one remounts with that line's price already
  // in the field, ready to be typed over.
  const [draft, setDraft] = useState(() => line?.unitPrice.toFixed(2) ?? "");

  if (!line) return null;

  const typed = Number(draft);
  const check = checkPriceOverride(typed, line);
  const margin = marginPercent(typed, line.unitCost);
  const profit = lineProfit(typed, line.unitCost, line.quantity);
  const off = check.ok ? Math.max(line.listPrice - typed, 0) * line.quantity : 0;

  return (
    <BottomSheet open={line !== null} onClose={onClose}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={[styles.iconWell, { width: 34, height: 34 }]}>
              <Tag size={18} color={color.primary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.subheading}>
                {line.productName}
              </Text>
              <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                Shelf {formatMoney(line.listPrice)} · Cost {formatMoney(line.unitCost)} ·{" "}
                {line.quantity} {line.unit}
              </Text>
            </View>
            <IconButton icon={X} label="Close" onPress={onClose} />
          </View>

          <Text style={{ fontSize: fontSize.body, fontWeight: "600" }}>
            Price per {line.unit}
          </Text>

          <TextInput
            value={draft}
            onChangeText={(next) => setDraft(next.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            accessibilityLabel={`Price per ${line.unit} for ${line.productName}`}
            style={[
              styles.numeric,
              {
                minHeight: 64,
                borderWidth: 2,
                borderColor: check.ok ? color.primary : color.danger,
                borderRadius: radius.sm,
                backgroundColor: check.ok ? color.primaryTint : color.dangerSoft,
                color: check.ok ? color.primaryDark : color.dangerInk,
                paddingHorizontal: space.md,
                fontSize: fontSize.headingMd,
                fontWeight: "700",
              },
            ]}
          />

          {check.error ? (
            <Text style={{ fontSize: fontSize.body, color: color.dangerInk }}>
              {check.error}
            </Text>
          ) : (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: space.sm,
              }}
            >
              <Text style={{ fontSize: fontSize.body, color: color.inkMuted }}>
                Margin{" "}
                <Text
                  style={[
                    styles.numeric,
                    {
                      fontWeight: "700",
                      color: check.belowCost ? color.dangerInk : color.primary,
                    },
                  ]}
                >
                  {formatPercent(margin)}
                </Text>{" "}
                · {formatMoney(profit)} on this line
              </Text>
              {off > 0 ? (
                <Text
                  style={[styles.numeric, { fontSize: fontSize.body, color: color.inkMuted }]}
                >
                  -{formatMoney(off)}
                </Text>
              ) : null}
            </View>
          )}

          {check.belowCost ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: space.sm,
                padding: space.md,
                borderRadius: radius.sm,
                backgroundColor: color.warningSoft,
              }}
            >
              <TriangleAlert size={18} color={color.warningInk} strokeWidth={2} />
              <Text style={{ flex: 1, fontSize: fontSize.body, color: color.warningInk }}>
                Below the {formatMoney(line.unitCost)} this cost us. You can still sell
                at this price — it goes on the office's discount report.
              </Text>
            </View>
          ) : null}

          {check.aboveList ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: space.sm,
                padding: space.md,
                borderRadius: radius.sm,
                backgroundColor: color.paper,
              }}
            >
              <Info size={18} color={color.inkMuted} strokeWidth={2} />
              <Text style={{ flex: 1, fontSize: fontSize.body, color: color.inkMuted }}>
                Above the {formatMoney(line.listPrice)} shelf price.
              </Text>
            </View>
          ) : null}

          <Button
            label="Save price"
            large
            icon={CheckCircle2}
            disabled={!check.ok}
            onPress={() => onApply(line.productId, typed)}
          />
          <Button
            label="Back to shelf price"
            variant="secondary"
            onPress={() => onReset(line.productId)}
          />
    </BottomSheet>
  );
}

/**
 * The row that opens the customer sheet, and the summary once something is
 * filled in.
 *
 * Deliberately understated: most sales are a walk-in paying cash, and a loud
 * empty field above the Complete sale button would read as something that has
 * to be dealt with. Once there are details it becomes a filled row, because at
 * that point the cashier does want to see what will be on the receipt.
 */
function CustomerButton({
  customer,
  onPress,
  onClear,
}: {
  customer: CustomerDetails;
  onPress: () => void;
  onClear: () => void;
}) {
  const filled = hasCustomerDetails(customer);
  // Address last: it is the longest and the least useful for confirming out loud
  // which customer this is.
  const summary = [customer.contact, customer.address].filter(Boolean).join(" · ");

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          filled ? "Edit customer details" : "Add customer details, optional"
        }
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          paddingHorizontal: space.md,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: filled ? color.primarySoft : color.border,
          backgroundColor: pressed
            ? color.surfacePressed
            : filled
              ? color.primaryTint
              : color.surface,
        })}
      >
        <UserRound
          size={16}
          color={filled ? color.primary : color.inkMuted}
          strokeWidth={2}
        />
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: fontSize.body,
              fontWeight: filled ? "700" : "500",
              color: filled ? color.primaryDark : color.ink,
            }}
          >
            {customer.name ?? (filled ? "Customer" : "Add customer details")}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
            {filled ? summary || "No contact number" : "Optional — for a delivery or an account"}
          </Text>
        </View>
        {filled ? (
          <Pencil size={15} color={color.primary} strokeWidth={2} />
        ) : (
          <ChevronRight size={16} color={color.inkMuted} strokeWidth={2} />
        )}
      </Pressable>

      {filled ? (
        <IconButton icon={X} label="Remove customer details" onPress={onClear} />
      ) : null}
    </View>
  );
}

/**
 * Pick an existing customer or type a new one. Saving with details creates or
 * updates a local customer row (client UUID) so later sales can reuse them and
 * the office can see every order under one person after sync.
 */
function CustomerSheet({
  open,
  customer,
  onClose,
  onApply,
}: {
  open: boolean;
  customer: CustomerDetails;
  onClose: () => void;
  onApply: (next: CustomerDetails) => void;
}) {
  const [name, setName] = useState(customer.name ?? "");
  const [contact, setContact] = useState(customer.contact ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [customerId, setCustomerId] = useState<string | null>(customer.customerId);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<
    Awaited<ReturnType<typeof searchLocalCustomers>>
  >([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSearching(true);
    void searchLocalCustomers(query)
      .then((rows) => {
        if (!cancelled) setMatches(rows);
      })
      .catch((error: unknown) => {
        console.warn("Customer search failed", error);
        if (!cancelled) setMatches([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, query]);

  if (!open) return null;

  const draft = normaliseCustomerDetails({
    customerId,
    name,
    contact,
    address,
  });
  const needle = query.trim();
  const shown = matches.slice(0, 8);

  return (
    <BottomSheet open={open} onClose={onClose}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <View style={[styles.iconWell, { width: 34, height: 34 }]}>
                <UserRound size={18} color={color.primary} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subheading}>Customer</Text>
                <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                  Reuse an existing account, or type a new one.
                </Text>
              </View>
              <IconButton icon={X} label="Close" onPress={onClose} />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
                minHeight: 48,
                borderWidth: 1,
                borderColor: color.border,
                borderRadius: radius.sm,
                paddingHorizontal: space.md,
                backgroundColor: color.paper,
              }}
            >
              <Search size={16} color={color.inkMuted} strokeWidth={2} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name, contact, or address"
                placeholderTextColor={color.inkMuted}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                style={{
                  flex: 1,
                  fontSize: fontSize.body,
                  color: color.ink,
                  paddingVertical: space.sm,
                }}
              />
              {query ? (
                <Pressable
                  onPress={() => setQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={8}
                >
                  <X size={16} color={color.inkMuted} strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>

            {searching && shown.length === 0 ? (
              <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                Searching…
              </Text>
            ) : shown.length > 0 ? (
              <View style={{ gap: space.xs }}>
                <Text
                  style={{
                    fontSize: fontSize.caption,
                    fontWeight: "600",
                    color: color.inkMuted,
                  }}
                >
                  {needle ? "Matches" : "Saved customers"}
                </Text>
                {shown.map((match) => (
                  <Pressable
                    key={match.id}
                    onPress={() => {
                      setCustomerId(match.id);
                      setName(match.name);
                      setContact(match.contact ?? "");
                      setAddress(match.address ?? "");
                      setQuery("");
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: space.sm,
                      paddingHorizontal: space.md,
                      borderRadius: radius.sm,
                      backgroundColor: pressed
                        ? color.surfacePressed
                        : customerId === match.id
                          ? color.primaryTint
                          : color.paper,
                      borderWidth: 1,
                      borderColor:
                        customerId === match.id ? color.primarySoft : color.border,
                    })}
                  >
                    <Text
                      style={{ fontSize: fontSize.body, fontWeight: "600", color: color.ink }}
                    >
                      {match.name}
                    </Text>
                    <Text
                      style={{ fontSize: fontSize.caption, color: color.inkMuted }}
                      numberOfLines={1}
                    >
                      {[match.contact, match.address].filter(Boolean).join(" · ") ||
                        "No contact"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                {needle
                  ? "No saved customer matches that. Type a new one below."
                  : "No saved customers yet. Sync, or type a new one below."}
              </Text>
            )}

            <CustomerField
              icon={UserRound}
              label="Name"
              value={name}
              onChangeText={(next) => {
                setName(next);
                // Typing a different name means this is no longer the picked row.
                if (customerId) setCustomerId(null);
              }}
              placeholder="Who the sale is for"
              autoCapitalize="words"
            />
            <CustomerField
              icon={Phone}
              label="Contact number"
              value={contact}
              onChangeText={setContact}
              placeholder="09XX XXX XXXX"
              keyboardType="phone-pad"
            />
            <CustomerField
              icon={MapPin}
              label="Address"
              value={address}
              onChangeText={setAddress}
              placeholder="Where the delivery goes"
              autoCapitalize="words"
              multiline
            />

            <Button
              label="Save customer"
              large
              icon={CheckCircle2}
              onPress={() => onApply(draft)}
            />
            {hasCustomerDetails(draft) ? (
              <Button
                label="Leave blank"
                variant="secondary"
                onPress={() => onApply(NO_CUSTOMER)}
              />
            ) : null}
    </BottomSheet>
  );
}

function CustomerField({
  icon: Icon,
  label,
  value,
  onChangeText,
  placeholder,
  autoFocus = false,
  autoCapitalize = "none",
  keyboardType = "default",
  multiline = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  autoCapitalize?: "none" | "words";
  keyboardType?: "default" | "phone-pad";
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
        <Icon size={14} color={color.inkMuted} strokeWidth={2} />
        <Text style={{ fontSize: fontSize.body, fontWeight: "600" }}>{label}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.inkMuted}
        autoFocus={autoFocus}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        multiline={multiline}
        // The same cap the sale is stored with, so nothing is silently lost
        // between the field and the receipt.
        maxLength={CUSTOMER_FIELD_MAX_LENGTH}
        accessibilityLabel={`${label}, optional`}
        style={{
          minHeight: multiline ? 72 : 52,
          borderWidth: 1,
          borderColor: value.trim() ? color.primary : color.border,
          borderRadius: radius.sm,
          backgroundColor: value.trim() ? color.primaryTint : color.surface,
          paddingHorizontal: space.md,
          paddingTop: multiline ? space.sm : 0,
          textAlignVertical: multiline ? "top" : "center",
          fontSize: fontSize.bodyLg,
          color: color.ink,
        }}
      />
    </View>
  );
}

function StepperButton({
  icon: Icon,
  label,
  tint,
  disabled = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  tint: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
        backgroundColor: pressed && !disabled ? color.border : "transparent",
      })}
    >
      <Icon size={18} color={tint} strokeWidth={2.25} />
    </Pressable>
  );
}

/**
 * Pick which parked cart to bring back. Many drafts can sit on one terminal.
 */
function DraftPickerSheet({
  open,
  drafts,
  onClose,
  onPick,
  onDiscard,
}: {
  open: boolean;
  drafts: CartDraft[];
  onClose: () => void;
  onPick: (draft: CartDraft) => void;
  onDiscard: (draft: CartDraft) => void;
}) {
  if (!open) return null;

  return (
    <BottomSheet open={open} onClose={onClose} scroll={false}>
        <View
          style={{
            gap: space.md,
            maxHeight: 520,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={[styles.iconWell, { width: 34, height: 34 }]}>
              <BookmarkCheck size={18} color={color.primary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subheading}>Saved drafts</Text>
              <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                {drafts.length} parked cart{drafts.length === 1 ? "" : "s"} on this terminal
              </Text>
            </View>
            <IconButton icon={X} label="Close" onPress={onClose} />
          </View>

          {drafts.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="No drafts left"
              instruction="Save a cart with the bookmark while it still has items."
            />
          ) : (
            <FlatList
              data={drafts}
              keyExtractor={(draft) => draft.id}
              style={{ maxHeight: 420 }}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: color.border }} />
              )}
              renderItem={({ item: draft }) => {
                const items = draft.lines.reduce((sum, line) => sum + line.quantity, 0);
                const amount = cartTotal(draft.lines);
                const who = draft.customer.name?.trim() || null;

                return (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space.sm,
                      paddingVertical: space.md,
                    }}
                  >
                    <Pressable
                      onPress={() => onPick(draft)}
                      style={({ pressed }) => ({
                        flex: 1,
                        minHeight: 56,
                        justifyContent: "center",
                        gap: space.xs,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Text style={{ fontSize: fontSize.bodyLg, fontWeight: "700", color: color.ink }}>
                        {who ?? `${items} item${items === 1 ? "" : "s"}`}
                      </Text>
                      <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                        {who
                          ? `${items} item${items === 1 ? "" : "s"} · ${formatMoney(amount)}`
                          : formatMoney(amount)}
                        {" · "}
                        {timeAgo(draft.savedAt)}
                      </Text>
                    </Pressable>
                    <IconButton
                      icon={Trash2}
                      label="Delete draft"
                      tone="danger"
                      onPress={() => onDiscard(draft)}
                    />
                  </View>
                );
              }}
            />
          )}
        </View>
    </BottomSheet>
  );
}

/**
 * Last look before the sale is written. Cash needs the notes in hand so change
 * is clear; GCash/card only need the amount due confirmed.
 */
function ConfirmSaleSheet({
  open,
  shelfTotal,
  discount,
  amountDue,
  payment,
  itemCount,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  shelfTotal: number;
  discount: number;
  amountDue: number;
  payment: PaymentMethod;
  itemCount: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isCash = payment === "cash";
  const [cashDraft, setCashDraft] = useState(() => amountDue.toFixed(2));

  if (!open) return null;

  const cashOnHand = Number(cashDraft);
  const cashValid = Number.isFinite(cashOnHand) && cashOnHand >= amountDue;
  const change = cashValid ? roundMoney(cashOnHand - amountDue) : 0;
  const canConfirm = isCash ? cashValid : true;
  const methodLabel =
    PAYMENT_METHODS.find((method) => method.value === payment)?.label ?? payment;

  return (
    <BottomSheet open={open} onClose={busy ? () => undefined : onClose}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={[styles.iconWell, { width: 34, height: 34 }]}>
              <CheckCircle2 size={18} color={color.primary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subheading}>Confirm sale</Text>
              <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                {itemCount} item{itemCount === 1 ? "" : "s"} · {methodLabel}
              </Text>
            </View>
            <IconButton icon={X} label="Close" onPress={onClose} disabled={busy} />
          </View>

          <View
            style={{
              gap: space.sm,
              padding: space.md,
              borderRadius: radius.md,
              backgroundColor: color.paper,
              borderWidth: 1,
              borderColor: color.border,
            }}
          >
            <ConfirmRow label="Total amount" value={shelfTotal} />
            <ConfirmRow
              label="Discount"
              value={discount}
              muted={discount === 0}
              prefix={discount > 0 ? "-" : undefined}
            />
            <LedgerLine />
            <ConfirmRow label="Amount to pay" value={amountDue} emphasize />
          </View>

          {isCash ? (
            <View style={{ gap: space.sm }}>
              <Text style={{ fontSize: fontSize.body, fontWeight: "600" }}>
                Cash on hand
              </Text>
              <TextInput
                value={cashDraft}
                onChangeText={(next) => setCashDraft(next.replace(/[^0-9.]/g, ""))}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
                accessibilityLabel="Cash on hand from the customer"
                style={[
                  styles.numeric,
                  {
                    minHeight: 64,
                    borderWidth: 2,
                    borderColor: cashValid ? color.primary : color.danger,
                    borderRadius: radius.sm,
                    backgroundColor: cashValid ? color.primaryTint : color.dangerSoft,
                    color: cashValid ? color.primaryDark : color.dangerInk,
                    paddingHorizontal: space.md,
                    fontSize: fontSize.headingMd,
                    fontWeight: "700",
                  },
                ]}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                <Pressable
                  onPress={() => setCashDraft(amountDue.toFixed(2))}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    paddingHorizontal: space.md,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: color.primarySoft,
                    backgroundColor: pressed ? color.primarySoft : color.primaryTint,
                  })}
                >
                  <Text style={{ fontWeight: "600", color: color.primary }}>Exact</Text>
                </Pressable>
                {[50, 100, 200, 500, 1000]
                  .map((bill) => roundMoney(Math.ceil(amountDue / bill) * bill))
                  .filter((next, index, all) => next > amountDue && all.indexOf(next) === index)
                  .slice(0, 3)
                  .map((next) => (
                    <Pressable
                      key={next}
                      onPress={() => setCashDraft(next.toFixed(2))}
                      style={({ pressed }) => ({
                        minHeight: 44,
                        paddingHorizontal: space.md,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: radius.sm,
                        borderWidth: 1,
                        borderColor: color.border,
                        backgroundColor: pressed ? color.surfacePressed : color.surface,
                      })}
                    >
                      <Text style={{ fontWeight: "600", color: color.ink }}>
                        {formatMoney(next)}
                      </Text>
                    </Pressable>
                  ))}
              </View>
              {!cashValid ? (
                <Text style={{ fontSize: fontSize.body, color: color.dangerInk }}>
                  Cash on hand must cover {formatMoney(amountDue)}.
                </Text>
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    padding: space.md,
                    borderRadius: radius.sm,
                    backgroundColor: color.successSoft,
                  }}
                >
                  <Text style={{ fontSize: fontSize.body, fontWeight: "600", color: color.successInk }}>
                    Change
                  </Text>
                  <Text
                    style={[
                      styles.numeric,
                      {
                        fontSize: fontSize.headingSm,
                        fontWeight: "700",
                        color: color.successInk,
                      },
                    ]}
                  >
                    {formatMoney(change)}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={{ fontSize: fontSize.body, color: color.inkMuted }}>
              Customer pays {formatMoney(amountDue)} by {methodLabel}. No cash change.
            </Text>
          )}

          <Button
            label={busy ? "Saving..." : "Confirm and complete"}
            large
            icon={CheckCircle2}
            busy={busy}
            disabled={!canConfirm || busy}
            onPress={onConfirm}
          />
          <Button label="Back to cart" variant="secondary" disabled={busy} onPress={onClose} />
    </BottomSheet>
  );
}

function ConfirmRow({
  label,
  value,
  emphasize,
  muted,
  prefix,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
  muted?: boolean;
  prefix?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: space.sm,
      }}
    >
      <Text
        style={{
          fontSize: emphasize ? fontSize.bodyLg : fontSize.body,
          fontWeight: emphasize ? "700" : "500",
          color: muted ? color.inkMuted : emphasize ? color.primaryDark : color.ink,
        }}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.numeric,
          {
            fontSize: emphasize ? fontSize.headingSm : fontSize.bodyLg,
            fontWeight: "700",
            color: muted ? color.inkMuted : emphasize ? color.primaryDark : color.ink,
          },
        ]}
      >
        {prefix}
        {formatMoney(value)}
      </Text>
    </View>
  );
}

/**
 * The cart is a fixed side panel on a tablet and a full-screen sheet on a phone,
 * where there is no room to show it next to the product grid.
 */
function CartShell({
  compact,
  width,
  padding,
  open,
  onClose,
  children,
}: {
  compact: boolean;
  width: number;
  padding: number;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const body = (
    <View
      style={{
        // Phone modal: fill the sheet. Tablet: fixed width, stretch tall so the
        // line list can grow — never flex along the row (that empties the grid).
        flex: compact ? 1 : undefined,
        width: compact ? undefined : width,
        alignSelf: compact ? undefined : "stretch",
        backgroundColor: color.surface,
        borderLeftWidth: compact ? 0 : 1,
        borderLeftColor: color.border,
        padding,
        minHeight: 0,
      }}
    >
      {children}
    </View>
  );

  if (!compact) return body;

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }}>{body}</SafeAreaView>
    </Modal>
  );
}

function CartSummaryBar({
  itemCount,
  total,
  onPress,
}: {
  itemCount: number;
  total: number;
  onPress: () => void;
}) {
  const empty = itemCount === 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={empty}
      accessibilityRole="button"
      accessibilityLabel={`Review cart, ${itemCount} items`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        minHeight: 68,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        borderTopWidth: 1,
        borderTopColor: color.border,
        backgroundColor: empty
          ? color.surface
          : pressed
            ? color.primaryDark
            : color.primary,
      })}
    >
      <ShoppingCart
        size={22}
        color={empty ? color.inkMuted : color.onPrimary}
        strokeWidth={2}
      />
      <Text
        style={{
          fontSize: fontSize.body,
          fontWeight: "600",
          color: empty ? color.inkMuted : color.onPrimary,
        }}
      >
        {empty ? "Cart is empty" : `${itemCount} item${itemCount === 1 ? "" : "s"}`}
      </Text>

      <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Money
          value={total}
          style={{
            fontSize: fontSize.bodyLg,
            fontWeight: "700",
            color: empty ? color.inkMuted : color.onPrimary,
          }}
        />
        {empty ? null : <ChevronRight size={20} color={color.onPrimary} strokeWidth={2} />}
      </View>
    </Pressable>
  );
}
