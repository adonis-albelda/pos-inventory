import type { Route } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList, Plus, SlidersHorizontal, TriangleAlert } from "lucide-react";
import type { PurchaseOrderStatus } from "@double-a/shared-types";
import {
  PURCHASE_ORDER_STATUS_LABELS,
  poItemReceiveState,
  purchaseOrderBalance,
} from "@double-a/shared-types";
import { currentAppUser, listPurchaseOrders, listSuppliers } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { matchesQuery, paginateItems, parseListQuery } from "@/lib/list-query";
import { PO_STATUS_TONE } from "@/lib/purchase-order-status";
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
import { Pagination, RecordToolbar } from "@/components/record-list";
import { PurchaseOrdersFilters } from "./purchase-orders-filters";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    supplierId?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const { q, page } = parseListQuery(params);
  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);

  if (user?.role !== "admin") {
    return (
      <div className="space-y-6">
        <PageHeader icon={ClipboardList} title="Purchase orders" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Purchase orders are for the owner's account"
            instruction="Only an admin can manage suppliers and purchase orders."
          />
        </Card>
      </div>
    );
  }

  const [orders, suppliers] = await Promise.all([
    listPurchaseOrders(supabase, {
      supplierId: params.supplierId || undefined,
      status: (params.status as PurchaseOrderStatus) || undefined,
    }),
    listSuppliers(supabase, { includeInactive: true }),
  ]);

  const filtered = orders.filter((order) =>
    matchesQuery([order.supplierName, order.referenceNo, order.notes], q),
  );
  const { pageItems, page: safePage, pageCount, total, pageSize } = paginateItems(
    filtered,
    page,
  );

  const listQuery = {
    q: q || undefined,
    supplierId: params.supplierId,
    status: params.status,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title="Purchase orders"
        description="What you've ordered from each supplier, on what terms, and what's still on the way."
        action={
          <ButtonLink href="/purchase-orders/new" icon={Plus}>
            New purchase order
          </ButtonLink>
        }
      />

      <Card>
        <CardHeader icon={SlidersHorizontal} title="Filter" />
        <div className="px-4 py-5 sm:px-6">
          <PurchaseOrdersFilters suppliers={suppliers} />
        </div>
      </Card>

      <Card>
        <RecordToolbar
          searchPlaceholder="Search supplier, reference, notes…"
          query={q}
          preserve={listQuery}
        />

        {total === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={q ? "Nothing matches that search" : "No purchase orders yet"}
            instruction={
              q
                ? "Try a different supplier or reference."
                : "Start one to record what you ordered, on what terms, and what's shown up."
            }
            action={
              !q ? (
                <ButtonLink href="/purchase-orders/new" icon={Plus}>
                  New purchase order
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Order date</Th>
                <Th>Supplier</Th>
                <Th>Status</Th>
                <Th numeric>Lines received</Th>
                <Th numeric>Total</Th>
                <Th numeric>Balance</Th>
                <Th>
                  <span className="sr-only">Open</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((order) => {
                const receivedLines = order.items.filter(
                  (item) => poItemReceiveState(item) === "received",
                ).length;

                return (
                  <tr key={order.id} className="group relative cursor-pointer">
                    <Td className="whitespace-nowrap">
                      <Link
                        href={`/purchase-orders/${order.id}` as Route}
                        className="absolute inset-0 z-10"
                        aria-label={`View purchase order for ${order.supplierName}`}
                      />
                      <span className="num font-medium text-primary group-hover:underline">
                        {order.orderDate}
                      </span>
                    </Td>
                    <Td>{order.supplierName}</Td>
                    <Td>
                      <Badge tone={PO_STATUS_TONE[order.status]}>
                        {PURCHASE_ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </Td>
                    <Td numeric>
                      {order.items.length === 0
                        ? "—"
                        : `${receivedLines}/${order.items.length}`}
                    </Td>
                    <Td numeric>
                      <Money value={order.totalAmount} className="font-semibold" />
                    </Td>
                    <Td numeric>
                      <Money value={purchaseOrderBalance(order.payments)} />
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
          basePath="/purchase-orders"
          query={listQuery}
        />
      </Card>
    </div>
  );
}
