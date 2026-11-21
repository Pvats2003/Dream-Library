import { buildExport } from "@/lib/data/export";
import { todayInTz } from "@/lib/dates";
import { fileName, SHEET_KEYS, toCsv, type SheetKey } from "@/lib/export";
import { requireLibrary } from "@/lib/session";
import { toXlsx } from "@/lib/xlsx";

/**
 * Download the library's data: /export/all.xlsx (everything, one tab per
 * part) or /export/<part>.csv. Owners only: it holds every student's phone
 * number and all the money.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const { membership } = await requireLibrary();
  if (membership.role !== "owner") return new Response("Only the owner can download data.", { status: 403 });

  const m = /^([a-z]+)\.(csv|xlsx)$/.exec(file);
  const part = m?.[1];
  const ext = m?.[2] as "csv" | "xlsx" | undefined;
  const isAll = part === "all" && ext === "xlsx";
  const isSheet = ext === "csv" && (SHEET_KEYS as readonly string[]).includes(part ?? "");
  if (!isAll && !isSheet) return new Response("Not found", { status: 404 });

  const today = todayInTz(membership.timezone);
  const sheets = await buildExport(membership.libraryId, membership.timezone, today, isAll ? undefined : (part as SheetKey));
  const name = fileName(membership.libraryName, part!, today, ext!);
  const headers = {
    "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "private, no-store",
  };
  if (isAll) {
    const body = await toXlsx(sheets, membership.libraryName);
    return new Response(new Uint8Array(body), {
      headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  }
  return new Response(toCsv(sheets[0]), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
}
