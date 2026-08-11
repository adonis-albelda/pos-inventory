import { currentAppUser } from "@double-a/supabase";
import {
  BACKUP_DATASETS,
  buildBackupSheets,
  isBackupDatasetId,
  type BackupDatasetId,
} from "@/lib/backup-export";
import {
  sheetsToCsvZip,
  sheetsToPdf,
  sheetsToXlsx,
} from "@/lib/backup-formats";
import { storeToday } from "@/lib/date-range";
import { getServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Format = "csv" | "xlsx" | "pdf";

/**
 * Backup export: pick datasets + format. Admin only. PIN hashes never leave.
 *
 *   GET /api/export/backup?format=xlsx&datasets=products,sales
 *   datasets omitted → every known dataset.
 */
export async function GET(request: Request): Promise<Response> {
  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);

  if (!user) {
    return new Response("Sign in to download this file.\n", { status: 401 });
  }
  if (user.role !== "admin") {
    return new Response("Downloads are for the owner's account.\n", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const format = (params.get("format") ?? "csv") as Format;
  if (format !== "csv" && format !== "xlsx" && format !== "pdf") {
    return new Response("format must be csv, xlsx or pdf.\n", { status: 400 });
  }

  const raw = params.get("datasets");
  let ids: BackupDatasetId[];
  if (!raw || raw.trim() === "" || raw === "all") {
    ids = [...BACKUP_DATASETS];
  } else {
    const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) {
      return new Response("Pick at least one dataset.\n", { status: 400 });
    }
    if (!parts.every(isBackupDatasetId)) {
      return new Response(
        `Unknown dataset. Allowed: ${BACKUP_DATASETS.join(", ")}.\n`,
        { status: 400 },
      );
    }
    ids = parts;
  }

  try {
    const sheets = await buildBackupSheets(supabase, ids);
    const stamp = storeToday();

    if (format === "csv") {
      const body = await sheetsToCsvZip(sheets);
      return new Response(Buffer.from(body), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="double-a-backup-${stamp}.zip"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "xlsx") {
      const body = await sheetsToXlsx(sheets);
      return new Response(Buffer.from(body), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="double-a-backup-${stamp}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const body = await sheetsToPdf(sheets);
    return new Response(Buffer.from(body), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="double-a-backup-${stamp}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(`Could not build the file: ${message}\n`, { status: 500 });
  }
}
