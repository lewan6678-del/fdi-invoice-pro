import { getWorkspace } from "@/server/auth/current";
import { Sidebar } from "@/components/app/sidebar";
import { Header } from "@/components/app/header";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ws = await getWorkspace();
  return (
    <div className="flex min-h-screen">
      <Sidebar isSystemAdmin={ws.actor.isSystemAdmin} role={ws.company?.myRole ?? null} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          user={{ name: ws.actor.name, email: ws.actor.email, isSystemAdmin: ws.actor.isSystemAdmin }}
          companies={ws.companies.map((c) => ({ id: c.id, name: c.name, taxCode: c.taxCode, isActive: c.isActive }))}
          companyId={ws.company?.id ?? null}
          period={ws.period}
        />
        <main className="flex-1 px-6 py-6 xl:px-8">{children}</main>
      </div>
    </div>
  );
}
