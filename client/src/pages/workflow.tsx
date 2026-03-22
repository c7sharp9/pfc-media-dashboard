import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";
import type { WorkflowStep } from "@shared/schema";

const platformOrder = ["GENERAL", "YouTube", "Website", "Facebook", "AI"];

function getPlatformColor(platform: string): string {
  switch (platform?.toUpperCase()) {
    case "GENERAL":
      return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    case "YOUTUBE":
      return "bg-red-500/15 text-red-400 border-red-500/20";
    case "WEBSITE":
      return "bg-blue-500/15 text-blue-400 border-blue-500/20";
    case "FACEBOOK":
      return "bg-indigo-500/15 text-indigo-400 border-indigo-500/20";
    case "AI":
      return "bg-purple-500/15 text-purple-400 border-purple-500/20";
    default:
      return "";
  }
}

export default function WorkflowPage() {
  const { data: steps, isLoading, error } = useQuery<WorkflowStep[]>({
    queryKey: ["/api/workflow"],
  });

  // Group steps by platform
  const grouped: Record<string, WorkflowStep[]> = {};
  if (steps) {
    for (const step of steps) {
      const platform = step.fields["Platform"] || "Other";
      if (!grouped[platform]) grouped[platform] = [];
      grouped[platform].push(step);
    }
  }

  // Sort groups by defined order
  const sortedPlatforms = Object.keys(grouped).sort((a, b) => {
    const ai = platformOrder.indexOf(a.toUpperCase());
    const bi = platformOrder.indexOf(b.toUpperCase());
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return (
    <div className="p-3 md:p-4 max-w-5xl mx-auto">
      <div className="mb-3">
        <h1 className="text-base font-semibold text-foreground">Workflow Reference</h1>
        <p className="text-xs text-muted-foreground">
          Step-by-step guide for sermon media processing
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Failed to load workflow steps.
        </div>
      ) : (
        <div className="space-y-5">
          {sortedPlatforms.map((platform) => (
            <section key={platform}>
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="secondary"
                  className={`text-xs ${getPlatformColor(platform)}`}
                >
                  {platform}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {grouped[platform].length} step{grouped[platform].length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-1.5">
                {grouped[platform].map((step, idx) => (
                  <Card
                    key={step.id}
                    className="p-3"
                    data-testid={`workflow-step-${step.id}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-mono shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-foreground">
                          {step.fields["Name"] || "Unnamed Step"}
                        </h3>
                        {step.fields["Notes"] && (
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            {step.fields["Notes"]}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          {step.fields["Tutorial URL"] && (
                            <a
                              href={step.fields["Tutorial URL"]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Tutorial
                            </a>
                          )}
                          {step.fields["Example URL"] && (
                            <a
                              href={step.fields["Example URL"]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Example
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
