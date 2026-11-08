import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getWorkspace } from "@/server/auth/current";
import { getCompany } from "@/server/services/companies";
import { listMembers } from "@/server/services/users";
import { canAdmin } from "@/server/auth/rbac";
import { Card, CardContent, PageHeader, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MembersPanel } from "@/components/app/members-panel";

export default async function CompanyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace();
  const c = await getCompany(ws.actor, id);
  const members = await listMembers(ws.actor, id);
  return (
    <div>
      <PageHeader title={c.name} description={`MST ${c.taxCode} · ${c.address}`} actions={<Button variant="outline" asChild><Link href="/companies"><ArrowLeft /> Danh sách công ty</Link></Button>} />
      <Card className="mb-6">
        <CardContent className="grid gap-4 p-5 text-sm sm:grid-cols-4">
          <div><p className="text-muted-foreground">Tên tiếng Anh</p><p className="font-medium">{c.englishName || "—"}</p></div>
          <div><p className="text-muted-foreground">Năm tài chính</p><p className="font-medium">{c.currentFiscalYear} · bắt đầu tháng {c.fiscalYearStartMonth}</p></div>
          <div><p className="text-muted-foreground">Nhà đầu tư</p><p className="font-medium">{c.investorCountry || "—"}</p></div>
          <div><p className="text-muted-foreground">Trạng thái</p>{c.isActive ? <Badge tone="green">Hoạt động</Badge> : <Badge tone="red">Ngừng hoạt động</Badge>}</div>
        </CardContent>
      </Card>
      <MembersPanel companyId={id} members={JSON.parse(JSON.stringify(members))} canAdmin={canAdmin(c.myRole)} meId={ws.actor.id} />
    </div>
  );
}
