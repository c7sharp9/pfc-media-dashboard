import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Single source of truth for the color language used across pages:
// platform (Sunday/Wednesday), edit status, and edit type.

export function PlatformBadge({
  platform,
  className,
}: {
  platform?: string;
  className?: string;
}) {
  if (!platform) return null;
  const color =
    platform === "Sunday"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
      : platform === "Wednesday"
        ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
        : "";
  return (
    <Badge variant="secondary" className={cn("text-xs px-1.5 py-0", color, className)}>
      {platform}
    </Badge>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status?: string;
  className?: string;
}) {
  if (!status) return null;
  const color =
    status === "In Progress"
      ? "bg-blue-500/15 text-blue-400 border-blue-500/20"
      : status === "Ready for Review"
        ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
        : status === "Revision Needed"
          ? "bg-orange-500/15 text-orange-400 border-orange-500/20"
          : status === "Completed"
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
            : "";
  return (
    <Badge variant="secondary" className={cn("text-xs px-1.5 py-0", color, className)}>
      {status}
    </Badge>
  );
}

export function TypeBadge({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const color =
    type === "Recap"
      ? "bg-purple-500/15 text-purple-400 border-purple-500/20"
      : type === "Clip"
        ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/20"
        : type === "Sizzle"
          ? "bg-pink-500/15 text-pink-400 border-pink-500/20"
          : "";
  return (
    <Badge variant="secondary" className={cn("text-xs px-1.5 py-0", color, className)}>
      {type}
    </Badge>
  );
}
