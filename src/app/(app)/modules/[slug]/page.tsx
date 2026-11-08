import { notFound } from "next/navigation";
import { Construction, CheckCircle2, Circle } from "lucide-react";
import { MODULES } from "@/lib/modules";
import { Card, CardContent, CardHeader, CardTitle, PageHeader, Badge } from "@/components/ui/card";

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = MODULES.find((x) => x.slug === slug);
  if (!m) notFound();
  return (
    <div>
      <PageHeader title={m.title} description={m.description} actions={<Badge tone="amber" className="px-3 py-1 text-sm"><Construction className="h-4 w-4" /> Đang phát triển</Badge>} />
      <Card className="max-w-3xl">
        <CardHeader><CardTitle>Module này chưa hoạt động</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">Chức năng chưa có backend nên không hiển thị nút thao tác. Kiến trúc đã được chuẩn bị như sau:</p>
          <ul className="space-y-2">
            {m.plan.map((p) => <li key={p} className="flex gap-2"><Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />{p}</li>)}
          </ul>
          {m.dependsOn && <p className="flex gap-2 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Nền tảng sẵn sàng: {m.dependsOn}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
