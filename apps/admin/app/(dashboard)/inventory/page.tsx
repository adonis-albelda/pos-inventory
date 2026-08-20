"use client";

import { useSearchParams } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  History,
  PackageSearch,
  Scale,
  TriangleAlert,
  Warehouse,
} from "lucide-react";
import { formatMoney, stockLevel } from "@double-a/shared-types";
import { matchesQuery, paginateItems, parseListQuery } from "@/lib/list-query";
import { toCategoryOptions, descendantIds } from "@/lib/category-options";
import { resolveDayWindow } from "@/lib/date-range";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { TabNav } from "@/components/tab-nav";
import { isReason } from "@/lib/inventory-reasons";
import { useCategories } from "@/lib/query/categories";
import { useUsers } from "@/lib/query/users";
import {
  useInventoryMovements,
  useInventoryProductNames,
  useInventoryProducts,
  useMovementTotals,
  useProductIdsMatching,
} from "@/lib/query/inventory";
import { MovementsPanel } from "./movements-panel";
import { StockPanel } from "./stock-panel";
import {
  isStockSort,
  isStockState,
  MOVEMENTS_PAGE_SIZE,
  type StockSort,
  type StockState,
} from "./view-options";

interface InventorySearchParams {
  tab?: string;
  q?: string;
  page?: string;
  product?: string;
  state?: string;
  category?: string;
  sort?: string;
  reason?: string;
  from?: string;
  to?: string;
}

