import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExpandTextarea } from "@/components/ui/expand-textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Upload,
  Scissors,
  FileText,
  Youtube,
  EyeOff,
  Globe,
  Check,
  ChevronRight,
  Save,
  Headphones,
  ScissorsLineDashed,
  Link2,
  Share2,
  Wand2,
  Quote,
  Info,
  ChevronDown,
} from "lucide-react";
import { SiFacebook } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatLongDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { UrlField, CheckboxField, OpenLinkButton, fieldRing } from "@/components/fields";
import { Progress } from "@/components/ui/progress";
import { mediaProgress, aiProgress } from "@/lib/progress";
import { PlatformBadge, StatusBadge, TypeBadge } from "@/components/badges";
import NewEditDialog from "@/components/new-edit-dialog";
import ActivityLog from "@/components/activity-log";
import type { Sermon, Edit } from "@shared/schema";

interface WorkflowStepProps {
  title: string;
  icon: React.ReactNode;
  isComplete: boolean;
  children: React.ReactNode;
  stepNumber: number;
}

function WorkflowStep({ title, icon, isComplete, children, stepNumber }: WorkflowStepProps) {
  return (
    <Card
      className={`p-3 border transition-colors ${
        isComplete
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
            isComplete
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isComplete ? <Check className="w-3 h-3" /> : icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-muted-foreground font-mono">
              {stepNumber}
            </span>
            <h3 className="text-xs font-medium text-foreground">{title}</h3>
            {isComplete && (
              <Badge variant="secondary" className="text-[10px] leading-tight px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                Done
              </Badge>
            )}
          </div>
          <div className="space-y-2">{children}</div>
        </div>
      </div>
    </Card>
  );
}

interface QuoteRecord {
  id: string;
  fields: {
    "Quote Original"?: string;
    "Quote Final"?: string;
    "Video Timecode"?: string;
    "On Website"?: boolean;
    Source?: string;
    Speaker?: string;
  };
}

function timecodeSeconds(tc: string): number {
  const parts = (tc || "").trim().split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n)) || parts.length === 0) return Infinity;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

// Moments: the selection table for "Moments from this message" on the site.
// Check the ones to publish, tweak the Final text (Original is never touched),
// then Send Moments to Website -- re-sending REPLACES the live set, so the same
// button is also the update button.
function WebsiteQuotes({ sermonId, serviceDate, polling }: { sermonId: string; serviceDate?: string; polling?: boolean }) {
  const { toast } = useToast();
  const date = (serviceDate || "").slice(0, 10);
  const { data } = useQuery<{ records: QuoteRecord[] }>({
    queryKey: ["/api/quotes", { date }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/quotes?date=${date}`);
      return res.json();
    },
    enabled: !!date,
    // While an AI job is recent, keep refetching so a re-pick's new moments
    // appear on their own (the sermon poller can't see this table).
    refetchInterval: polling ? 15000 : false,
  });
  const quotes = (data?.records || [])
    .slice()
    .sort((a, b) => timecodeSeconds(a.fields["Video Timecode"] || "") - timecodeSeconds(b.fields["Video Timecode"] || ""));
  const checkedCount = quotes.filter((q) => q.fields["On Website"]).length;
  // A send stamps Reviewed on every quote for the date, so: not Reviewed =
  // arrived since the last send (label it New); Reviewed but unchecked = a
  // deliberate reject (park it out of the way, recoverable).
  //
  // Membership is SNAPSHOTTED when the list first loads: unchecking a moment
  // must flip its checkbox and otherwise leave it exactly where it is -- a
  // card that vanishes into a collapsed section under the cursor reads as
  // "nothing happened". Rejects park on the next visit. The one exception is
  // re-checking a rejected moment, which rescues it into the main list at
  // once (that movement IS the feedback).
  const [rejectedIds, setRejectedIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (rejectedIds === null && quotes.length > 0) {
      setRejectedIds(new Set(quotes.filter((q) => (q.fields as any)["Reviewed"] && !q.fields["On Website"]).map((q) => q.id)));
    }
  }, [rejectedIds, quotes.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const rejected = quotes.filter((q) => rejectedIds?.has(q.id));
  const current = quotes.filter((q) => !rejectedIds?.has(q.id));
  const [showRejected, setShowRejected] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const patchMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/quotes/${id}`, fields);
      return res.json();
    },
    // Optimistic: the checkbox must respond on the CLICK, not a round-trip
    // later -- a controlled input that waits for the refetch reads as dead.
    onMutate: async ({ id, fields: patch }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/quotes", { date }] });
      const prev = queryClient.getQueryData<{ records: QuoteRecord[] }>(["/api/quotes", { date }]);
      queryClient.setQueryData(["/api/quotes", { date }], (old: any) =>
        old
          ? { ...old, records: old.records.map((r: any) => (r.id === id ? { ...r, fields: { ...r.fields, ...patch } } : r)) }
          : old
      );
      return { prev };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/quotes", { date }] }),
    onError: (error: Error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/quotes", { date }], ctx.prev);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sendQuotesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sermons/${sermonId}/send-quotes`);
      return res.json();
    },
    onSuccess: (result: { status: string; count: number; pageUrl: string }) => {
      // Refetch the sermon too: the send stamps "Moments Sent" (completion
      // tally) and writes an Activity line, neither of which lives in the
      // quotes query.
      queryClient.invalidateQueries({ queryKey: ["/api/sermons", sermonId] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", { date }] });
      toast({
        title:
          result.status === "unchanged"
            ? "Already up to date"
            : result.status === "removed"
              ? "Moments removed from the page"
              : `${result.count} moments sent`,
        description:
          result.status === "unchanged"
            ? "The website already has exactly these moments."
            : "The site is rebuilding; live in about 30 seconds.",
      });
    },
    onError: (error: Error) =>
      toast({ title: "Send failed", description: error.message, variant: "destructive" }),
  });

  if (!date) return null;

  const renderQuote = (q: QuoteRecord) => {
            const original = q.fields["Quote Original"] || "";
            const finalText = drafts[q.id] ?? (q.fields["Quote Final"] || "");
            const published = finalText.trim() || original;
            return (
              <Card key={q.id} className={`p-2.5 ${q.fields["On Website"] ? "" : "opacity-55"}`}>
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-1 h-3.5 w-3.5 accent-primary cursor-pointer shrink-0"
                    checked={!!q.fields["On Website"]}
                    onChange={(e) => {
                      patchMutation.mutate({ id: q.id, fields: { "On Website": e.target.checked } });
                      if (e.target.checked && rejectedIds?.has(q.id)) {
                        setRejectedIds((prev) => {
                          const next = new Set(prev);
                          next.delete(q.id);
                          return next;
                        });
                      }
                    }}
                    aria-label="Publish this moment"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs text-foreground leading-snug">&ldquo;{original.replace(/<[^>]+>/g, "")}&rdquo;</p>
                    <ExpandTextarea
                      collapsedHeight="h-[34px]"
                      value={finalText.replace(/<[^>]+>/g, "")}
                      onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                      onBlur={() => {
                        const v = (drafts[q.id] ?? "").trim();
                        if (drafts[q.id] !== undefined && v !== (q.fields["Quote Final"] || "")) {
                          patchMutation.mutate({ id: q.id, fields: { "Quote Final": v } });
                        }
                      }}
                      placeholder="Final (optional): your revision wins over the original when filled."
                      className="text-xs bg-background"
                    />
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-[10px] font-mono text-muted-foreground">{q.fields["Video Timecode"] || "--:--"}</p>
                    {!(q.fields as any)["Reviewed"] && (
                      <Badge className="text-[9px] px-1 py-0 block" data-testid="badge-new-moment">New</Badge>
                    )}
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {q.fields["Source"] === "Claude" ? "AI" : "Manual"}
                    </Badge>
                    {q.fields["Speaker"] && (
                      <p className="text-[9px] text-muted-foreground">{q.fields["Speaker"]}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
  };

  return (
    <div className="mt-4">
      <Separator className="my-3" />
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Quote className="w-3.5 h-3.5" /> Moments
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {checkedCount} of {quotes.length} selected
          </span>
          <Button
            size="sm"
            className="gap-1.5 h-7 text-xs"
            disabled={quotes.length === 0 || sendQuotesMutation.isPending}
            onClick={() => sendQuotesMutation.mutate()}
            data-testid="button-send-quotes"
          >
            <Globe className="w-3 h-3" />
            {sendQuotesMutation.isPending
              ? "Sending..."
              : quotes.some((q) => (q.fields as any)["Reviewed"])
                ? "Re-send Moments to Website"
                : "Send Moments to Website"}
          </Button>
        </div>
      </div>
      {quotes.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No moments for this service date yet. Claude extracts them from the transcript; they land here for review.
        </p>
      ) : (
        <div className="space-y-1.5">
          {current.map(renderQuote)}
          {rejected.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowRejected((v) => !v)}
                className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                data-testid="button-toggle-rejected"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${showRejected ? "" : "-rotate-90"}`} />
                Rejected ({rejected.length}) — kept off the site; re-check one to bring it back
              </button>
              {showRejected && <div className="space-y-1.5 mt-1.5">{rejected.map(renderQuote)}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SHORT_DESC_MAX = 125; // ~two lines on the website at normal screen width

function CharCount({ value }: { value?: string }) {
  const len = (value || "").length;
  if (!len) return null;
  return (
    <span className={`text-[10px] tabular-nums ${len >= SHORT_DESC_MAX ? "text-destructive" : "text-muted-foreground/70"}`}>
      {len}/{SHORT_DESC_MAX}
    </span>
  );
}

export default function SermonDetail() {
  const params = useParams() as { id: string };
  const { toast } = useToast();
  const [fields, setFields] = useState<Record<string, any>>({});
  const [title, setTitle] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  // Autosave: edits persist on their own (checkboxes at once, text after a
  // pause) -- an approval should never be lost to a Save button nobody
  // scrolled back up to. dirtyRef counts edits so a save that lands while MORE
  // typing happened doesn't clear the flag for edits it never carried.
  const dirtyRef = useRef(0);
  const savedDirtyRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<() => void>(() => {});
  const hasChangesRef = useRef(false);
  useEffect(() => { hasChangesRef.current = hasChanges; }, [hasChanges]);

  // While an AI job is in flight the record is refetched on a timer, so the
  // descriptions and moments appear on their own without a manual refresh.
  const [aiPolling, setAiPolling] = useState(false);
  const { data: sermon, isLoading } = useQuery<Sermon>({
    queryKey: ["/api/sermons", params.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sermons/${params.id}`);
      return res.json();
    },
    refetchInterval: aiPolling ? 15000 : false,
  });

  // AI job progress. "AI Job Started" is stamped when Prepare/Descript
  // dispatches; the job counts as finished once a description lands, so this
  // clears itself without CI having to report back.
  //
  // Computed here, ABOVE the isLoading / !sermon early returns, because the
  // useEffect below must run on every render -- placing a hook after an early
  // return changes the hook count between renders and React bails out
  // (error #310, which blanks the page).
  const aiFields: Record<string, any> = sermon?.fields || {};
  const aiStartedRaw = aiFields["AI Job Started"] || "";
  const aiStartedAt = aiStartedRaw ? new Date(aiStartedRaw) : null;
  const aiProduced = !!(
    String(aiFields["Short Description"] || "").trim() ||
    String(aiFields["Long Description"] || "").trim()
  );
  const aiRunning = !!aiStartedAt && !isNaN(aiStartedAt.getTime()) && !aiProduced;
  const aiMinutes = aiStartedAt ? Math.floor((Date.now() - aiStartedAt.getTime()) / 60000) : 0;
  // These jobs finish in ~2-10 min. Past 25 the run has almost certainly failed
  // or is stuck queued (a GitHub Actions outage looks exactly like this).
  const aiStalled = aiRunning && aiMinutes >= 25;

  useEffect(() => { setAiPolling(aiRunning && !aiStalled); }, [aiRunning, aiStalled]);

  // Edits for this sermon: fetch only this service date's edits, then prefer
  // the real Sermon Link record ID (date match is the fallback for older edits).
  const serviceDate = sermon?.fields["Service"];
  const { data: dateEdits } = useQuery<Edit[]>({
    queryKey: ["/api/edits", { date: serviceDate }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/edits?date=${serviceDate}`);
      return res.json();
    },
    enabled: !!serviceDate,
  });

  // Re-check the date client-side too — don't trust the endpoint to have
  // filtered (the Netlify function and Express dev server are separate code).
  const linkedEdits = dateEdits?.filter((e) => {
    const link = e.fields["Sermon Link"];
    if (link && link.length > 0) return link.includes(params.id);
    return e.fields["Broadcast Date"] === serviceDate;
  });

  // A finished recap edit can supply the sermon's Recap URL directly
  const completedRecap = linkedEdits?.find(
    (e) =>
      e.fields["Type"]?.includes("Recap") &&
      e.fields["Status"] === "Completed" &&
      e.fields["Video URL"]
  );

  useEffect(() => {
    // Never clobber in-flight edits: with autosave plus the 15s AI polling, a
    // refetch can land mid-typing.
    if (sermon && !hasChangesRef.current) {
      setFields(sermon.fields);
      setTitle(sermon.fields["Title"] || "");
    }
  }, [sermon]);

  const updateMutation = useMutation({
    mutationFn: async (updatedFields: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/sermons/${params.id}`, updatedFields);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sermons", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/sermons"] });
      // Clear the dirty flag only if nothing was typed while the save flew;
      // otherwise go around again for the edits this save didn't carry.
      if (savedDirtyRef.current === dirtyRef.current) setHasChanges(false);
      else saveRef.current();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send to Website: commits the sermon file to the site repo (auto-deploys).
  // The sermon and its descriptions publish INDEPENDENTLY -- whoever cuts the
  // video sends it as soon as it's ready, without waiting on copy approval --
  // so each send rewrites only its own keys and leaves the rest of the page be.
  const sendMutation = useMutation({
    mutationFn: async (mode: "sermon" | "descriptions" = "sermon") => {
      const res = await apiRequest("POST", `/api/sermons/${params.id}/send-to-website`, { mode });
      return { ...(await res.json()), mode };
    },
    onSuccess: (result: { status: string; pageUrl: string; mode: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sermons", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/sermons"] });
      const what = result.mode === "descriptions" ? "descriptions" : "sermon";
      toast({
        title:
          result.status === "unchanged"
            ? "Already up to date"
            : result.status === "updated"
              ? `Updated ${what} on website`
              : "Sent to website",
        description:
          result.status === "unchanged"
            ? `The website already has these exact ${what === "descriptions" ? "descriptions" : "sermon details"}.`
            : "The site is rebuilding; the page is live in about 30 seconds.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Send failed", description: error.message, variant: "destructive" });
    },
  });

  const prepareMutation = useMutation({
    mutationFn: async (forceQuotes: boolean = false) => {
      const res = await apiRequest("POST", `/api/sermons/${params.id}/prepare`, { forceQuotes });
      return res.json();
    },
    onSuccess: (_data, forceQuotes) => {
      // Refetch: this is what surfaces the new Activity line, and what lets the
      // client see "AI Job Started" -- which is what turns on the polling and
      // the Generating badge. Without it nothing appears until a manual reload.
      queryClient.invalidateQueries({ queryKey: ["/api/sermons", params.id] });
      toast({
        title: forceQuotes ? "Regenerating moments" : "Prepare started",
        description: forceQuotes
          ? "Re-picking moments from the transcript. Anything you have already reviewed stays put; only untouched ones are replaced."
          : "Claude is drafting the descriptions and moments from the transcript. This page updates itself as they land.",
      });
    },
    onError: (error: Error) =>
      toast({ title: "Prepare failed", description: error.message, variant: "destructive" }),
  });

  const descriptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sermons/${params.id}/descript`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sermons", params.id] });
      toast({
        title: "Descript started",
        description:
          "The audio is uploading to Descript. The transcript, descriptions and moments fill in here as they land.",
      });
    },
    onError: (error: Error) =>
      toast({ title: "Descript failed", description: error.message, variant: "destructive" }),
  });

  const scheduleSave = (delay: number) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveRef.current(), delay);
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFields((prev) => ({ ...prev, [fieldName]: value }));
    setHasChanges(true);
    dirtyRef.current++;
    scheduleSave(typeof value === "boolean" ? 0 : 900);
  };

  const handleSave = () => {
    // Build the diff of changed fields
    if (!sermon) return;
    if (updateMutation.isPending) { scheduleSave(500); return; }
    const changed: Record<string, any> = {};
    for (const [key, val] of Object.entries(fields)) {
      if (JSON.stringify(val) !== JSON.stringify(sermon.fields[key as keyof typeof sermon.fields])) {
        changed[key] = val;
      }
    }
    if (title !== (sermon.fields["Title"] || "")) {
      changed["Title"] = title;
    }
    savedDirtyRef.current = dirtyRef.current;
    if (Object.keys(changed).length > 0) {
      updateMutation.mutate(changed);
    } else {
      setHasChanges(false);
    }
  };
  saveRef.current = handleSave;

  if (isLoading) {
    return (
      <div className="p-3 md:p-4 max-w-5xl mx-auto space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-7 w-80" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!sermon) {
    return (
      <div className="p-3 md:p-4 text-center text-muted-foreground">
        Sermon not found.
      </div>
    );
  }

  const platform = fields["Platform"] || "";
  const isSunday = platform === "Sunday";

  // What Send Sermon still needs before it can run.
  const sendMissing: string[] = [];
  if (!title.trim()) sendMissing.push("Title");
  if (!fields["Service"]) sendMissing.push("Service date");
  if (isSunday && !fields["YouTube Trimmed URL"]) sendMissing.push("YouTube trimmed video");
  if (!isSunday && !fields["Wednesday YouTube Link"]) sendMissing.push("YouTube link");
  const canSend = sendMissing.length === 0 && !hasChanges && !sendMutation.isPending;

  // Descriptions publish on their own, onto a page the sermon already created.
  const hasDescription = !!(
    (fields["Manual Short Description"] || fields["Short Description"] || "").trim() ||
    (fields["Manual Long Description"] || fields["Long Description"] || "").trim()
  );
  const sermonIsLive = !!fields["Sermon URL"];
  // The Descript transcript (made from the Drive audio) is the source for
  // everything in the AI box; Whisper is gone, so no transcript = nothing to draft.
  const hasAudio = !!(fields["Audio URL"] || fields["Trimmed Audio"]);
  const hasTranscript = !!(fields["Transcription URL"] || "").trim();
  const canSendDescriptions = hasDescription && !hasChanges && !sendMutation.isPending;

  return (
    <div className="p-3 md:p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" data-testid="button-back">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sermons</span>
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">
              {formatLongDate(fields["Service"])}
            </span>
            <PlatformBadge platform={platform} />
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setHasChanges(true);
              dirtyRef.current++;
              scheduleSave(900);
            }}
            placeholder="Enter sermon title..."
            className={`text-base font-semibold bg-transparent outline-none w-full text-foreground placeholder:text-muted-foreground/50 ${
              title.trim() ? "border-none" : "border-0 border-b border-red-500/50"
            }`}
            data-testid="input-sermon-title"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {(hasChanges || updateMutation.isPending) && (
            <span
              className="text-[10px] text-muted-foreground inline-flex items-center gap-1.5"
              data-testid="status-saving"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Saving...
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-7 text-xs"
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}#/sermon/${params.id}`;
              navigator.clipboard.writeText(url);
              toast({ title: "Link copied", description: "Share link copied to clipboard." });
            }}
            data-testid="button-share"
          >
            <Share2 className="w-3 h-3" />
            Share
          </Button>
        </div>
      </div>

      {/* Two owners, two bars: green is the media track, yellow the AI track. */}
      {sermon && (
        <div className="grid grid-cols-2 gap-3 mb-3" data-testid="progress-bars">
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">Media</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{mediaProgress(sermon)}%</span>
            </div>
            <Progress value={mediaProgress(sermon)} className="h-1.5 [&>div]:bg-emerald-500" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">AI content</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{aiProgress(sermon)}%</span>
            </div>
            <Progress value={aiProgress(sermon)} className="h-1.5 [&>div]:bg-primary" />
          </div>
        </div>
      )}
      {/* Two-column layout on larger screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left column — Workflow Steps */}
      <div>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Workflow
      </h2>
      <div className="space-y-2 mb-4 lg:mb-0">
        {isSunday ? (
          <>
            {/* SUNDAY Step 1: Google Drive Files */}
            <WorkflowStep
              title="Google Drive Files"
              icon={<Upload className="w-3.5 h-3.5" />}
              isComplete={!!(fields["Video URL"] && fields["Trimmed Video URL"] && fields["Audio URL"])}
              stepNumber={1}
            >
              <UrlField
                label="Full Service"
                value={fields["Video URL"] || ""}
                fieldName="Video URL"
                onChange={handleFieldChange}
                placeholder="google drive link"
                required
              />
              <UrlField
                label="Trimmed Message"
                value={fields["Trimmed Video URL"] || ""}
                fieldName="Trimmed Video URL"
                onChange={handleFieldChange}
                placeholder="google drive link"
                required
              />
              <UrlField
                label="Trimmed Audio"
                value={fields["Audio URL"] || ""}
                fieldName="Audio URL"
                onChange={handleFieldChange}
                placeholder="google drive link"
                required
              />
            </WorkflowStep>

            {/* SUNDAY Step 2: YouTube */}
            <WorkflowStep
              title="YouTube"
              icon={<Youtube className="w-3.5 h-3.5" />}
              isComplete={!!(fields["YouTube Full Service URL"] && fields["YouTube Trimmed URL"] && fields["YouTube Hidden"])}
              stepNumber={2}
            >
              <UrlField
                label="Full Service"
                value={fields["YouTube Full Service URL"] || ""}
                fieldName="YouTube Full Service URL"
                onChange={handleFieldChange}
                required
              />
              <div className="space-y-0.5">
                <CheckboxField
                  label="Set to Hidden?"
                  checked={!!fields["YouTube Hidden"]}
                  fieldName="YouTube Hidden"
                  onChange={handleFieldChange}
                />
                <p className="text-[10px] text-muted-foreground/70 pl-6">
                  Not until the trimmed video is live.
                </p>
              </div>
              <UrlField
                label="New Trimmed Message"
                value={fields["YouTube Trimmed URL"] || ""}
                fieldName="YouTube Trimmed URL"
                onChange={handleFieldChange}
                required
              />
            </WorkflowStep>

            {/* SUNDAY Step 3: Facebook */}
            <WorkflowStep
              title="Facebook"
              icon={<SiFacebook className="w-3.5 h-3.5" />}
              isComplete={!!fields["Facebook Done"]}
              stepNumber={3}
            >
              <CheckboxField
                label="Trimmed and Titled"
                checked={!!fields["Facebook Done"]}
                fieldName="Facebook Done"
                onChange={handleFieldChange}
              />
            </WorkflowStep>

            {/* SUNDAY Step 4: Website */}
            <WorkflowStep
              title="Website"
              icon={<Globe className="w-3.5 h-3.5" />}
              isComplete={!!fields["Website Done"]}
              stepNumber={4}
            >
              <div className="space-y-1">
                <Button
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  disabled={!canSend}
                  onClick={() => sendMutation.mutate("sermon")}
                  data-testid="button-send-to-website"
                >
                  <Globe className="w-3 h-3" />
                  {sendMutation.isPending
                    ? "Sending..."
                    : fields["Sermon URL"]
                      ? "Re-send to Website"
                      : "Send Sermon to Website"}
                </Button>
                {hasChanges && (
                  <p className="text-[10px] text-muted-foreground/70">Saving your changes...</p>
                )}
                {!hasChanges && sendMissing.length > 0 && (
                  <p className="text-[10px] text-red-400/80">Needs: {sendMissing.join(", ")}</p>
                )}
              </div>
              <CheckboxField
                label="Verified Live"
                checked={!!fields["Website Done"]}
                fieldName="Website Done"
                onChange={handleFieldChange}
              />
              <UrlField
                label="Sermon URL"
                value={fields["Sermon URL"] || ""}
                fieldName="Sermon URL"
                onChange={handleFieldChange}
              />
            </WorkflowStep>
          </>
        ) : (
          <>
            {/* WEDNESDAY Step 1: Clean Edit */}
            <WorkflowStep
              title="Clean Edit"
              icon={<Upload className="w-3.5 h-3.5" />}
              isComplete={!!fields["Video URL"]}
              stepNumber={1}
            >
              <UrlField
                label="Video URL"
                value={fields["Video URL"] || ""}
                fieldName="Video URL"
                onChange={handleFieldChange}
                required
              />
            </WorkflowStep>

            {/* WEDNESDAY Step 2: Audio */}
            <WorkflowStep
              title="Audio"
              icon={<Headphones className="w-3.5 h-3.5" />}
              isComplete={!!fields["Audio URL"]}
              stepNumber={2}
            >
              <UrlField
                label="Audio URL"
                value={fields["Audio URL"] || ""}
                fieldName="Audio URL"
                onChange={handleFieldChange}
                required
              />
            </WorkflowStep>

            {/* WEDNESDAY Step 3: Trim Live Streams */}
            <WorkflowStep
              title="Trim Live Streams"
              icon={<ScissorsLineDashed className="w-3.5 h-3.5" />}
              isComplete={!!(fields["Facebook Done"] && fields["Wednesday YouTube Trimmed"])}
              stepNumber={3}
            >
              <CheckboxField
                label="Facebook"
                checked={!!fields["Facebook Done"]}
                fieldName="Facebook Done"
                onChange={handleFieldChange}
              />
              <CheckboxField
                label="YouTube"
                checked={!!fields["Wednesday YouTube Trimmed"]}
                fieldName="Wednesday YouTube Trimmed"
                onChange={handleFieldChange}
              />
            </WorkflowStep>

            {/* WEDNESDAY Step 4: YouTube Link */}
            <WorkflowStep
              title="YouTube Link"
              icon={<Link2 className="w-3.5 h-3.5" />}
              isComplete={!!fields["Wednesday YouTube Link"]}
              stepNumber={4}
            >
              <UrlField
                label="YouTube Link"
                value={fields["Wednesday YouTube Link"] || ""}
                fieldName="Wednesday YouTube Link"
                onChange={handleFieldChange}
                required
              />
            </WorkflowStep>

            {/* WEDNESDAY Step 5: Website */}
            <WorkflowStep
              title="Website"
              icon={<Globe className="w-3.5 h-3.5" />}
              isComplete={!!fields["Website Done"]}
              stepNumber={5}
            >
              <div className="space-y-1">
                <Button
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  disabled={!canSend}
                  onClick={() => sendMutation.mutate("sermon")}
                  data-testid="button-send-to-website"
                >
                  <Globe className="w-3 h-3" />
                  {sendMutation.isPending
                    ? "Sending..."
                    : fields["Sermon URL"]
                      ? "Re-send to Website"
                      : "Send Sermon to Website"}
                </Button>
                {hasChanges && (
                  <p className="text-[10px] text-muted-foreground/70">Saving your changes...</p>
                )}
                {!hasChanges && sendMissing.length > 0 && (
                  <p className="text-[10px] text-red-400/80">Needs: {sendMissing.join(", ")}</p>
                )}
              </div>
              <CheckboxField
                label="Verified Live"
                checked={!!fields["Website Done"]}
                fieldName="Website Done"
                onChange={handleFieldChange}
              />
              <UrlField
                label="Sermon URL"
                value={fields["Sermon URL"] || ""}
                fieldName="Sermon URL"
                onChange={handleFieldChange}
              />
            </WorkflowStep>
          </>
        )}
      </div>

      </div>

      {/* Right column — Additional Info & Edits */}
      <div>
      {/* The AI workspace: generation controls + the drafts they fill, on a
          tinted ground so it reads as one thing amid a full page. */}
      <div className="rounded-lg border border-primary/25 bg-primary/[0.05] p-3 mb-4">
      <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
        <h2 className="text-xs font-semibold text-primary/90 uppercase tracking-wide flex items-center gap-1.5">
          <Wand2 className="w-3.5 h-3.5" /> AI Content
        </h2>
        <div className="flex items-center gap-2">
          {aiRunning && !aiStalled && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/30 rounded-full px-2 py-1"
              data-testid="badge-ai-generating"
              title="Started at the time shown; this page refreshes itself every 15 seconds"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Generating{aiMinutes > 0 ? ` · ${aiMinutes}m` : ""}
            </span>
          )}
          {aiStalled && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-1"
              data-testid="badge-ai-stalled"
              title="Nothing has come back. Check the Actions tab on the website repo, then run it again."
            >
              No result after {aiMinutes}m
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-7 text-xs"
            disabled={prepareMutation.isPending || !hasTranscript}
            onClick={() => prepareMutation.mutate(false)}
            data-testid="button-prepare-sermon"
            title={hasTranscript ? "Draft descriptions + moments from the transcript with AI" : "Needs the Descript transcript first"}
          >
            <Wand2 className="w-3 h-3" />
            {prepareMutation.isPending ? "Starting..." : "Prepare with AI"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-7 text-xs"
            disabled={prepareMutation.isPending || !hasTranscript}
            onClick={() => prepareMutation.mutate(true)}
            data-testid="button-regenerate-moments"
            title={hasTranscript ? "Re-pick moments from the transcript. Moments you have reviewed are kept; only untouched ones are replaced." : "Needs the Descript transcript first"}
          >
            <Wand2 className="w-3 h-3" />
            Re-pick moments
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {/* The transcript comes from Descript, fed by the Drive audio. It is the
            source for every draft below, so it leads the box. */}
        <div className="space-y-1.5 rounded-md border border-primary/30 bg-background/60 p-2">
          <UrlField
            label="Descript transcript"
            value={fields["Transcription URL"] || ""}
            fieldName="Transcription URL"
            onChange={handleFieldChange}
            placeholder="filled in by Generate Transcript + Descriptions"
            level="wanted"
            hint="Add the Audio URL (Google Drive link) in the workflow first. Generate Transcript + Descriptions sends that audio to Descript for the transcript, then drafts the descriptions and moment quotes from it (about 10 minutes). Everything in this box comes from that transcript, so if this field is empty, nothing can be drafted yet."
          />
          <Button
            size="sm"
            className="gap-1.5 h-7 text-xs w-full"
            disabled={descriptMutation.isPending || !hasAudio}
            onClick={() => descriptMutation.mutate()}
            data-testid="button-descript"
            title={hasAudio ? "Send the audio to Descript, then draft descriptions + moments" : "Add the Audio URL in the workflow first"}
          >
            <Wand2 className="w-3 h-3" />
            {descriptMutation.isPending ? "Starting..." : "Generate Transcript + Descriptions"}
          </Button>
        </div>
        {/* Steering note sits ABOVE the drafts: you aim the AI, then regenerate. */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground inline-flex items-center gap-1">
            Direction for AI
            <span title="Optional. Steers what the descriptions lead with and which moments get picked. Never changes how moments are quoted.">
              <Info className="w-3 h-3 text-muted-foreground/60" />
            </span>
          </Label>
          <ExpandTextarea
            value={fields["AI Direction"] || ""}
            onChange={(e) => handleFieldChange("AI Direction", e.target.value)}
            placeholder="e.g. the part about believing God and an architecture imprinted on our minds"
            collapsedHeight="h-[60px]" className={`text-xs bg-background${fieldRing("optional", fields["AI Direction"])}`}
            data-testid="input-ai-direction"
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">AI Short Description</Label>
            <CharCount value={fields["Short Description"]} />
          </div>
          <ExpandTextarea
            value={fields["Short Description"] || ""}
            onChange={(e) => handleFieldChange("Short Description", e.target.value.slice(0, SHORT_DESC_MAX))}
            placeholder="Short public description, in our voice. Max 125 characters (two lines on the site)."
            collapsedHeight="h-[60px]" className={`text-xs bg-background${fieldRing("wanted", fields["Short Description"])}`}
            data-testid="input-description"
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Manual Short Description</Label>
            <CharCount value={fields["Manual Short Description"]} />
          </div>
          <ExpandTextarea
            value={fields["Manual Short Description"] || ""}
            onChange={(e) => handleFieldChange("Manual Short Description", e.target.value.slice(0, SHORT_DESC_MAX))}
            placeholder="Optional. If filled, this wins over the AI version at publish."
            collapsedHeight="h-[60px]" className={`text-xs bg-background${fieldRing("optional", fields["Manual Short Description"])}`}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">AI Long Description</Label>
          <ExpandTextarea
            value={fields["Long Description"] || ""}
            onChange={(e) => handleFieldChange("Long Description", e.target.value)}
            placeholder="Fuller context for the message page. Written from the transcript; no length cap."
            collapsedHeight="h-[80px]" className={`text-xs bg-background${fieldRing("wanted", fields["Long Description"])}`}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Manual Long Description</Label>
          <ExpandTextarea
            value={fields["Manual Long Description"] || ""}
            onChange={(e) => handleFieldChange("Manual Long Description", e.target.value)}
            placeholder="Optional. If filled, this wins over the AI version at publish."
            collapsedHeight="h-[80px]" className={`text-xs bg-background${fieldRing("optional", fields["Manual Long Description"])}`}
          />
        </div>
        {/* Descriptions publish on their own, so approving copy never holds up
            the video (and re-sending the sermon never overwrites this copy). */}
        <div className="space-y-1">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-7 text-xs w-full"
            disabled={!canSendDescriptions}
            onClick={() => sendMutation.mutate("descriptions")}
            data-testid="button-send-descriptions"
            title="Publish just the descriptions to the message page"
          >
            <Globe className="w-3 h-3" />
            {sendMutation.isPending ? "Sending..." : "Send Descriptions to Website"}
          </Button>
          {hasChanges ? (
            <p className="text-[10px] text-muted-foreground/70">Saving your changes...</p>
          ) : !hasDescription ? (
            <p className="text-[10px] text-muted-foreground/70">
              Nothing to send yet. Add a description above, or use Prepare with AI.
            </p>
          ) : !sermonIsLive ? (
            <p className="text-[10px] text-amber-400/80">
              Send the sermon to the website first; descriptions attach to that page.
            </p>
          ) : null}
        </div>
      </div>
      </div>
      {/* everything below is plain record-keeping, outside the AI workspace */}
      <div className="space-y-3 mb-4">
        {fields["AI Service Transcript"] && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              AI Service Transcript
              <span className="text-[10px] text-muted-foreground/60 ml-1">(Whisper — not verbatim to Descript)</span>
            </Label>
            <ExpandTextarea
              value={fields["AI Service Transcript"] || ""}
              readOnly
              collapsedHeight="h-[60px]"
              className="text-xs bg-background/60 text-muted-foreground"
            />
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">General Notes</Label>
          <Textarea
            value={fields["General Notes"] || ""}
            onChange={(e) => {
              handleFieldChange("General Notes", e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
              }
            }}
            placeholder="Add notes..."
            className="min-h-[60px] text-xs bg-background resize-none overflow-hidden"
            data-testid="input-general-notes"
          />
        </div>

        {!isSunday && (
          <Card className="p-3 space-y-2">
            <h3 className="text-xs font-medium text-foreground">Replay</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Replayed On</Label>
                <Input
                  type="date"
                  value={fields["Replayed On"] || ""}
                  onChange={(e) => handleFieldChange("Replayed On", e.target.value || null)}
                  className="text-xs h-7 bg-background"
                  data-testid="input-replayed-on"
                />
              </div>
              <div className="space-y-1.5">
                <CheckboxField
                  label="Don't Replay"
                  checked={!!fields["Don't Replay"]}
                  fieldName="Don't Replay"
                  onChange={handleFieldChange}
                />
                {fields["Don't Replay"] && (
                  <Input
                    type="text"
                    placeholder="Reason..."
                    value={fields["Don't Replay Reason"] || ""}
                    onChange={(e) =>
                      handleFieldChange("Don't Replay Reason", e.target.value)
                    }
                    className="text-xs h-7 bg-background"
                    data-testid="input-dont-replay-reason"
                  />
                )}
              </div>
            </div>
          </Card>
        )}

      </div>

      {/* Edits Section */}
      <Separator className="my-3" />
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Edits
        </h2>
        <div className="flex items-center gap-1.5">
          <NewEditDialog sermon={sermon} />
          <Link href="/edits">
            <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 px-2" data-testid="button-view-all-edits">
              View All <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </div>
      {linkedEdits && linkedEdits.length > 0 ? (
        <div className="space-y-1.5">
          {linkedEdits.map((edit) => (
            <Link key={edit.id} href={`/edits/${edit.id}`} className="block">
              <Card className="p-2.5 flex items-center gap-2.5 cursor-pointer hover:bg-accent/30 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {edit.fields["Title"] || "Untitled Edit"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {edit.fields["Type"]?.map((t) => (
                      <TypeBadge key={t} type={t} className="text-[10px] leading-tight" />
                    ))}
                    <StatusBadge
                      status={edit.fields["Status"]}
                      className="text-[10px] leading-tight"
                    />
                    {edit.fields["Editor Name"] && (
                      <span className="text-[10px] text-muted-foreground">
                        {edit.fields["Editor Name"]}
                      </span>
                    )}
                  </div>
                </div>
                {edit.fields["Video URL"] && (
                  <OpenLinkButton
                    url={edit.fields["Video URL"]}
                    label="Open video"
                    className="h-6 px-1.5"
                  />
                )}
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No edits linked to this service yet.
        </p>
      )}

      {/* Recap & Clips live with the edits they come from */}
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <UrlField
              label="Recap URL"
              value={fields["Recap URL"] || ""}
              fieldName="Recap URL"
              onChange={handleFieldChange}
            />
            {completedRecap && !fields["Recap URL"] && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  handleFieldChange("Recap URL", completedRecap.fields["Video URL"])
                }
                data-testid="button-use-recap-edit-url"
              >
                <Wand2 className="w-3 h-3" />
                Use "{completedRecap.fields["Title"] || "recap edit"}" video
              </Button>
            )}
          </div>
          <div className="flex items-end pb-0.5">
            <CheckboxField
              label="Clips"
              checked={!!fields["Clips"]}
              fieldName="Clips"
              onChange={handleFieldChange}
            />
          </div>
        </div>
      </div>
      </div>
      </div>{/* close grid */}

      <WebsiteQuotes
        sermonId={params.id!}
        serviceDate={fields["Service"]}
        polling={!!aiStartedAt && !isNaN(aiStartedAt.getTime()) && Date.now() - aiStartedAt.getTime() < 12 * 60000}
      />
      <ActivityLog value={fields["Activity"]} />


    </div>
  );
}
