import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpandTextarea } from "@/components/ui/expand-textarea";
import {
  Search, Copy, Check, Globe, Clock, ChevronRight, ChevronDown,
  ChevronsDownUp, ChevronsUpDown,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatLongDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface QuoteRecord {
  id: string;
  fields: {
    "Quote Original"?: string;
    "Quote Final"?: string;
    "Video Timecode"?: string;
    "Service Date"?: string;
    "On Website"?: boolean;
    Reviewed?: boolean;
    Source?: string;
    Speaker?: string;
  };
}

interface SermonLite {
  id: string;
  fields: { Service?: string; Title?: string };
}

function clean(s: string): string {
  return (s || "").replace(/<[^>]+>/g, "").trim();
}

function displayText(q: QuoteRecord): string {
  return clean(q.fields["Quote Final"] || q.fields["Quote Original"] || "");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-1.5 text-muted-foreground hover:text-foreground shrink-0"
      aria-label="Copy quote"
      onClick={() => {
        navigator.clipboard.writeText(`“${text}”`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </Button>
  );
}

// One quote row: On Website checkbox, original (read-only), editable Final,
// timecode/speaker/copy. Same behavior as the sermon page's section.
function QuoteRow({ q, onPatch }: { q: QuoteRecord; onPatch: (id: string, fields: Record<string, any>) => void }) {
  const original = clean(q.fields["Quote Original"] || "");
  const [draft, setDraft] = useState<string | null>(null);
  const finalValue = draft ?? clean(q.fields["Quote Final"] || "");
  return (
    <div className={`flex items-start gap-2.5 px-3 py-2 ${q.fields["On Website"] ? "" : "opacity-55"}`}>
      <input
        type="checkbox"
        className="mt-1 h-3.5 w-3.5 accent-primary cursor-pointer shrink-0"
        checked={!!q.fields["On Website"]}
        onChange={(e) => onPatch(q.id, { "On Website": e.target.checked })}
        aria-label="Publish this quote"
      />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-xs text-foreground leading-snug">&ldquo;{original}&rdquo;</p>
        <ExpandTextarea
          value={finalValue}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null && draft.trim() !== clean(q.fields["Quote Final"] || "")) {
              onPatch(q.id, { "Quote Final": draft.trim() });
            }
            setDraft(null);
          }}
          placeholder="Final (optional): your revision wins over the original when filled."
          collapsedHeight="h-[32px]"
          className="text-xs bg-background"
        />
      </div>
      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
        {q.fields["Speaker"] && (
          <span className="text-[10px] text-muted-foreground">{q.fields["Speaker"]}</span>
        )}
        {q.fields["Video Timecode"] && (
          <span className="text-[10px] font-mono text-muted-foreground inline-flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {q.fields["Video Timecode"]}
          </span>
        )}
        {q.fields["On Website"] && <Globe className="w-3 h-3 text-emerald-500" aria-label="Publishes" />}
        <CopyButton text={displayText(q)} />
      </div>
    </div>
  );
}

