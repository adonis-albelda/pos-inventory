"use client";

import type { Route } from "next";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, ClipboardList, Package, Truck, Wallet } from "lucide-react";
import {
  formatMoney,
  PURCHASE_ORDER_STATUS_LABELS,
  purchaseOrderBalance,
} from "@double-a/shared-types";
import { PO_STATUS_TONE } from "@/lib/purchase-order-status";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Money,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { usePurchaseOrders } from "@/lib/query/purchase-orders";
import { SupplierForm } from "../supplier-form";
import { DeleteSupplierButton } from "./delete-supplier-button";
import {
  useSupplier,
  useSupplierBalance,
  useSupplierProductOptions,
} from "@/lib/query/suppliers";

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();

  const supplierQuery = useSupplier(id);
  const productsQuery = useSupplierProductOptions();
  const ordersQuery = usePurchaseOrders({ supplierId: id });
  const balanceQuery = useSupplierBalance(id);

  const isPending =
    supplierQuery.isPending ||
    productsQuery.isPending ||
    ordersQuery.isPending ||
    balanceQuery.isPending;

  if (isPending) {
    return <Card className="px-4 py-8 text-center text-body text-ink-muted">Loading…</Card>;
  }

  const error =
    supplierQuery.error ?? productsQuery.error ?? ordersQuery.error ?? balanceQuery.error;
  if (error) {
    return (
      <Card className="px-4 py-8 text-center text-body text-danger">
        {error instanceof Error ? error.message : "Could not load this supplier."}
      </Card>
    );
  }

  const supplier = supplierQuery.data;
  if (!supplier) notFound();

  // GAP (see lib/query/suppliers.ts / packages/api-client/src/queries/
  // suppliers.ts): SetSupplierProductsController is write-only — no GET
  // reads a supplier's linked products back, so this page can't show or
  // pre-check what this supplier actually carries. Preserved as-is from the
  // pre-TanStack Query version: the "linked products" card below shows a
  // "not available" state, and the edit form's picker opens fully unchecked.
  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const balance = balanceQuery.data ?? 0;

  const openOrders = orders.filter(
    (order) => order.status === "ordered" || order.status === "partially_received",
  ).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href={"/suppliers" as Route}
            className="inline-flex items-center gap-1.5 text-caption text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={14} />
            Back to suppliers
          </Link>
          <h1 className="mt-2 text-heading-md font-semibold sm:text-heading-lg">
            {supplier.name}
          </h1>
          <p className="mt-1 text-body text-ink-muted">
            {[supplier.contactPerson, supplier.phone, supplier.email]
              .filter(Boolean)
              .join(" · ") || "No contact details"}
          </p>
        </div>
        <DeleteSupplierButton supplierId={id} supplierName={supplier.name} />
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Wallet}
          label="Balance owed"
          value={formatMoney(balance)}
          hint="Across unpaid installment terms"
          tone={balance > 0 ? "warning" : "neutral"}
        />
        <StatCard icon={ClipboardList} label="Purchase orders" value={String(orders.length)} />
        <StatCard
          icon={ClipboardList}
          label="Open orders"
          value={String(openOrders)}
          hint="Ordered or partially received"
          tone={openOrders > 0 ? "warning" : "neutral"}
        />
      </div>

      <Card>
        <CardHeader icon={Truck} title="Details" />
        <div className="px-4 py-5 sm:px-6">
          <SupplierForm
            supplier={supplier}
            products={products}
            linkedProductIds={[]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={Package}
          title="Linked products"
          description="What this supplier is known to carry — a convenience list, not a restriction."
        />
        <EmptyState
          icon={Package}
          title="Not available"
          instruction="The API has no way to read back which products a supplier carries yet. Editing the supplier above still lets you set the list, but it can't be shown here or pre-checked until that endpoint exists."
        />
      </Card>

      <Card>
        <CardHeader
          icon={ClipboardList}
          title={`${orders.length} purchase orders`}
          action={
            <Link
              href={`/purchase-orders/new?supplier=${id}` as Route}
              className="inline-flex items-center gap-1 text-body font-medium text-primary hover:underline"
            >
              New order
            </Link>
          }
        />
        {orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No purchase orders yet"
            instruction="Start one to record what you ordered, on what terms, and when it's due."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Order date</Th>
                <Th>Status</Th>
                <Th numeric>Total</Th>
                <Th numeric>Balance</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <Td className="num">{order.orderDate}</Td>
                  <Td>
                    <Badge tone={PO_STATUS_TONE[order.status]}>
                      {PURCHASE_ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </Td>
                  <Td numeric>
                    <Money value={order.totalAmount} />
                  </Td>
                  <Td numeric>
                    <Money value={purchaseOrderBalance(order.payments)} />
                  </Td>
                  <Td>
                    <Link
                      href={`/purchase-orders/${order.id}` as Route}
                      className="text-body text-primary hover:underline"
                    >
                      Open
                    </Link>
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
