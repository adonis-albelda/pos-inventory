import {
  Banknote,
  CalendarRange,
  ChartColumn,
  Coins,
  Download,
  HandCoins,
  Package,
  PackageSearch,
  Percent,
  Receipt,
  Smartphone,
  Snowflake,
  SlidersHorizontal,
  Trophy,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Truck,
  UserRound,
  Wallet,
  Warehouse,
} from "lucide-react";
import { formatMoney, formatPercent } from "@double-a/shared-types";
import {
  currentAppUser,
  listBelowReorder,
  reportByCashier,
  reportByDevice,
  reportDeadStock,
  reportDiscounts,
  reportInventoryValuation,
  reportProfit,
  reportTopProducts,
  sumExpenses,
  summariseProfit,
} from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { formatStoreDay, resolveRange } from "@/lib/date-range";
import {
  Badge,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Money,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { DeadStockDays } from "./dead-stock-days";
import { DEAD_STOCK_DEFAULT_DAYS, DEAD_STOCK_WINDOWS } from "./dead-stock-windows";
import { ReportFilters } from "./report-filters";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string; days?: string }>;
}) {
  const params = await searchParams;
  const { preset, fromDay, toDay, range, label } = resolveRange(params);
  const deadStockDays = DEAD_STOCK_WINDOWS.includes(Number(params.days))
    ? Number(params.days)
    : DEAD_STOCK_DEFAULT_DAYS;

  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);

  // Supplier cost and margin are the owner's business, and the database
  // refuses these functions to anyone else. Say so rather than crashing.
  if (user?.role !== "admin") {
    return (
      <div className="space-y-6">
        <PageHeader icon={ChartColumn} title="Reports" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Reports are for the owner's account"
            instruction="Profit, supplier cost and margin are only shown to an admin. Ask the owner to sign in."
          />
        </Card>
      </div>
    );
  }

  const [
    profitRows,
    topProducts,
    discounts,
    cashiers,
    devices,
    valuation,
    deadStock,
    reorder,
    expensesTotal,
  ] = await Promise.all([
    reportProfit(supabase, range),
    reportTopProducts(supabase, range, 20),
    reportDiscounts(supabase, range),
    reportByCashier(supabase, range),
    reportByDevice(supabase, range),
    reportInventoryValuation(supabase),
    reportDeadStock(supabase, deadStockDays),
    listBelowReorder(supabase),
    sumExpenses(supabase, { fromDay, toDay }),
  ]);

  const totals = summariseProfit(profitRows);
  const net = totals.revenue - expensesTotal;
  const rangeQuery = `from=${fromDay}&to=${toDay}`;

  const stockCost = valuation.reduce((sum, row) => sum + Number(row.cost_value), 0);
  const stockRetail = valuation.reduce((sum, row) => sum + Number(row.retail_value), 0);
  const restockCost = reorder.reduce((sum, row) => sum + Number(row.restock_cost), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ChartColumn}
        title="Reports"
        description="What the shop made, who sold it, and what is sitting on the shelves."
        action={
          <ButtonLink
            href={`/api/export/sales?${rangeQuery}`}
            icon={Download}
            download
          >
            Export sales
          </ButtonLink>
        }
      />

      <Card>
        <CardHeader icon={SlidersHorizontal} title="Range" description={label} />
        <div className="px-4 py-5 sm:px-6">
          <ReportFilters preset={preset} fromDay={fromDay} toDay={toDay} />
        </div>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Profit                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Revenue"
          value={formatMoney(totals.revenue)}
          hint={`${totals.salesCount} sales, ${totals.itemsSold} items`}
          tone="primary"
        />
        <StatCard
          icon={Truck}
          label="Supplier cost"
          value={formatMoney(totals.cost)}
          hint="What the goods cost you"
        />
        <StatCard
          icon={Coins}
          label="Gross profit"
          value={formatMoney(totals.grossProfit)}
          tone={totals.grossProfit < 0 ? "danger" : "success"}
        />
        <StatCard
          icon={Percent}
          label="Margin"
          value={formatPercent(totals.marginPercent)}
          hint="Share of revenue kept"
        />
        <StatCard
          icon={HandCoins}
          label="Discounts given"
          value={formatMoney(totals.discount)}
          hint="Knocked off at the counter"
          tone={totals.discount > 0 ? "warning" : "neutral"}
        />
        <StatCard
          icon={Wallet}
          label="Expenses"
          value={formatMoney(expensesTotal)}
          hint="Operating outlays in this range"
          tone={expensesTotal > 0 ? "warning" : "neutral"}
        />
        <StatCard
          icon={TrendingDown}
          label="Net"
          value={formatMoney(net)}
          hint="Revenue minus expenses"
          tone={net < 0 ? "danger" : "success"}
        />
      </div>

      <Card>
        <CardHeader
          icon={CalendarRange}
          title="Day by day"
          description={`Completed sales, ${label}.`}
        />
        {profitRows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No sales in this range"
            instruction="Widen the dates, or check that the terminals have synced today's sales."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Day</Th>
                <Th numeric>Sales</Th>
                <Th numeric>Items</Th>
                <Th numeric>Revenue</Th>
                <Th numeric>Discounts</Th>
                <Th numeric>Supplier cost</Th>
                <Th numeric>Gross profit</Th>
                <Th numeric>Margin</Th>
              </tr>
            </thead>
            <tbody>
              {profitRows.map((row) => (
                <tr key={row.bucket}>
                  <Td className="whitespace-nowrap font-medium">
                    {formatStoreDay(row.bucket)}
                  </Td>
                  <Td numeric>{Number(row.sales_count)}</Td>
                  <Td numeric>{Number(row.items_sold)}</Td>
                  <Td numeric>
                    <Money value={Number(row.revenue)} />
                  </Td>
                  <Td numeric className="text-ink-muted">
                    <Money value={Number(row.discount)} />
                  </Td>
                  <Td numeric className="text-ink-muted">
                    <Money value={Number(row.cost)} />
                  </Td>
                  <Td
                    numeric
                    className={
                      Number(row.gross_profit) < 0
                        ? "font-semibold text-danger"
                        : "font-semibold"
                    }
                  >
                    <Money value={Number(row.gross_profit)} />
                  </Td>
                  <Td numeric>{formatPercent(Number(row.margin_percent))}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Top products                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader
          icon={Trophy}
          title="Top products by profit"
          description="What actually earns, not just what sells."
        />
        {topProducts.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nothing sold in this range"
            instruction="Pick a wider range to see which products earn the most."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th numeric>Sold</Th>
                <Th numeric>Revenue</Th>
                <Th numeric>Supplier cost</Th>
                <Th numeric>Gross profit</Th>
                <Th numeric>Margin</Th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((row) => (
                <tr key={row.product_id ?? row.product_name}>
                  <Td className="font-medium">{row.product_name}</Td>
                  <Td className="text-ink-muted">{row.category ?? "—"}</Td>
                  <Td numeric>{Number(row.quantity_sold)}</Td>
                  <Td numeric>
                    <Money value={Number(row.revenue)} />
                  </Td>
                  <Td numeric className="text-ink-muted">
                    <Money value={Number(row.cost)} />
                  </Td>
                  <Td numeric className="font-semibold">
                    <Money value={Number(row.gross_profit)} />
                  </Td>
                  <Td numeric>{formatPercent(Number(row.margin_percent))}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Discounts                                                          */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader
          icon={HandCoins}
          title="Discounts given"
          description="Every price knocked down at the counter, biggest first."
          action={
            <ButtonLink
              href={`/api/export/discounts?${rangeQuery}`}
              icon={Download}
              size="sm"
              download
            >
              Export
            </ButtonLink>
          }
        />
        {discounts.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Nothing was discounted"
            instruction="Every item in this range sold at its shelf price."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Sold at</Th>
                <Th>Cashier</Th>
                <Th>Terminal</Th>
                <Th>Product</Th>
                <Th numeric>Qty</Th>
                <Th numeric>Shelf price</Th>
                <Th numeric>Sold for</Th>
                <Th numeric>Given away</Th>
                <Th>Flag</Th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((row, index) => (
                <tr key={`${row.sale_id}-${index}`}>
                  <Td className="num whitespace-nowrap text-ink-muted">
                    {new Date(row.sold_at).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Td>
                  <Td>{row.cashier_name ?? "—"}</Td>
                  <Td className="num text-ink-muted">{row.device_id ?? "—"}</Td>
                  <Td className="font-medium">{row.product_name}</Td>
                  <Td numeric>{row.quantity}</Td>
                  <Td numeric className="text-ink-muted">
                    <Money value={Number(row.list_price)} />
                  </Td>
                  <Td numeric>
                    <Money value={Number(row.unit_price)} />
                  </Td>
                  <Td numeric className="font-semibold">
                    <Money value={Number(row.discount_total)} />
                    <span className="mt-0.5 block text-caption font-normal text-ink-muted">
                      {formatPercent(Number(row.discount_percent))} off
                    </span>
                  </Td>
                  <Td>
                    {row.below_cost ? (
                      <Badge tone="danger" icon={TriangleAlert}>
                        Below cost
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Normal</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Who sold it                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader icon={UserRound} title="Per cashier" />
          {cashiers.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title="No sales in this range"
              instruction="Once a terminal syncs, each cashier's takings show here."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Cashier</Th>
                  <Th numeric>Sales</Th>
                  <Th numeric>Revenue</Th>
                  <Th numeric>Discounts</Th>
                  <Th numeric>Profit</Th>
                </tr>
              </thead>
              <tbody>
                {cashiers.map((row) => (
                  <tr key={row.user_id ?? row.cashier_name}>
                    <Td className="font-medium">{row.cashier_name}</Td>
                    <Td numeric>{Number(row.sales_count)}</Td>
                    <Td numeric>
                      <Money value={Number(row.revenue)} />
                      <span className="mt-0.5 block text-caption text-ink-muted">
                        {formatMoney(Number(row.average_sale))} average
                      </span>
                    </Td>
                    <Td numeric className="text-ink-muted">
                      <Money value={Number(row.discount)} />
                    </Td>
                    <Td numeric className="font-semibold">
                      <Money value={Number(row.gross_profit)} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader icon={Smartphone} title="Per terminal" />
          {devices.length === 0 ? (
            <EmptyState
              icon={Smartphone}
              title="No sales in this range"
              instruction="Each terminal appears here after it pushes its sales."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Terminal</Th>
                  <Th numeric>Sales</Th>
                  <Th numeric>Revenue</Th>
                  <Th numeric>Profit</Th>
                  <Th>Last sale</Th>
                </tr>
              </thead>
              <tbody>
                {devices.map((row) => (
                  <tr key={row.device_id}>
                    <Td className="num font-medium">{row.device_id}</Td>
                    <Td numeric>{Number(row.sales_count)}</Td>
                    <Td numeric>
                      <Money value={Number(row.revenue)} />
                    </Td>
                    <Td numeric className="font-semibold">
                      <Money value={Number(row.gross_profit)} />
                    </Td>
                    <Td className="num whitespace-nowrap text-ink-muted">
                      {new Date(row.last_sale_at).toLocaleString("en-PH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* What is on the shelves                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Warehouse}
          label="Stock at cost"
          value={formatMoney(stockCost)}
          hint="Money tied up on the shelves"
        />
        <StatCard
          icon={Banknote}
          label="Stock at shelf price"
          value={formatMoney(stockRetail)}
        />
        <StatCard
          icon={Coins}
          label="Profit if it all sells"
          value={formatMoney(stockRetail - stockCost)}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader
          icon={Warehouse}
          title="Stock value"
          description={`${valuation.length} products in stock, dearest first.`}
          action={
            <ButtonLink
              href="/api/export/valuation"
              icon={Download}
              size="sm"
              download
            >
              Export
            </ButtonLink>
          }
        />
        {valuation.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="Nothing on the shelves"
            instruction="Add products and record their opening stock in Inventory."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th numeric>Stock</Th>
                <Th numeric>Supplier price</Th>
                <Th numeric>At cost</Th>
                <Th numeric>At shelf price</Th>
                <Th numeric>Profit if sold</Th>
              </tr>
            </thead>
            <tbody>
              {valuation.map((row) => (
                <tr key={row.product_id}>
                  <Td className="font-medium">{row.product_name}</Td>
                  <Td className="text-ink-muted">{row.category ?? "—"}</Td>
                  <Td numeric>
                    {row.stock_quantity} {row.unit}
                  </Td>
                  <Td numeric className="text-ink-muted">
                    <Money value={Number(row.cost_price)} />
                  </Td>
                  <Td numeric>
                    <Money value={Number(row.cost_value)} />
                  </Td>
                  <Td numeric>
                    <Money value={Number(row.retail_value)} />
                  </Td>
                  <Td numeric className="font-semibold">
                    <Money value={Number(row.potential_profit)} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={Snowflake}
          title="Dead stock"
          description="On the shelf, tying up money, not moving."
          action={<DeadStockDays days={deadStockDays} />}
        />
        {deadStock.length === 0 ? (
          <EmptyState
            icon={Snowflake}
            title="Everything is moving"
            instruction={`Every product in stock has sold within the last ${deadStockDays} days.`}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>SKU</Th>
                <Th>Category</Th>
                <Th numeric>Stock</Th>
                <Th numeric>Tied up</Th>
                <Th>Last sold</Th>
              </tr>
            </thead>
            <tbody>
              {deadStock.map((row) => (
                <tr key={row.product_id}>
                  <Td className="font-medium">{row.product_name}</Td>
                  <Td className="num text-ink-muted">{row.sku ?? "—"}</Td>
                  <Td className="text-ink-muted">{row.category ?? "—"}</Td>
                  <Td numeric>{row.stock_quantity}</Td>
                  <Td numeric className="font-semibold">
                    <Money value={Number(row.cost_value)} />
                  </Td>
                  <Td className="whitespace-nowrap">
                    {row.last_sold_at ? (
                      <span className="text-ink-muted">
                        {new Date(row.last_sold_at).toLocaleDateString("en-PH", {
                          dateStyle: "medium",
                        })}{" "}
                        ({row.days_since_sale} days ago)
                      </span>
                    ) : (
                      <Badge tone="warning">Never sold</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={PackageSearch}
          title="Reorder list"
          description={
            reorder.length > 0
              ? `${reorder.length} products at or below their reorder point. ${formatMoney(restockCost)} to top them all up.`
              : "Products at or below their own reorder point."
          }
          action={
            <ButtonLink href="/api/export/reorder" icon={Download} size="sm" download>
              Export
            </ButtonLink>
          }
        />
        {reorder.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="Nothing needs reordering"
            instruction="A product lands here once it falls to its own reorder point. Set that per product on the Products page."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>SKU</Th>
                <Th>Category</Th>
                <Th numeric>Stock</Th>
                <Th numeric>Reorder at</Th>
                <Th numeric>Short by</Th>
                <Th numeric>Cost to restock</Th>
              </tr>
            </thead>
            <tbody>
              {reorder.map((row) => (
                <tr key={row.id}>
                  <Td className="font-medium">{row.name}</Td>
                  <Td className="num text-ink-muted">{row.sku ?? "—"}</Td>
                  <Td className="text-ink-muted">{row.category ?? "—"}</Td>
                  <Td
                    numeric
                    className={row.stock_quantity <= 0 ? "font-semibold text-danger" : ""}
                  >
                    {row.stock_quantity} {row.unit}
                  </Td>
                  <Td numeric className="text-ink-muted">
                    {row.reorder_point}
                  </Td>
                  <Td numeric className="font-semibold">
                    {row.short_by}
                  </Td>
                  <Td numeric>
                    <Money value={Number(row.restock_cost)} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
