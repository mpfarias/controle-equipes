import type { NextRequest } from "next/server";
import { handlePostImportExcel } from "@/server/controllers/import-excel.controller";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  return handlePostImportExcel(req);
}
