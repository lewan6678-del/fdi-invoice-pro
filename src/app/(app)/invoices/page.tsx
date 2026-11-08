import { getWorkspace } from "@/server/auth/current";
import { canEdit } from "@/server/auth/rbac";
import { PageHeader } from "@/components/ui/card";
import { NoCompany } from "@/components/app/no-company";
import { InvoiceBrowser } from "@/components/app/invoice-browser";
import { periodLabel } from "@/lib/period";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const ws = await getWorkspace();
  if (!ws.company) return <NoCompany isSystemAdmin={ws.actor.isSystemAdmin} />;
  const sp = await searchParams;
  return (
    <div>
      <PageHeader title="Hóa đơn" description={`${ws.company.name} – MST ${ws.company.taxCode} · ${periodLabel(ws.periodObj)}`} />
      <InvoiceBrowser key={ws.company.id + ws.period} companyId={ws.company.id} period={ws.period} canEdit={canEdit(ws.company.myRole ?? null)} openId={sp.open ?? null} />
    </div>
  );
}