/** Filters live in the URL, so every href a panel renders keeps the rest of them. */
function buildHref(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/inventory?${query}` : "/inventory";
}

export default function InventoryPage() {
  const searchParams = useSearchParams();
  const params: InventorySearchParams = {
    tab: searchParams.get("tab") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    product: searchParams.get("product") ?? undefined,
    state: searchParams.get("state") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    reason: searchParams.get("reason") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  };

  const tab = params.tab === "movements" ? "movements" : "stock";
  const { q, page } = parseListQuery(params);
  const focusedProduct = params.product;
  const state: StockState = isStockState(params.state) ? params.state : "all";
  const sort: StockSort = isStockSort(params.sort) ? params.sort : "name";
  const reason = isReason(params.reason) ? params.reason : undefined;
  const dayWindow = resolveDayWindow(params);
  const isMovementsTab = tab === "movements";

  // Whole catalogue, needed by both tabs (header stats; Stock on hand filters
  // it client-side; Movement history resolves a name search through it).
  const productsQuery = useInventoryProducts({ includeInactive: true });
  const categoriesQuery = useCategories({ includeInactive: true });

  // Movements tab only, but hooks stay unconditional — gated with `enabled`
  // instead of a conditional call. A name search reaches inventory_movements
  // through product ids: the table itself holds no product name.
  const searchQ = isMovementsTab ? q : "";
  const searchIdsQuery = useProductIdsMatching(searchQ, { includeInactive: true });
  const searchIdsPending = isMovementsTab && Boolean(searchQ) && searchIdsQuery.isPending;
  const searchIds = isMovementsTab ? searchIdsQuery.data : undefined;

  // GAP: GET /inventory/movements only accepts `product_id` + `per_page`
  // (packages/api-client/src/queries/inventory.ts MovementFilter) — the old
  // PostgREST query's `productIds` (batch, for a name search matching more
  // than one product), `reasons`, and `from`/`to` date-range filters have no
  // equivalent on the Tally API and are dropped here rather than faked. A
  // search that matches exactly one product still narrows the list (via
  // `productId`); a search matching zero or several no longer filters
  // server-side. The reason select and date range picker on this tab still
  // render and update the URL (dayWindow/reason are kept below only for
  // their display label and to keep MovementsPanel's existing props), but no
  // longer narrow the results.
  const singleMatch = searchIds?.length === 1 ? searchIds[0] : undefined;
  const nothingMatches = isMovementsTab && searchIds?.length === 0;
  const movementFilter = { productId: focusedProduct ?? singleMatch };
  const movementsEnabled = isMovementsTab && !searchIdsPending && !nothingMatches;

  const movementsQuery = useInventoryMovements(
    { ...movementFilter, page, pageSize: MOVEMENTS_PAGE_SIZE },
    { enabled: movementsEnabled },
  );
  const totalsQuery = useMovementTotals(movementFilter, { enabled: movementsEnabled });
  const usersQuery = useUsers({ includeInactive: true });

  const movementPage = nothingMatches
    ? { movements: [], total: 0, lastPage: 1 }
    : (movementsQuery.data ?? { movements: [], total: 0, lastPage: 1 });
  const totals = nothingMatches
    ? { stockIn: 0, stockOut: 0, net: 0, count: 0 }
    : (totalsQuery.data ?? { stockIn: 0, stockOut: 0, net: 0, count: 0 });

  const nameIds = isMovementsTab
    ? [...movementPage.movements.map((movement) => movement.productId), ...(focusedProduct ? [focusedProduct] : [])]
    : [];
  const namesQuery = useInventoryProductNames(nameIds);

  const movementsTabPending =
    isMovementsTab &&
    (searchIdsPending ||
      (movementsEnabled && (movementsQuery.isPending || totalsQuery.isPending)) ||
      usersQuery.isPending ||
      (nameIds.length > 0 && namesQuery.isPending));
  const movementsTabError =
    isMovementsTab &&
    (searchIdsQuery.isError ||
      (movementsEnabled && (movementsQuery.isError || totalsQuery.isError)) ||
      usersQuery.isError ||
      (nameIds.length > 0 && namesQuery.isError));

  const pending = productsQuery.isPending || categoriesQuery.isPending || movementsTabPending;
  const isError = productsQuery.isError || categoriesQuery.isError || movementsTabError;
  const firstError = [productsQuery, categoriesQuery, movementsQuery, totalsQuery, searchIdsQuery, usersQuery, namesQuery]
    .map((q2) => q2.error)
    .find((error) => error instanceof Error);

  const header = (
    <PageHeader
      icon={Boxes}
      title="Inventory"
      description="Stock changes are recorded as movements, never edited directly. Sales from terminals appear here once they sync."
    />
  );

  if (pending) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="px-4 py-8 text-center text-body text-ink-muted">Loading…</Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="px-4 py-8 text-center text-body text-danger">
          {firstError instanceof Error ? firstError.message : "Could not load inventory."}
        </Card>
      </div>
    );
  }

  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const categoryOptions = toCategoryOptions(categories);

  // Whole-shop figures: what is on the shelves right now, not what the current
  // filter happens to show.
  const sellable = products.filter((product) => product.isActive);
  const stockCost = sellable.reduce(
    (sum, product) => sum + product.costPrice * Math.max(0, product.stockQuantity),
    0,
  );
  const attention = sellable.filter((product) => {
    const level = stockLevel(product.stockQuantity, product.reorderPoint);
    return level === "low" || level === "out";
  }).length;
  const oversold = sellable.filter((product) => product.stockQuantity < 0).length;
  const hidden = products.length - sellable.length;

  const tabs = [
    {
      key: "stock",
      label: "Stock on hand",
      icon: Warehouse,
      count: sellable.length,
      href: buildHref({
        tab: "stock",
        q,
        state: state === "all" ? undefined : state,
        category: params.category,
        sort: sort === "name" ? undefined : sort,
      }),
    },
    {
      key: "movements",
      label: "Movement history",
      icon: History,
      href: buildHref({
        tab: "movements",
        q,
        product: focusedProduct,
        reason,
        from: dayWindow.fromDay ?? undefined,
        to: dayWindow.toDay ?? undefined,
      }),
    },
  ];

  if (tab === "movements") {
    const userNames = Object.fromEntries((usersQuery.data ?? []).map((user) => [user.id, user.name]));
    const productNames = Object.fromEntries((namesQuery.data ?? []).map((product) => [product.id, product.name]));

    return (
      <div className="space-y-6">
        {header}
        <TabNav items={tabs} active={tab} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={ArrowUpRight}
            label="Stock in"
            value={String(totals.stockIn)}
            hint="Restocks, corrections up, voided sales"
            tone="success"
          />
          <StatCard
            icon={ArrowDownRight}
            label="Stock out"
            value={String(totals.stockOut)}
            hint="Sales and downward adjustments"
            tone={totals.stockOut > 0 ? "warning" : "neutral"}
          />
          <StatCard
            icon={Scale}
            label="Net change"
            value={`${totals.net > 0 ? "+" : ""}${totals.net}`}
            hint="Units the shelves gained or lost"
            tone={totals.net < 0 ? "danger" : "primary"}
          />
          <StatCard
            icon={History}
            label="Movements"
            value={String(movementPage.total)}
            hint={dayWindow.label}
          />
        </div>

        <MovementsPanel
          movements={movementPage.movements}
          total={movementPage.total}
          page={page}
          pageSize={MOVEMENTS_PAGE_SIZE}
          productNames={productNames}
          userNames={userNames}
          query={q}
          reason={reason}
          focusedProduct={focusedProduct}
          fromDay={dayWindow.fromDay}
          toDay={dayWindow.toDay}
          rangeLabel={dayWindow.label}
        />
      </div>
    );
  }

  // Picking a category takes everything filed under it, children included, and
  // matches on ids — the path text on a product outlives the category itself.
  const categoryScope = params.category
    ? descendantIds(categoryOptions, params.category)
    : null;

  const filtered = products
    .filter((product) => matchesQuery([product.name, product.sku, product.barcode], q))
    .filter((product) => {
      if (!categoryScope) return true;
      return product.categoryId ? categoryScope.has(product.categoryId) : false;
    })
    .filter((product) => {
      const level = stockLevel(product.stockQuantity, product.reorderPoint);
      switch (state) {
        case "attention":
          return product.isActive && (level === "low" || level === "out");
        case "low":
          return level === "low";
        case "out":
          return level === "out";
        case "oversold":
          return product.stockQuantity < 0;
        case "healthy":
          return level === "healthy";
        case "hidden":
          return !product.isActive;
        default:
          return true;
      }
    });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "stock-asc":
        return a.stockQuantity - b.stockQuantity || a.name.localeCompare(b.name);
      case "stock-desc":
        return b.stockQuantity - a.stockQuantity || a.name.localeCompare(b.name);
      case "short-desc":
        return (
          b.reorderPoint - b.stockQuantity - (a.reorderPoint - a.stockQuantity) ||
          a.name.localeCompare(b.name)
        );
      case "value-desc":
        return (
          b.costPrice * b.stockQuantity - a.costPrice * a.stockQuantity ||
          a.name.localeCompare(b.name)
        );
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const { pageItems, page: safePage, pageCount, total, pageSize } = paginateItems(
    sorted,
    page,
  );

  return (
    <div className="space-y-6">
      {header}
      <TabNav items={tabs} active={tab} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Warehouse}
          label="Products tracked"
          value={String(sellable.length)}
          hint={hidden > 0 ? `${hidden} hidden from terminals` : "All visible to terminals"}
        />
        <StatCard
          icon={Boxes}
          label="Stock at cost"
          value={formatMoney(stockCost)}
          hint="Money sitting on the shelves"
          tone="primary"
        />
        <StatCard
          icon={PackageSearch}
          label="Needs reordering"
          value={String(attention)}
          hint="At or below its reorder point"
          tone={attention > 0 ? "warning" : "success"}
        />
        <StatCard
          icon={TriangleAlert}
          label="Oversold"
          value={String(oversold)}
          hint="Negative stock to correct"
          tone={oversold > 0 ? "danger" : "success"}
        />
      </div>

      <StockPanel
        products={pageItems}
        categories={categoryOptions}
        query={q}
        state={state}
        sort={sort}
        category={params.category}
        page={safePage}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        focusedProduct={focusedProduct}
      />
    </div>
  );
}
