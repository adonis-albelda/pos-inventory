"use server";

import { revalidatePath } from "next/cache";
import {
  EXPENSE_CATEGORY_MAX,
  EXPENSE_DESCRIPTION_MAX,
  EXPENSE_NOTE_MAX,
  roundMoney,
} from "@double-a/shared-types";
import {
  createExpense,
  currentAppUser,
  deleteExpense,
  updateExpense,
} from "@double-a/supabase";
import type { FormState } from "@/lib/form-state";
import { getServerClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateExpenseViews() {
  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function saveExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = text(formData, "id");
  const description = text(formData, "description");
  const categoryRaw = text(formData, "category");
  const noteRaw = text(formData, "note");
  const expenseDate = text(formData, "expense_date");
  const amount = Number(formData.get("amount") ?? 0);

  if (!description) {
    return { error: "Say what the money was for.", ok: false };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be greater than zero.", ok: false };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
    return { error: "Pick a valid date.", ok: false };
  }

  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);
  if (user?.role !== "admin") {
    return { error: "Only the owner can record expenses.", ok: false };
  }

  const row = {
    description: description.slice(0, EXPENSE_DESCRIPTION_MAX),
    amount: roundMoney(amount),
    category: categoryRaw
      ? categoryRaw.slice(0, EXPENSE_CATEGORY_MAX)
      : null,
    expense_date: expenseDate,
    note: noteRaw ? noteRaw.slice(0, EXPENSE_NOTE_MAX) : null,
  };

  try {
    if (id) {
      await updateExpense(supabase, id, row);
    } else {
      await createExpense(supabase, { ...row, created_by: user.id });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: `Could not save the expense: ${message}`, ok: false };
  }

  revalidateExpenseViews();
  return { error: null, ok: true };
}

export async function removeExpense(formData: FormData): Promise<void> {
  const id = text(formData, "id");
  if (!id) return;

  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);
  if (user?.role !== "admin") return;

  await deleteExpense(supabase, id);
  revalidateExpenseViews();
}