export default function SermonQuotesPage() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [defaultsSet, setDefaultsSet] = useState(false);

  const { data, isLoading } = useQuery<{ records: QuoteRecord[] }>({
    queryKey: ["/api/quotes", "all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/quotes");
      return res.json();
    },
  });

  const dates = useMemo(() => {
    const set = new Set<string>();
    (data?.records || []).forEach((r) => {
      const d = (r.fields["Service Date"] || "").slice(0, 10);
      if (d) set.add(d);
    });
    return Array.from(set).sort().reverse();
  }, [data]);

  const { data: sermonsData } = useQuery<{ records: SermonLite[] }>({
    queryKey: ["/api/sermons/by-dates", dates.join(",")],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sermons/by-dates?dates=${dates.join(",")}`);
      return res.json();
    },
    enabled: dates.length > 0,
  });
  const sermonByDate = useMemo(() => {
    const m: Record<string, SermonLite> = {};
    (sermonsData?.records || []).forEach((s) => {
      const d = (s.fields["Service"] || "").slice(0, 10);
      if (d && !m[d]) m[d] = s;
    });
    return m;
  }, [sermonsData]);

  const patchMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/quotes/${id}`, fields);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/quotes", "all"] }),
    onError: (error: Error) =>
      toast({ title: "Error", description: error.message, variant: "destructive" }),
  });
  const onPatch = (id: string, fields: Record<string, any>) => patchMutation.mutate({ id, fields });

  const [sendingDate, setSendingDate] = useState<string | null>(null);
  const sendMutation = useMutation({
    mutationFn: async (sermonId: string) => {
      const res = await apiRequest("POST", `/api/sermons/${sermonId}/send-quotes`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Send failed");
      return body;
    },
    onSuccess: (result: { status: string; count: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", "all"] });
      toast({
        title:
          result.status === "unchanged"
            ? "Already up to date"
            : result.status === "removed"
              ? "Quotes removed from the page"
              : `${result.count} quotes sent`,
        description:
          result.status === "unchanged"
            ? "The website already has exactly these quotes."
            : "The site is rebuilding; live in about 30 seconds.",
      });
    },
    onError: (error: Error) =>
      toast({ title: "Send failed", description: error.message, variant: "destructive" }),
    onSettled: () => setSendingDate(null),
  });

  const needle = q.trim().toLowerCase();
  const filtered = (data?.records || []).filter((r) => {
    const text = displayText(r);
    if (!text) return false;
    if (r.fields["Source"] === "OG") return false; // OG corpus lives on the Quotes browse page
    if (tab === "unreviewed" && r.fields["Reviewed"]) return false;
    if (tab === "website" && !r.fields["On Website"]) return false;
    if (tab === "ai" && r.fields["Source"] !== "Claude") return false;
    if (needle) {
      const hay = `${text} ${r.fields["Speaker"] || ""} ${r.fields["Service Date"] || ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const groups = useMemo(() => {
    const g: Record<string, QuoteRecord[]> = {};
    filtered.forEach((r) => {
      const d = (r.fields["Service Date"] || "").slice(0, 10) || "undated";
      (g[d] = g[d] || []).push(r);
    });
    return Object.entries(g).sort(([a], [b]) =>
      a === "undated" ? 1 : b === "undated" ? -1 : b.localeCompare(a)
    );
  }, [filtered]);

  // Smart default once data arrives: unreviewed groups open, the rest closed.
  useEffect(() => {
    if (defaultsSet || !data) return;
    const initial: Record<string, boolean> = {};
    (data.records || []).forEach((r) => {
      const d = (r.fields["Service Date"] || "").slice(0, 10) || "undated";
      if (!r.fields["Reviewed"]) initial[d] = true;
    });
    setOpen(initial);
    setDefaultsSet(true);
  }, [data, defaultsSet]);

  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    groups.forEach(([d]) => (next[d] = value));
    setOpen(next);
  };

  return (
    <div className="p-3 md:p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Quotes</h1>
          <p className="text-xs text-muted-foreground">
            The website pipeline: review, revise, and send each service's quotes to its message page.
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{filtered.length}</span>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="unreviewed" className="text-xs">Unreviewed</TabsTrigger>
            <TabsTrigger value="website" className="text-xs">On Website</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs">AI</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1 text-muted-foreground" onClick={() => setAll(true)}>
            <ChevronsUpDown className="w-3.5 h-3.5" /> Expand all
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1 text-muted-foreground" onClick={() => setAll(false)}>
            <ChevronsDownUp className="w-3.5 h-3.5" /> Collapse all
          </Button>
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search quotes..."
            className="h-8 pl-8 text-xs bg-card"
            data-testid="input-quote-search"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          {tab === "unreviewed" ? "Nothing awaiting review. All caught up." : "No quotes match."}
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map(([date, quotes]) => {
            const sermon = sermonByDate[date];
            const unreviewed = quotes.some((r) => !r.fields["Reviewed"]);
            const checkedCount = quotes.filter((r) => r.fields["On Website"]).length;
            const isOpen = !!open[date];
            const isSending = sendingDate === date && sendMutation.isPending;
            return (
              <Card key={date} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [date]: !o[date] }))}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/30 transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                  <span className="text-xs font-semibold text-foreground">
                    {date === "undated" ? "Undated" : formatLongDate(date)}
                  </span>
                  {sermon?.fields["Title"] && (
                    <span className="text-[11px] text-muted-foreground truncate">
                      {sermon.fields["Title"]}
                    </span>
                  )}
                  <span className="ml-auto" />
                  {unreviewed ? (
                    <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/15 text-amber-500 border-amber-500/30" variant="outline">
                      Needs review
                    </Badge>
                  ) : (
                    <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-500 border-emerald-500/30" variant="outline">
                      Reviewed
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {checkedCount}/{quotes.length}
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-border">
                    <div className="divide-y divide-border">
                      {quotes.map((r) => (
                        <QuoteRow key={r.id} q={r} onPatch={onPatch} />
                      ))}
                    </div>
                    {date !== "undated" && (
                      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
                        {sermon ? (
                          <Link
                            href={`/sermon/${sermon.id}`}
                            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                          >
                            Open sermon <ChevronRight className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">No sermon record for this date</span>
                        )}
                        <Button
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          disabled={!sermon || sendMutation.isPending}
                          onClick={() => {
                            if (!sermon) return;
                            setSendingDate(date);
                            sendMutation.mutate(sermon.id);
                          }}
                        >
                          <Globe className="w-3 h-3" />
                          {isSending ? "Sending..." : `Send ${checkedCount} to Website`}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
