import { getWorkspace } from "@/server/auth/current";
import { PageHeader } from "@/components/ui/card";
import { CompaniesTable } from "@/components/app/companies-table";

export default async function CompaniesPage() {
  const ws = await getWorkspace();
  const rows = ws.companies.map((c) => ({
    id: c.id, taxCode: c.taxCode, name: c.name, englishName: c.englishName, address: c.address, fiscalYearStartMonth: c.fiscalYearStartMonth,
    currentFiscalYear: c.currentFiscalYear, investorCountry: c.investorCountry, email: c.email, phone: c.phone, isActive: c.isActive,
    myRole: c.myRole ?? null, _count: c._count,
  }));
  return (
    <div>
      <PageHeader title="Quản lý công ty" description="Danh sách pháp nhân (MST) bạn được phân quyền. Dữ liệu mỗi công ty được cô lập hoàn toàn." />
      <CompaniesTable rows={rows} isSystemAdmin={ws.actor.isSystemAdmin} />
    </div>
  );
}
