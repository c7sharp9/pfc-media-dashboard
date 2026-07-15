import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatShortDate } from "@/lib/utils";
import { OpenLinkButton } from "@/components/fields";
import { PlatformBadge, StatusBadge, TypeBadge } from "@/components/badges";
import NewEditDialog from "@/components/new-edit-dialog";
import type { Edit, Sermon } from "@shared/schema";

// Header for a group of edits from the same service date
function GroupHeader({ date, sermon }: { date: string; sermon?: Sermon }) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-1.5 min-w-0">
      <span className="text-xs font-semibold text-foreground">
        {date ? formatShortDate(date) : "No date"}
      </span>
      {sermon ? (
        <>
          <PlatformBadge platform={sermon.fields["Platform"]} className="text-[10px] leading-tight" />
          <Link
            href={`/sermon/${sermon.id}`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground truncate group"
          >
            <span className="truncate">{sermon.fields["Title"] || "Untitled sermon"}</span>
            <ChevronRight className="w-3 h-3 shrink-0 opacity-60 group-hover:opacity-100" />
          </Link>
        </>
      ) : (
        date && <span className="text-xs text-muted-foreground/60">No sermon record</span>
      )}
    </div>
  );
}

// One edit = one compact row; the whole row opens the edit workspace.
function EditRow({ edit }: { edit: Edit }) {
  const f = edit.fields;
  return (
    <Link href={`/edits/${edit.id}`} className="block">
      <Card className="px-3 py-2 flex items-center gap-2.5 cursor-pointer hover:bg-accent/30 transition-colors group">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {f["Title"] || "Untitled Edit"}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {f["Type"]?.map((t) => (
              <TypeBadge key={t} type={t} className="text-[10px] leading-tight" />
            ))}
            <StatusBadge status={f["Status"]} className="text-[10px] leading-tight" />
            {f["Version"] != null && (
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums">v{f["Version"]}</span>
            )}
            {f["Editor Name"] && (
              <span className="text-[10px] text-muted-foreground">{f["Editor Name"]}</span>
            )}
            {f["Date Completed"] && (
              <span className="text-[10px] text-muted-foreground">
                Completed {formatShortDate(f["Date Completed"])}
              </span>
            )}
          </div>
        </div>
        {f["Video URL"] && (
          <OpenLinkButton url={f["Video URL"]} label="Open video" className="h-6 px-1.5" />
        )}
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
      </Card>
    </Link>
  );
}

export default function EditsPage() {
  const [filter, setFilter] = useState("all");

  const { data: edits, isLoading, error } = useQuery<Edit[]>({
    queryKey: ["/api/edits"],
  });

  const filtered = edits?.filter((e) => {
    if (filter === "all") return true;
    return e.fields["Status"] === filter;
  });

  // Group edits by broadcast date, newest service first (undated last)
  const groups = useMemo(() => {
    const map = new Map<string, Edit[]>();
    for (const edit of filtered || []) {
      const date = edit.fields["Broadcast Date"] || "";
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(edit);
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (!a[0]) return 1;
      if (!b[0]) return -1;
      return b[0].localeCompare(a[0]);
    });
  }, [filtered]);

  // Batch-fetch the sermons behind the visible group dates for the headers
  const groupDates = useMemo(() => groups.map(([date]) => date).filter(Boolean), [groups]);
  const datesCsv = groupDates.join(",");
  const { data: sermonsByDates } = useQuery<{ records: Sermon[] }>({
    queryKey: ["/api/sermons/by-dates", datesCsv],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sermons/by-dates?dates=${datesCsv}`);
      return res.json();
    },
    enabled: groupDates.length > 0,
  });
  const sermonByDate = useMemo(() => {
    const map: Record<string, Sermon> = {};
    for (const s of sermonsByDates?.records || []) {
      const d = s.fields["Service"];
      if (d && !map[d]) map[d] = s;
    }
    return map;
  }, [sermonsByDates]);

  return (
    <div className="p-3 md:p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Edits</h1>
          <p className="text-xs text-muted-foreground">
            Track video edits, recaps, and clips
          </p>
        </div>
        <NewEditDialog />
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mb-1">
        <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="all" className="text-xs" data-testid="edit-filter-all">
            All
          </TabsTrigger>
          <TabsTrigger value="In Progress" className="text-xs" data-testid="edit-filter-progress">
            In Progress
          </TabsTrigger>
          <TabsTrigger value="Ready for Review" className="text-xs" data-testid="edit-filter-review">
            Review
          </TabsTrigger>
          <TabsTrigger value="Revision Needed" className="text-xs" data-testid="edit-filter-revision">
            Revision
          </TabsTrigger>
          <TabsTrigger value="Revision Ready for Review" className="text-xs" data-testid="edit-filter-rev-review">
            Rev. Review
          </TabsTrigger>
          <TabsTrigger value="Completed" className="text-xs" data-testid="edit-filter-completed">
            Completed
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-1.5 mt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Failed to load edits. Check the connection to Airtable.
        </div>
      ) : groups.length > 0 ? (
        <div>
          {groups.map(([date, groupEdits]) => (
            <section key={date || "undated"}>
              <GroupHeader date={date} sermon={sermonByDate[date]} />
              <div className="space-y-1.5">
                {groupEdits.map((edit) => (
                  <EditRow key={edit.id} edit={edit} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No edits found.
        </div>
      )}
    </div>
  );
}
