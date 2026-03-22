import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, ChevronRight, ChevronDown, Loader2, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Sermon } from "@shared/schema";

const INITIAL_PAGE_SIZE = 16; // ~2 months of services
const LOAD_MORE_SIZE = 20;

interface SermonsPage {
  records: Sermon[];
  nextCursor: string | null;
}

function computeProgress(sermon: Sermon): number {
  const f = sermon.fields;
  const platform = f["Platform"];

  if (platform === "Sunday") {
    // 7 steps: Full Service, Trimmed Service, Transcription, YouTube, YouTube Hide, Facebook, Website
    const steps = [
      !!f["Video URL"],
      !!(f["Trimmed Video URL"] && f["Audio URL"]),
      !!f["Transcription URL"],
      !!f["YouTube Trimmed URL"],
      !!f["YouTube Hidden"],
      !!f["Facebook Done"],
      !!f["Website Done"],
    ];
    return Math.round((steps.filter(Boolean).length / steps.length) * 100);
  } else if (platform === "Wednesday") {
    // 6 steps: Clean Edit, Audio, Transcription, Trim Live Streams, YouTube Link, Website
    const steps = [
      !!f["Video URL"],
      !!f["Audio URL"],
      !!f["Transcription URL"],
      !!(f["Facebook Done"] && f["Wednesday YouTube Trimmed"]),
      !!f["Wednesday YouTube Link"],
      !!f["Website Done"],
    ];
    return Math.round((steps.filter(Boolean).length / steps.length) * 100);
  }
  return 0;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SermonRow({ sermon }: { sermon: Sermon }) {
  const progress = computeProgress(sermon);
  const platform = sermon.fields["Platform"] || "Unknown";
  const isSunday = platform === "Sunday";

  return (
    <Link href={`/sermon/${sermon.id}`}>
      <div
        data-testid={`sermon-row-${sermon.id}`}
        className="flex items-center gap-3 px-3 py-2 border-b border-border hover:bg-accent/50 cursor-pointer transition-colors group"
      >
        <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-md bg-muted">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs text-muted-foreground">
              {formatDate(sermon.fields["Service"])}
            </span>
            <Badge
              variant="secondary"
              className={`text-xs px-1.5 py-0 ${
                isSunday
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/15 text-amber-400 border-amber-500/20"
              }`}
            >
              {platform}
            </Badge>
          </div>
          <p className="text-sm font-medium text-foreground truncate">
            {sermon.fields["Title"] || "(No title)"}
          </p>
        </div>
        <div className="w-24 sm:w-32 shrink-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs text-muted-foreground">{progress}%</span>
          </div>
          <Progress
            value={progress}
            className="h-1"
          />
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </Link>
  );
}

export default function SermonsList() {
  const [filter, setFilter] = useState("all");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newPlatform, setNewPlatform] = useState("Sunday");

  const createMutation = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/sermons", fields);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sermons"] });
      setDialogOpen(false);
      setNewDate("");
      setNewPlatform("Sunday");
      toast({ title: "Created", description: "New sermon added." });
      navigate(`/sermon/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!newDate) return;
    createMutation.mutate({ Service: newDate, Platform: newPlatform });
  };

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<SermonsPage>({
    queryKey: ["/api/sermons"],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set("pageSize", pageParam ? String(LOAD_MORE_SIZE) : String(INITIAL_PAGE_SIZE));
      if (pageParam) params.set("cursor", pageParam as string);
      const res = await apiRequest("GET", `/api/sermons?${params.toString()}`);
      return res.json();
    },
    initialPageParam: "" as string,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
  });

  // Flatten all pages into a single list
  const allSermons = data?.pages.flatMap((page) => page.records) || [];

  const filtered = allSermons.filter((s) => {
    if (filter === "all") return true;
    return s.fields["Platform"]?.toLowerCase() === filter;
  });

  return (
    <div className="p-3 md:p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Sermons</h1>
          <p className="text-xs text-muted-foreground">
            Track workflow progress for each service
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 h-7 text-xs" data-testid="button-new-sermon">
              <Plus className="w-3.5 h-3.5" /> New Sermon
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm">New Sermon</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <Label className="text-xs">Service Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="text-xs h-8"
                  data-testid="input-new-date"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Platform</Label>
                <Select value={newPlatform} onValueChange={setNewPlatform}>
                  <SelectTrigger className="text-xs h-8" data-testid="select-new-platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sunday">Sunday</SelectItem>
                    <SelectItem value="Wednesday">Wednesday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreate}
                disabled={!newDate || createMutation.isPending}
                className="w-full h-8 text-xs"
                data-testid="button-create-sermon"
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mb-3">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all" data-testid="filter-all" className="text-xs">
            All
          </TabsTrigger>
          <TabsTrigger value="sunday" data-testid="filter-sunday" className="text-xs">
            Sunday
          </TabsTrigger>
          <TabsTrigger value="wednesday" data-testid="filter-wednesday" className="text-xs">
            Wednesday
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <Skeleton className="w-8 h-8 rounded-md hidden sm:block" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-4 w-60" />
                </div>
                <Skeleton className="h-1.5 w-24 sm:w-32" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Failed to load sermons. Check the connection to Airtable.
          </div>
        ) : filtered.length > 0 ? (
          <>
            {filtered.map((sermon) => (
              <SermonRow key={sermon.id} sermon={sermon} />
            ))}
            {hasNextPage && (
              <div className="flex justify-center py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  data-testid="button-load-more"
                >
                  {isFetchingNextPage ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</>
                  ) : (
                    <><ChevronDown className="w-3.5 h-3.5" /> Load More</>
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No sermons found.
          </div>
        )}
      </div>
    </div>
  );
}
