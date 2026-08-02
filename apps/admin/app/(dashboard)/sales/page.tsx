import type { Route } from "next";
import Link from "next/link";
import {
  Banknote,
  ChevronRight,
  CreditCard,
  Download,
  Receipt,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { formatMoney } from "@double-a/shared-types";
import { listSales, listUsers } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import {
  Badge,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Money,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
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
  }>;
}) {
  const params = await searchParams;
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

  const revenue = sales
    .filter((sale) => sale.status === "completed")
    .reduce((sum, sale) => sum + sale.totalAmount, 0);

  const devices = [...new Set(sales.map((sale) => sale.deviceId).filter(Boolean))] as string[];

  // The export takes the same dates and state the table is showing, so what
  // downloads matches what is on screen.
  const exportQuery = new URLSearchParams();
  if (params.from) exportQuery.set("from", params.from);
  if (params.to) exportQuery.set("to", params.to);
  if (params.status) exportQuery.set("status", params.status);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Receipt}
        title="Sales"
        description="Every sale that has reached Supabase. A sale made offline appears here only after its terminal syncs."
        action={
          <ButtonLink
            href={`/api/export/sales?${exportQuery.toString()}`}
            icon={Download}
            download
          >
            Export CSV
          </ButtonLink>
        }
      />

      <Card>
        <CardHeader icon={SlidersHorizontal} title="Filter" />
        <div className="px-4 py-5 sm:px-6">
          <SalesFilters users={users} devices={devices} />
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={Receipt}
          title={`${sales.length} sales`}
          description={`${formatMoney(revenue)} from completed sales in this range.`}
        />
        {sales.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No sales in this range"
            instruction="Widen the dates, or check that the terminal has synced."
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
              {sales.map((sale) => {
                const soldAt = new Date(sale.createdAt).toLocaleString("en-PH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                });

                return (
                  <tr key={sale.id} className="group relative cursor-pointer">
                    <Td className="whitespace-nowrap">
                      {/* Covers the whole row so any cell opens the sale detail. */}
                      <Link
                        href={`/sales/${sale.id}` as Route}
                        className="absolute inset-0 z-10"
                        aria-label={`View sale from ${soldAt}`}
                      />
                      <span className="num font-medium text-primary group-hover:underline">
                        {soldAt}
                      </span>
                      {/* Under the timestamp rather than in a column of its own:
                          most sales have no customer, and an eighth column that is
                          usually a dash costs every row width. */}
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
                        <span className="inline-flex items-center gap-2 whitespace-nowrap capitalize">
                          {sale.paymentMethod === "cash" ? (
                            <Banknote size={15} className="text-ink-muted" />
                          ) : (
                            <CreditCard size={15} className="text-ink-muted" />
                          )}
                          {sale.paymentMethod}
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
      </Card>
    </div>
  );
}
