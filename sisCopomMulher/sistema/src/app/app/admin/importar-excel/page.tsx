import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import ImportarExcelClient from "./importar-excel-client";

export const dynamic = "force-dynamic";

export default async function ImportarExcelPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login?next=/app/admin/importar-excel");
  }
  if (session.role !== "ADMINISTRADOR") {
    redirect("/app/dashboard");
  }
  return <ImportarExcelClient />;
}
