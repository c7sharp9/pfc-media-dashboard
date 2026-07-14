import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpandTextarea } from "@/components/ui/expand-textarea";
import {
  Search, Globe, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown, RotateCcw,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatLongDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PlatformBadge } from "@/components/badges";
import type { Sermon } from "@shared/schema";

const SHORT_MAX = 125; // ~two lines on the site; enforced everywhere descriptions are edited

// Review workspace for sermon descriptions -- the sibling of Website Quotes.
// Each card shows the SHORT + LONG copy. Editing writes to the Manual field
// (manual wins at publish), so a re-Prepare never clobbers your revision; the
// AI draft is shown underneath with one-click revert. Send publishes the page.

function charTone(len: number): string {
  return len > SHORT_MAX ? "text-destructive" : "text-muted-foreground/70";
}

// One description field with manual-wins editing + AI peek/revert.
function DescField({
  label,
  ai,
  manual,
  onSaveManual,
  cap,
  collapsedHeight,
}: {
  label: string;
  ai: string;
  manual: string;
  onSaveManual: (value: string) => void;
  cap?: number;
  collapsedHeight: string;
}) {
  const usingManual = !!manual.trim();
  const [draft, setDraft] = useState<string | null>(null);
  const effective = draft ?? (usingManual ? manual : ai);
  const dirty = draft !== null && draft.trim() !== manual.trim();

  const commit = () => {
    if (draft !== null && draft.trim() !== manual.trim()) onSaveManual(draft.trim());
    setDraft(null);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          {label}
          {usingManual ? (
            <span className="text-[9px] uppercase tracking-wide text-primary/80">Edited</span>
          ) : ai ? (
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground/50">AI draft</span>
          ) : (
            <span className="text-[9px] uppercase tracking-wide text-amber-500/80">Empty</span>
          )}
        </Label>
        {cap && (
          <span className={`text-[10px] tabular-nums ${charTone(effective.length)}`}>
            {effective.length}/{cap}
          </span>
        )}
      </div>
      <ExpandTextarea
        value={effective}
        onChange={(e) => setDraft(cap ? e.target.value.slice(0, cap) : e.target.value)}
        onBlur={commit}
        placeholder={ai ? "Edit to override the AI draft (your copy wins)." : "No draft yet — run Prepare, or write one."}
        collapsedHeight={collapsedHeight}
        className="text-xs bg-background"
      />
      {usingManual && ai && ai.trim() !== effective.trim() && !dirty && (
        <div className="flex items-start gap-2 text-[10px] text-muted-foreground/70">
          <span className="flex-1 min-w-0 line-clamp-2">AI: {ai}</span>
          <button
            type="button"
            onClick={() => onSaveManual("")}
            className="shrink-0 inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
            title="Discard your edit and use the AI draft"
          >
            <RotateCcw className="w-2.5 h-2.5" /> revert
          </button>
        </div>
      )}
    </div>
  );
}

