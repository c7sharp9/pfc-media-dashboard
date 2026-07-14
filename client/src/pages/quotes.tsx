import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Copy, Check, Globe, Clock, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatLongDate } from "@/lib/utils";

interface QuoteRecord {
  id: string;
  fields: {
    "Quote Original"?: string;
    "Quote Final"?: string;
    "Video Timecode"?: string;
    "Service Date"?: string;
    "On Website"?: boolean;
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

// The quote the site would publish: Final wins over Original.
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

export default function QuotesPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");

  const { data, isLoading } = useQuery<{ records: QuoteRecord[] }>({
    queryKey: ["/api/quotes", "all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/quotes");
      return res.json();
    },
  });

  // Titles + sermon ids for the date group headers
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

  const needle = q.trim().toLowerCase();
  const filtered = (data?.records || []).filter((r) => {
    const text = displayText(r);
    if (!text) return false;
    if (tab === "website" && !r.fields["On Website"]) return false;
    if (tab === "manual" && r.fields["Source"] === "Claude") return false;
    if (tab === "ai" && r.fields["Source"] !== "Claude") return false;
    if (needle) {
      const hay = `${text} ${r.fields["Speaker"] || ""} ${r.fields["Service Date"] || ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  // Group by date, newest first; undated (legacy manual) quotes at the end.
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

  return (
    <div className="p-3 md:p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Quotes</h1>
          <p className="text-xs text-muted-foreground">
            Every pulled quote, newest first. Copy for marketing; publish from each sermon's page.
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{filtered.length}</span>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="website" className="text-xs">On Website</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs">AI</TabsTrigger>
            <TabsTrigger value="manual" className="text-xs">Manual</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
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
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">No quotes match.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, quotes]) => {
            const sermon = sermonByDate[date];
            return (
              <section key={date}>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <h2 className="text-xs font-semibold text-foreground">
                    {date === "undated" ? "Undated" : formatLongDate(date)}
                  </h2>
                  {sermon?.fields["Title"] && (
                    <Link
                      href={`/sermon/${sermon.id}`}
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      {sermon.fields["Title"]} <ChevronRight className="w-3 h-3" />
                    </Link>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                    {quotes.length}
                  </span>
                </div>
                <Card className="divide-y divide-border">
                  {quotes.map((r) => {
                    const text = displayText(r);
                    return (
                      <div key={r.id} className="flex items-start gap-2 px-3 py-2">
                        <p className="flex-1 text-xs text-foreground leading-snug">
                          &ldquo;{text}&rdquo;
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {r.fields["Speaker"] && (
                            <span className="text-[10px] text-muted-foreground">{r.fields["Speaker"]}</span>
                          )}
                          {r.fields["Video Timecode"] && (
                            <span className="text-[10px] font-mono text-muted-foreground inline-flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {r.fields["Video Timecode"]}
                            </span>
                          )}
                          {r.fields["On Website"] && (
                            <Globe className="w-3 h-3 text-emerald-500" aria-label="On website" />
                          )}
                          <CopyButton text={text} />
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
