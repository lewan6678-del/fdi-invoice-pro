import { AlertTriangle, CheckCircle2, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ApiErrorShape {
  code?: string;
  message: string;
  hint?: string;
}

const tones = {
  error: { cls: "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200", Icon: AlertTriangle },
  success: { cls: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200", Icon: CheckCircle2 },
  info: { cls: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200", Icon: Info },
};

/** Thông báo lỗi luôn kèm hướng khắc phục (nếu có). */
export function Alert({ tone = "error", title, hint, className }: { tone?: keyof typeof tones; title: string; hint?: string | null; className?: string }) {
  const { cls, Icon } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-md border p-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">{title}</p>
        {hint && (
          <p className="mt-1 flex items-start gap-1.5 opacity-90">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Cách khắc phục: {hint}</span>
          </p>
        )}
      </div>
    </div>
  );
}
