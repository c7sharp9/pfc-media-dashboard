import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Copy, Check, Clock, Shuffle, Trash2, Pencil, Home, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
    "Believe"?: boolean;
    "Homepage Quote"?: boolean;
    Source?: string;
    Speaker?: string;
  };
}

interface SermonLite {
  id: string;
  fields: { Service?: string; Title?: string };
}

// Mirrors cleanQuoteText in shared/send-homepage-quotes.ts (kept separate so
// the client bundle doesn't pull in the Node-only send module).
function clean(s: string): string {
  return (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// Same set of quotes regardless of order = homepage is in sync.
function sameTexts(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((t, i) => t === sb[i]);
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

// One quote row: click the text (or the pencil) to edit the wording in place.
// Saving writes Quote Final -- the manual-wins field the Moments page edits --
// so a re-Prepare never clobbers it. Escape cancels, Enter or blur saves.
function QuoteRow({
  r,
  sermonId,
  onSaveText,
  onToggleTag,
  onDelete,
}: {
  r: QuoteRecord;
  sermonId?: string;
  onSaveText: (id: string, text: string) => Promise<unknown>;
  onToggleTag: (id: string, field: string, value: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const text = displayText(r);
  const isOG = r.fields["Source"] === "OG";
  const date = (r.fields["Service Date"] || "").slice(0, 10);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);
  // The site page shows the wording from its last send; flag session edits so
  // nobody forgets to re-send the Moments for this date.
  const [editedSinceSend, setEditedSinceSend] = useState(false);

  const startEdit = () => {
    setDraft(text);
    setEditing(true);
  };

  const save = async () => {
    const next = clean(draft);
    setEditing(false);
    if (!next || next === text) return;
    setSaving(true);
    try {
      await onSaveText(r.id, next);
      if (!isOG && r.fields["On Website"]) setEditedSinceSend(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-start gap-3 px-3.5 py-2.5">
      <div className="flex-1 min-w-0">
        {editing ? (
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
              }
            }}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") {
                setDraft(text);
                setEditing(false);
              }
            }}
            className="text-[13px] leading-relaxed min-h-0 py-1 px-2 bg-background resize-none overflow-hidden"
            data-testid={`quote-edit-${r.id}`}
          />
        ) : (
          <p
            className="text-[13px] text-foreground leading-relaxed cursor-text rounded px-0.5 -mx-0.5 hover:bg-accent/40 transition-colors"
            onClick={startEdit}
            title="Click to edit"
          >
            &ldquo;{text}&rdquo;
            {saving && <Loader2 className="inline w-3 h-3 ml-1.5 animate-spin text-muted-foreground" />}
          </p>
        )}
        <p className="mt-0.5 text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
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
          {editedSinceSend && (
            <span className="text-amber-400/90">
              Edited — the site shows the old wording until you{" "}
              <Link href="/website-quotes" className="underline underline-offset-2 hover:text-amber-300">
                re-send this date&apos;s Moments
              </Link>
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <TagToggle
          on={!!r.fields["Believe"]}
          onClick={() => onToggleTag(r.id, "Believe", !r.fields["Believe"])}
          label="Believe"
        />
        <TagToggle
          on={!!r.fields["Homepage Quote"]}
          onClick={() => onToggleTag(r.id, "Homepage Quote", !r.fields["Homepage Quote"])}
          label="Homepage"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground/50 hover:text-foreground"
          aria-label="Edit quote"
          onClick={startEdit}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <CopyButton text={text} />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground/50 hover:text-destructive"
          aria-label="Delete quote"
          onClick={() => {
            if (confirm(`Delete this quote permanently?\n\n"${text.slice(0, 80)}..."`)) {
              onDelete(r.id);
            }
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// Small in-row tag toggle (Believe / Homepage). Purple when set.
function TagToggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors shrink-0 ${
        on
          ? "bg-purple-500/15 text-purple-400 border-purple-500/40"
          : "bg-transparent text-muted-foreground/50 border-border hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export default function QuotesBrowsePage() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [showSermon, setShowSermon] = useState(true);
  const [showOG, setShowOG] = useState(true);
  const [filterBelieve, setFilterBelieve] = useState(false);
  const [filterHomepage, setFilterHomepage] = useState(false);
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

  const tagMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const res = await apiRequest("PATCH", `/api/quotes/${id}`, { [field]: value });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/quotes", "all"] }),
    onError: (error: Error) =>
      toast({ title: "Tag failed", description: error.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const res = await apiRequest("PATCH", `/api/quotes/${id}`, { "Quote Final": text });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", "all"] });
      toast({ title: "Saved", description: "Quote updated in Airtable." });
    },
    onError: (error: Error) =>
      toast({ title: "Save failed", description: error.message, variant: "destructive" }),
  });

  // What the homepage carousel is showing right now (drives the sync state on
  // the Send Homepage button). Errors leave the state "unknown" -- still sendable.
  const { data: liveHomepage } = useQuery<{ texts: string[] }>({
    queryKey: ["/api/homepage-quotes/live"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/homepage-quotes/live");
      return res.json();
    },
    retry: false,
    staleTime: 60 * 1000,
  });

  const sendHomepageMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/homepage-quotes/send");
      return res.json() as Promise<{ status: "updated" | "unchanged"; count: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/homepage-quotes/live"] });
      toast(
        result.status === "updated"
          ? {
              title: "Homepage updated",
              description: `${result.count} quote${result.count === 1 ? "" : "s"} sent — live in a couple of minutes.`,
            }
          : { title: "Already up to date", description: "The homepage matches your selections." }
      );
    },
    onError: (error: Error) =>
      toast({ title: "Send failed", description: error.message, variant: "destructive" }),
  });

  const taggedTexts = useMemo(
    () =>
      (data?.records || [])
        .filter((r) => r.fields["Homepage Quote"])
        .map((r) => displayText(r))
        .filter(Boolean),
    [data]
  );
  const liveTexts = liveHomepage?.texts;
  const outOfSync = liveTexts !== undefined && !sameTexts(taggedTexts, liveTexts.map(clean));

  const needle = q.trim().toLowerCase();
  const quotes = useMemo(() => {
    const filtered = (data?.records || []).filter((r) => {
      const text = displayText(r);
      if (!text) return false;
      const isOG = r.fields["Source"] === "OG";
      if (isOG && !showOG) return false;
      // Pipeline quotes only surface here once kept for the website.
      if (!isOG && (!showSermon || !r.fields["On Website"])) return false;
      if (filterBelieve && !r.fields["Believe"]) return false;
      if (filterHomepage && !r.fields["Homepage Quote"]) return false;
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
  }, [data, needle, showSermon, showOG, filterBelieve, filterHomepage, sort, seed]);

  return (
    <div className="p-3 md:p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Quotes</h1>
          <p className="text-xs text-muted-foreground">
            Scroll, copy, edit. The good stuff, all in one place.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-muted-foreground tabular-nums">{quotes.length}</span>
          <Button
            size="sm"
            variant={outOfSync ? "default" : "outline"}
            className={`h-7 text-xs gap-1.5 ${
              outOfSync
                ? "bg-purple-600 hover:bg-purple-500 text-white"
                : "text-muted-foreground"
            }`}
            disabled={sendHomepageMutation.isPending || taggedTexts.length === 0}
            onClick={() => sendHomepageMutation.mutate()}
            data-testid="button-send-homepage"
          >
            {sendHomepageMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : !outOfSync && liveTexts !== undefined ? (
              <Check className="w-3 h-3" />
            ) : (
              <Home className="w-3 h-3" />
            )}
            {sendHomepageMutation.isPending
              ? "Sending..."
              : outOfSync
                ? `Send Homepage (${taggedTexts.length})`
                : liveTexts !== undefined
                  ? "Homepage up to date"
                  : `Send Homepage (${taggedTexts.length})`}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <ToggleChip on={showSermon} onClick={() => setShowSermon((v) => !v)}>
          Moments
        </ToggleChip>
        <ToggleChip on={showOG} onClick={() => setShowOG((v) => !v)}>
          OG Quotes
        </ToggleChip>
        <span className="w-px h-5 bg-border mx-0.5" />
        <ToggleChip on={filterBelieve} onClick={() => setFilterBelieve((v) => !v)}>
          Believe
        </ToggleChip>
        <ToggleChip on={filterHomepage} onClick={() => setFilterHomepage((v) => !v)}>
          Homepage
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
            const date = (r.fields["Service Date"] || "").slice(0, 10);
            return (
              <QuoteRow
                key={r.id}
                r={r}
                sermonId={date ? sermonByDate[date] : undefined}
                onSaveText={(id, text) => editMutation.mutateAsync({ id, text })}
                onToggleTag={(id, field, value) => tagMutation.mutate({ id, field, value })}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            );
          })}
        </Card>
      )}
    </div>
  );
}
