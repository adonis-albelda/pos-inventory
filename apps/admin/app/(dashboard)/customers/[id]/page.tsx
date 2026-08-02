import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt, UserRound } from "lucide-react";
import { formatMoney } from "@double-a/shared-types";
import { getCustomer, listSales } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Money,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { CustomerForm } from "../customer-form";
import { DeleteCustomerButton } from "./delete-customer-button";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerClient();

  const customer = await getCustomer(supabase, id);
  if (!customer) notFound();

  const sales = await listSales(supabase, { customerId: id, limit: 500 });
  const revenue = sales
    .filter((sale) => sale.status === "completed")
    .reduce((sum, sale) => sum + sale.totalAmount, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href={"/customers" as Route}
            className="inline-flex items-center gap-1.5 text-caption text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={14} />
            Back to customers
          </Link>
          <h1 className="mt-2 text-heading-md font-semibold sm:text-heading-lg">
            {customer.name}
          </h1>
          <p className="mt-1 text-body text-ink-muted">
            {[customer.contact, customer.address].filter(Boolean).join(" · ") ||
              "No contact details"}
          </p>
        </div>
        <DeleteCustomerButton customerId={id} customerName={customer.name} />
      </header>

      <Card>
        <CardHeader icon={UserRound} title="Details" />
        <div className="px-4 py-5 sm:px-6">
          <CustomerForm customer={customer} />
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={Receipt}
          title={`${sales.length} sales`}
          description={`${formatMoney(revenue)} from completed sales.`}
        />
        {sales.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No sales yet"
            instruction="Sales linked to this customer from the POS will show up here after sync."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Payment</Th>
                <Th>Fulfillment</Th>
                <Th>Paid</Th>
                <Th numeric>Total</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <Td>
                    {new Date(sale.createdAt).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Td>
                  <Td className="capitalize">{sale.paymentMethod ?? "—"}</Td>
                  <Td className="capitalize">
                    {sale.fulfillment}
                    {sale.fulfillment === "delivery"
                      ? sale.deliveryCompleted
                        ? " · done"
                        : " · open"
                      : ""}
                  </Td>
                  <Td>
                    {sale.isPaid ? (
                      <Badge tone="success">Paid</Badge>
                    ) : (
                      <Badge tone="warning">Unpaid</Badge>
                    )}
                  </Td>
                  <Td numeric>
                    <Money value={sale.totalAmount} />
                  </Td>
                  <Td>
                    <Link
                      href={`/sales/${sale.id}`}
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
