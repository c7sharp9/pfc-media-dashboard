import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Copy, Check, Clock, Shuffle, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatLongDate } from "@/lib/utils";

// Display-only quote browsing for the team: read, search, copy. No editing,
// no publishing -- that lives on the Website Quotes page. Two corpora:
//   Sermon Quotes = the website pipeline's KEPT quotes (On Website)
//   OG Quotes     = the original hand-logged social one-liners (date + quote)
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

function displayText(q: QuoteRecord): string {
  return clean(q.fields["Quote Final"] || q.fields["Quote Original"] || "");
}

// Stable pseudo-random key per (id, seed): same seed = same order while
// scrolling; a new seed reshuffles the whole wall.
function shuffleKey(id: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h ^ id.charCodeAt(i), 2654435761) >>> 0);
  }
  return h;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-muted-foreground hover:text-foreground shrink-0"
      aria-label="Copy quote"
      onClick={() => {
        navigator.clipboard.writeText(`“${text}”`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

function ToggleChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        on
          ? "bg-primary/15 text-primary border-primary/40"
          : "bg-transparent text-muted-foreground border-border hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

type SortMode = "newest" | "oldest" | "random";

export default function QuotesBrowsePage() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [showSermon, setShowSermon] = useState(true);
  const [showOG, setShowOG] = useState(true);
  const [sort, setSort] = useState<SortMode>("newest");
  const [seed, setSeed] = useState(1);

  const { data, isLoading } = useQuery<{ records: QuoteRecord[] }>({
    queryKey: ["/api/quotes", "all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/quotes");
      return res.json();
    },
  });

  // Sermon lookup for date links. The by-dates endpoint caps at 60 dates per
  // call, and the OG corpus spans hundreds -- so chunk and fan out (cached).
  const allDates = useMemo(() => {
    const set = new Set<string>();
    (data?.records || []).forEach((r) => {
      const d = (r.fields["Service Date"] || "").slice(0, 10);
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [data]);

  const dateChunks = useMemo(() => {
    const chunks: string[][] = [];
    for (let i = 0; i < allDates.length; i += 50) chunks.push(allDates.slice(i, i + 50));
    return chunks;
  }, [allDates]);

  const sermonQueries = useQueries({
    queries: dateChunks.map((chunk) => ({
      queryKey: ["/api/sermons/by-dates", chunk.join(",")],
      queryFn: async () => {
        const res = await apiRequest("GET", `/api/sermons/by-dates?dates=${chunk.join(",")}`);
        return res.json() as Promise<{ records: SermonLite[] }>;
      },
      staleTime: 5 * 60 * 1000,
    })),
  });

  const sermonByDate = useMemo(() => {
    const m: Record<string, string> = {};
    sermonQueries.forEach((sq) => {
      (sq.data?.records || []).forEach((s) => {
        const d = (s.fields["Service"] || "").slice(0, 10);
        if (d && !m[d]) m[d] = s.id;
      });
    });
    return m;
  }, [sermonQueries]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/quotes/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", "all"] });
      toast({ title: "Deleted", description: "The quote is gone from Airtable." });
    },
    onError: (error: Error) =>
      toast({ title: "Delete failed", description: error.message, variant: "destructive" }),
  });

  const needle = q.trim().toLowerCase();
  const quotes = useMemo(() => {
    const filtered = (data?.records || []).filter((r) => {
      const text = displayText(r);
      if (!text) return false;
      const isOG = r.fields["Source"] === "OG";
      if (isOG && !showOG) return false;
      // Pipeline quotes only surface here once kept for the website.
      if (!isOG && (!showSermon || !r.fields["On Website"])) return false;
      if (needle) {
        const hay = `${text} ${r.fields["Speaker"] || ""} ${r.fields["Service Date"] || ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    if (sort === "random") {
      return filtered.sort((a, b) => shuffleKey(a.id, seed) - shuffleKey(b.id, seed));
    }
    return filtered.sort((a, b) => {
      const cmp = (b.fields["Service Date"] || "").localeCompare(a.fields["Service Date"] || "");
      return sort === "newest" ? cmp : -cmp;
    });
  }, [data, needle, showSermon, showOG, sort, seed]);

  return (
    <div className="p-3 md:p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Quotes</h1>
          <p className="text-xs text-muted-foreground">
            Scroll and copy. The good stuff, all in one place.
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{quotes.length}</span>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <ToggleChip on={showSermon} onClick={() => setShowSermon((v) => !v)}>
          Sermon Quotes
        </ToggleChip>
        <ToggleChip on={showOG} onClick={() => setShowOG((v) => !v)}>
          OG Quotes
        </ToggleChip>
        <div className="flex items-center gap-1 ml-auto">
          <ToggleChip on={sort === "newest"} onClick={() => setSort("newest")}>
            Newest
          </ToggleChip>
          <ToggleChip on={sort === "oldest"} onClick={() => setSort("oldest")}>
            Oldest
          </ToggleChip>
          <button
            type="button"
            onClick={() => {
              setSort("random");
              setSeed((s) => s + 1);
            }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
              sort === "random"
                ? "bg-primary/15 text-primary border-primary/40"
                : "bg-transparent text-muted-foreground border-border hover:text-foreground"
            }`}
            aria-label="Shuffle the order"
          >
            <Shuffle className="w-3 h-3" />
            Shuffle
          </button>
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search quotes..."
            className="h-8 pl-8 text-xs bg-card"
            data-testid="input-quote-browse-search"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">No quotes match.</p>
      ) : (
        <Card className="divide-y divide-border">
          {quotes.map((r) => {
            const text = displayText(r);
            const isOG = r.fields["Source"] === "OG";
            const date = (r.fields["Service Date"] || "").slice(0, 10);
            const sermonId = date ? sermonByDate[date] : undefined;
            return (
              <div key={r.id} className="flex items-start gap-3 px-3.5 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground leading-relaxed">&ldquo;{text}&rdquo;</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground flex items-center gap-2">
                    {date &&
                      (sermonId ? (
                        <Link
                          href={`/sermon/${sermonId}`}
                          className="text-primary/70 hover:text-primary hover:underline"
                        >
                          {formatLongDate(date)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/60">{formatLongDate(date)}</span>
                      ))}
                    {!isOG && r.fields["Speaker"] && <span>{r.fields["Speaker"]}</span>}
                    {!isOG && r.fields["Video Timecode"] && (
                      <span className="font-mono inline-flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {r.fields["Video Timecode"]}
                      </span>
                    )}
                    {isOG && <span className="uppercase tracking-wide text-[9px] text-muted-foreground/60">OG</span>}
                  </p>
                </div>
                <div className="flex items-center shrink-0">
                  <CopyButton text={text} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground/50 hover:text-destructive"
                    aria-label="Delete quote"
                    onClick={() => {
                      if (confirm(`Delete this quote permanently?\n\n"${text.slice(0, 80)}..."`)) {
                        deleteMutation.mutate(r.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
