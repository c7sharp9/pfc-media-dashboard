import { History } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Reads the plain-text "Activity" field (newest first, one entry per line,
// written by both API layers and the CI scripts) and lists it.
//
// The point of showing it is that a dispatch line with nothing after it means
// the click registered but the job never reported back -- which used to be
// indistinguishable from a job still running.
export default function ActivityLog({ value }: { value?: string }) {
  const entries = (value || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="mt-4">
      <Separator className="my-3" />
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
        <History className="w-3.5 h-3.5" /> Activity
      </h2>
      {entries.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/70">
          Nothing yet. Actions like Prepare, Generate and Send get logged here with a time.
        </p>
      ) : (
        <ul className="space-y-1" data-testid="activity-log">
          {entries.map((line, i) => {
            // "Aug 6, 6:52 PM  Sent 15 moments to the website"
            const m = line.match(/^(.{3,}?[AP]M)\s+(.*)$/);
            const when = m ? m[1] : "";
            const what = m ? m[2] : line;
            return (
              <li key={i} className="flex items-baseline gap-2 text-[11px] leading-snug">
                <span className="text-muted-foreground/70 tabular-nums whitespace-nowrap shrink-0">
                  {when}
                </span>
                <span className={i === 0 ? "text-foreground" : "text-muted-foreground"}>{what}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
