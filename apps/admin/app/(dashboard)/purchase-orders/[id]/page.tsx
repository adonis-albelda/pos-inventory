import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, ListOrdered, Wallet } from "lucide-react";
import {
  formatMoney,
  formatQuantity,
  PURCHASE_ORDER_STATUS_LABELS,
  poItemReceiveState,
  purchaseOrderBalance,
} from "@double-a/shared-types";
import { getPurchaseOrder, listMovements } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { PO_STATUS_TONE } from "@/lib/purchase-order-status";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Money,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { ReceiveLineForm } from "./receive-line-form";
import {
  markPaymentPaidAction,
  markPaymentUnpaidAction,
  updatePurchaseOrderStatusAction,
} from "./actions";

const RECEIVE_STATE_BADGE = {
  pending: { tone: "neutral" as const, label: "Not received" },
  partial: { tone: "warning" as const, label: "Partially received" },
  received: { tone: "success" as const, label: "Received" },
};

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerClient();

  const order = await getPurchaseOrder(supabase, id);
  if (!order) notFound();

  const movements = await listMovements(supabase, { referenceId: id, limit: 200 });
  const balance = purchaseOrderBalance(order.payments);
  const canReceive = order.status === "ordered" || order.status === "partially_received";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href={"/purchase-orders" as Route}
            className="inline-flex items-center gap-1.5 text-caption text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={14} />
            Back to purchase orders
          </Link>
          <h1 className="mt-2 text-heading-md font-semibold sm:text-heading-lg">
            <Link
              href={`/suppliers/${order.supplierId}` as Route}
              className="text-primary hover:underline"
            >
              {order.supplierName}
            </Link>
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-ink-muted">
            <span>Ordered {order.orderDate}</span>
            {order.expectedDate ? <span>Expected {order.expectedDate}</span> : null}
            {order.referenceNo ? <span className="num">Ref {order.referenceNo}</span> : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {order.status === "draft" ? (
            <form action={updatePurchaseOrderStatusAction}>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="status" value="ordered" />
              <Button type="submit" size="sm">
                Mark as ordered
              </Button>
            </form>
          ) : null}
          {order.status === "draft" || order.status === "ordered" ? (
            <form action={updatePurchaseOrderStatusAction}>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="status" value="cancelled" />
              <Button type="submit" variant="secondary" size="sm">
                Cancel order
              </Button>
            </form>
          ) : null}
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <Badge tone={PO_STATUS_TONE[order.status]}>
          {PURCHASE_ORDER_STATUS_LABELS[order.status]}
        </Badge>
      </div>

      {order.notes ? (
        <Card>
          <CardHeader icon={ListOrdered} title="Notes" />
          <p className="px-4 py-4 text-body text-ink-muted sm:px-6">{order.notes}</p>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          icon={ListOrdered}
          title="Line items"
          description={
            order.status === "draft"
              ? "Sent to the supplier once you mark this order as ordered."
              : canReceive
                ? "Record what actually shows up — partial deliveries are fine."
                : "Every line has been received."
          }
        />
        {order.items.length === 0 ? (
          <EmptyState
            icon={ListOrdered}
            title="No line items"
            instruction="This order has no products on it."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th numeric>Ordered</Th>
                <Th numeric>Received</Th>
                <Th numeric>Unit cost</Th>
                <Th numeric>Line total</Th>
                <Th>State</Th>
                {canReceive ? <Th /> : null}
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const state = poItemReceiveState(item);
                const remaining = item.quantityOrdered - item.quantityReceived;
                const badge = RECEIVE_STATE_BADGE[state];

                return (
                  <tr key={item.id}>
                    <Td className="font-medium">{item.productName}</Td>
                    <Td numeric>{formatQuantity(item.quantityOrdered)}</Td>
                    <Td numeric>{formatQuantity(item.quantityReceived)}</Td>
                    <Td numeric>
                      <Money value={item.unitCost} />
                    </Td>
                    <Td numeric>
                      <Money value={item.lineTotal} className="font-semibold" />
                    </Td>
                    <Td>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </Td>
                    {canReceive ? (
                      <Td>
                        {remaining > 0 ? (
                          <ReceiveLineForm
                            itemId={item.id}
                            purchaseOrderId={order.id}
                            productId={item.productId}
                            remaining={remaining}
                          />
                        ) : null}
                      </Td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <div className="ledger-line mx-4 sm:mx-6" />
        <div className="flex items-baseline justify-between px-4 py-4 sm:px-6">
          <span className="text-body font-medium tracking-wide uppercase">Total</span>
          <Money value={order.totalAmount} className="text-heading-md font-semibold" />
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={Wallet}
          title="Payment terms"
          description={
            order.payments.length === 0
              ? "No installments recorded — mark the whole order paid whenever it settles."
              : `${formatMoney(balance)} still owed across unpaid terms.`
          }
        />
        {order.payments.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No payment terms"
            instruction="This order has no installment schedule."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Term</Th>
                <Th>Due date</Th>
                <Th numeric>Amount</Th>
                <Th>State</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {order.payments
                .slice()
                .sort((a, b) => a.termNumber - b.termNumber)
                .map((term) => (
                  <tr key={term.id}>
                    <Td>#{term.termNumber}</Td>
                    <Td className="num text-ink-muted">{term.dueDate ?? "—"}</Td>
                    <Td numeric>
                      <Money value={term.amount} />
                    </Td>
                    <Td>
                      {term.isPaid ? (
                        <Badge tone="success">Paid</Badge>
                      ) : (
                        <Badge tone="warning">Unpaid</Badge>
                      )}
                    </Td>
                    <Td>
                      <form action={term.isPaid ? markPaymentUnpaidAction : markPaymentPaidAction}>
                        <input type="hidden" name="payment_id" value={term.id} />
                        <input type="hidden" name="purchase_order_id" value={order.id} />
                        <div className="flex justify-end">
                          <Button type="submit" variant="secondary" size="sm">
                            {term.isPaid ? "Mark unpaid" : "Mark paid"}
                          </Button>
                        </div>
                      </form>
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={Boxes}
          title="Stock effect"
          description="What receiving this order did to inventory."
        />
        {movements.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Nothing received yet"
            instruction="Movements appear here as lines are marked received."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th numeric>Change</Th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <Td className="num text-ink-muted">
                    {new Date(movement.createdAt).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Td>
                  <Td numeric className="font-semibold text-success">
                    +{movement.changeQuantity}
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
