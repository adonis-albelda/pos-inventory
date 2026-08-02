import type { Route } from "next";
import Link from "next/link";
import {
  Banknote,
  ChevronRight,
  CreditCard,
  Receipt,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { formatMoney } from "@double-a/shared-types";
import { listSales, listUsers } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { matchesQuery, paginateItems, parseListQuery } from "@/lib/list-query";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Money,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { Pagination, RecordToolbar } from "@/components/record-list";
import { SalesFilters } from "./sales-filters";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    userId?: string;
    deviceId?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const { q, page } = parseListQuery(params);
  const supabase = await getServerClient();

  const [sales, users] = await Promise.all([
    listSales(supabase, {
      from: params.from ? new Date(params.from).toISOString() : undefined,
      to: params.to ? new Date(`${params.to}T23:59:59`).toISOString() : undefined,
      userId: params.userId || undefined,
      deviceId: params.deviceId || undefined,
      status: params.status || undefined,
      limit: 300,
    }),
    listUsers(supabase, { includeInactive: true }),
  ]);

  const filtered = sales.filter((sale) =>
    matchesQuery(
      [
        sale.cashierName,
        sale.customerName,
        sale.deviceId,
        sale.paymentMethod,
        sale.status,
        sale.id,
      ],
      q,
    ),
  );
  const { pageItems, page: safePage, pageCount, total, pageSize } = paginateItems(
    filtered,
    page,
  );

  const revenue = filtered
    .filter((sale) => sale.status === "completed")
    .reduce((sum, sale) => sum + sale.totalAmount, 0);

  const devices = [...new Set(sales.map((sale) => sale.deviceId).filter(Boolean))] as string[];

  const exportQuery = new URLSearchParams();
  if (params.from) exportQuery.set("from", params.from);
  if (params.to) exportQuery.set("to", params.to);
  if (params.status) exportQuery.set("status", params.status);

  const listQuery = {
    q: q || undefined,
    from: params.from,
    to: params.to,
    userId: params.userId,
    deviceId: params.deviceId,
    status: params.status,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Receipt}
        title="Sales"
        description="Every sale that has reached Supabase. A sale made offline appears here only after its terminal syncs."
      />

      <Card>
        <CardHeader icon={SlidersHorizontal} title="Filter" />
        <div className="px-4 py-5 sm:px-6">
          <SalesFilters users={users} devices={devices} />
        </div>
      </Card>

      <Card>
        <RecordToolbar
          searchPlaceholder="Search cashier, customer, terminal…"
          query={q}
          exportHref={`/api/export/sales?${exportQuery.toString()}`}
          preserve={listQuery}
        />
        <div className="border-b border-border px-4 py-3 text-caption text-ink-muted sm:px-6">
          {formatMoney(revenue)} from completed sales in this range
          {q ? ` · ${total} match${total === 1 ? "" : "es"}` : ""}
        </div>

        {total === 0 ? (
          <EmptyState
            icon={Receipt}
            title={q ? "Nothing matches that search" : "No sales in this range"}
            instruction={
              q
                ? "Try a different cashier, customer or terminal."
                : "Widen the dates, or check that the terminal has synced."
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Sold at</Th>
                <Th>Cashier</Th>
                <Th>Terminal</Th>
                <Th>Payment</Th>
                <Th numeric>Items</Th>
                <Th numeric>Total</Th>
                <Th>State</Th>
                <Th>
                  <span className="sr-only">Open</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((sale) => {
                const soldAt = new Date(sale.createdAt).toLocaleString("en-PH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                });

                return (
                  <tr key={sale.id} className="group relative cursor-pointer">
                    <Td className="whitespace-nowrap">
                      <Link
                        href={`/sales/${sale.id}` as Route}
                        className="absolute inset-0 z-10"
                        aria-label={`View sale from ${soldAt}`}
                      />
                      <span className="num font-medium text-primary group-hover:underline">
                        {soldAt}
                      </span>
                      {sale.customerName ? (
                        <span className="mt-0.5 flex items-center gap-1.5 text-caption text-ink-muted">
                          <UserRound size={12} />
                          {sale.customerName}
                        </span>
                      ) : null}
                    </Td>
                    <Td>{sale.cashierName ?? "—"}</Td>
                    <Td className="num text-ink-muted">{sale.deviceId ?? "—"}</Td>
                    <Td>
                      {sale.paymentMethod ? (
                        <span className="inline-flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-2 whitespace-nowrap capitalize">
                            {sale.paymentMethod === "cash" ? (
                              <Banknote size={15} className="text-ink-muted" />
                            ) : (
                              <CreditCard size={15} className="text-ink-muted" />
                            )}
                            {sale.paymentMethod}
                          </span>
                          <span className="flex flex-wrap gap-1">
                            {sale.isPaid ? (
                              <Badge tone="success">Paid</Badge>
                            ) : (
                              <Badge tone="warning">Unpaid</Badge>
                            )}
                            {sale.fulfillment === "delivery" ? (
                              <Badge tone={sale.deliveryCompleted ? "success" : "warning"}>
                                {sale.deliveryCompleted ? "Delivered" : "Delivery"}
                              </Badge>
                            ) : null}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td numeric>
                      {sale.items.reduce((count, item) => count + item.quantity, 0)}
                    </Td>
                    <Td numeric>
                      <Money value={sale.totalAmount} className="font-semibold" />
                    </Td>
                    <Td>
                      {sale.status === "completed" ? (
                        <Badge tone="success">Completed</Badge>
                      ) : sale.status === "voided" ? (
                        <Badge tone="danger">Voided</Badge>
                      ) : (
                        <Badge tone="warning">Refunded</Badge>
                      )}
                    </Td>
                    <Td>
                      <ChevronRight
                        size={16}
                        className="text-ink-muted transition-colors group-hover:text-primary"
                        aria-hidden
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        <Pagination
          page={safePage}
          pageCount={pageCount}
          total={total}
          pageSize={pageSize}
          basePath="/sales"
          query={listQuery}
        />
      </Card>
    </div>
  );
}