export default function DescriptionsReviewPage() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [defaultsSet, setDefaultsSet] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ records: Sermon[] }>({
    queryKey: ["/api/sermons/all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sermons/all");
      return res.json();
    },
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/sermons/${id}`, fields);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sermons/all"] }),
    onError: (error: Error) =>
      toast({ title: "Error", description: error.message, variant: "destructive" }),
  });
  const patch = (id: string, fields: Record<string, any>) => patchMutation.mutate({ id, fields });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/sermons/${id}/send-to-website`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Send failed");
      return { id, ...body };
    },
    onSuccess: (result: { id: string; status: string }) => {
      // Publishing counts as reviewed, same as the quotes flow.
      patch(result.id, { "Descriptions Reviewed": true });
      toast({
        title: result.status === "unchanged" ? "Already up to date" : "Sent to website",
        description:
          result.status === "unchanged"
            ? "The website already has this exact page."
            : "The site is rebuilding; live in about 30 seconds.",
      });
    },
    onError: (error: Error) =>
      toast({ title: "Send failed", description: error.message, variant: "destructive" }),
    onSettled: () => setSendingId(null),
  });

  const eff = (s: Sermon, key: "Short" | "Long") =>
    key === "Short"
      ? (s.fields["Manual Short Description"] || s.fields["Short Description"] || "")
      : (s.fields["Manual Long Description"] || s.fields["Long Description"] || "");

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    return (data?.records || []).filter((s) => {
      const skip = !!s.fields["Skip Website"];
      if (tab === "skipped") {
        if (!skip) return false;
      } else if (skip) {
        return false; // out of scope: hidden from All / Needs review / Missing
      }
      const reviewed = !!s.fields["Descriptions Reviewed"];
      const hasShort = !!eff(s, "Short").trim();
      if (tab === "unreviewed" && reviewed) return false;
      if (tab === "missing" && hasShort) return false;
      if (needle) {
        const hay = `${s.fields["Title"] || ""} ${s.fields["Service"] || ""} ${eff(s, "Short")} ${eff(s, "Long")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [data, tab, needle]);

  // Default: expand the ones that still need review.
  useEffect(() => {
    if (defaultsSet || !data) return;
    // Open just the first few unreviewed -- with a large backlog, opening
    // every card would mount hundreds of textareas at once.
    const initial: Record<string, boolean> = {};
    (data.records || [])
      .filter((s) => !s.fields["Descriptions Reviewed"] && !s.fields["Skip Website"])
      .slice(0, 6)
      .forEach((s) => (initial[s.id] = true));
    setOpen(initial);
    setDefaultsSet(true);
  }, [data, defaultsSet]);

  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    filtered.forEach((s) => (next[s.id] = value));
    setOpen(next);
  };

  return (
    <div className="p-3 md:p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Descriptions</h1>
          <p className="text-xs text-muted-foreground">
            Review, revise, and send each message's short + long descriptions.
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{filtered.length}</span>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="unreviewed" className="text-xs">Needs review</TabsTrigger>
            <TabsTrigger value="missing" className="text-xs">Missing</TabsTrigger>
            <TabsTrigger value="skipped" className="text-xs">Skipped</TabsTrigger>
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
            placeholder="Search messages..."
            className="h-8 pl-8 text-xs bg-card"
            data-testid="input-desc-search"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          {tab === "unreviewed"
            ? "Nothing awaiting review. All caught up."
            : tab === "missing"
              ? "Every in-scope message has a short description."
              : tab === "skipped"
                ? "Nothing skipped."
                : "No messages match."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const reviewed = !!s.fields["Descriptions Reviewed"];
            const isOpen = !!open[s.id];
            const date = (s.fields["Service"] || "").slice(0, 10);
            const published = !!s.fields["Sermon URL"];
            const isSending = sendingId === s.id && sendMutation.isPending;
            return (
              <Card key={s.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/30 transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ${isOpen ? "" : "-rotate-90"}`} />
                  <PlatformBadge platform={s.fields["Platform"]} className="text-[10px] leading-tight shrink-0" />
                  <span className="text-xs font-semibold text-foreground truncate">
                    {s.fields["Title"] || "Untitled"}
                  </span>
                  {date && <span className="text-[11px] text-muted-foreground shrink-0">{formatLongDate(date)}</span>}
                  <span className="ml-auto" />
                  {reviewed ? (
                    <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-500 border-emerald-500/30" variant="outline">
                      Reviewed
                    </Badge>
                  ) : (
                    <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/15 text-amber-500 border-amber-500/30" variant="outline">
                      Needs review
                    </Badge>
                  )}
                </button>
                {isOpen && (
                  <div className="border-t border-border p-3 space-y-3">
                    <DescField
                      label="Short"
                      ai={s.fields["Short Description"] || ""}
                      manual={s.fields["Manual Short Description"] || ""}
                      onSaveManual={(v) => patch(s.id, { "Manual Short Description": v })}
                      cap={SHORT_MAX}
                      collapsedHeight="h-[44px]"
                    />
                    <DescField
                      label="Long"
                      ai={s.fields["Long Description"] || ""}
                      manual={s.fields["Manual Long Description"] || ""}
                      onSaveManual={(v) => patch(s.id, { "Manual Long Description": v })}
                      collapsedHeight="h-[72px]"
                    />
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/sermon/${s.id}`}
                          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                        >
                          Open message <ChevronRight className="w-3 h-3" />
                        </Link>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-primary cursor-pointer"
                            checked={reviewed}
                            onChange={(e) => patch(s.id, { "Descriptions Reviewed": e.target.checked })}
                          />
                          Reviewed
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground" title="Out of scope for the new website (no descriptions, not sent)">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-muted-foreground cursor-pointer"
                            checked={!!s.fields["Skip Website"]}
                            onChange={(e) => patch(s.id, { "Skip Website": e.target.checked })}
                          />
                          Skip website
                        </label>
                      </div>
                      <Button
                        size="sm"
                        className="gap-1.5 h-7 text-xs"
                        disabled={sendMutation.isPending}
                        onClick={() => {
                          setSendingId(s.id);
                          sendMutation.mutate(s.id);
                        }}
                        data-testid={`button-send-desc-${s.id}`}
                      >
                        <Globe className="w-3 h-3" />
                        {isSending ? "Sending..." : published ? "Re-send to Website" : "Send to Website"}
                      </Button>
                    </div>
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
