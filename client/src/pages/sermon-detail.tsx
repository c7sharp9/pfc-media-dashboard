import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState, useEffect } from "react";
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
} from "lucide-react";
import { SiFacebook } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatLongDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { UrlField, CheckboxField, OpenLinkButton, fieldRing } from "@/components/fields";
import { PlatformBadge, StatusBadge, TypeBadge } from "@/components/badges";
import NewEditDialog from "@/components/new-edit-dialog";
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

// Website Quotes: the selection table for "Moments from this message".
// Check the ones to publish, tweak the Final text (Original is never touched),
// then Send Quotes to Website -- re-sending REPLACES the live set, so the same
// button is also the update button.
function WebsiteQuotes({ sermonId, serviceDate }: { sermonId: string; serviceDate?: string }) {
  const { toast } = useToast();
  const date = (serviceDate || "").slice(0, 10);
  const { data } = useQuery<{ records: QuoteRecord[] }>({
    queryKey: ["/api/quotes", { date }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/quotes?date=${date}`);
      return res.json();
    },
    enabled: !!date,
  });
  const quotes = (data?.records || [])
    .slice()
    .sort((a, b) => timecodeSeconds(a.fields["Video Timecode"] || "") - timecodeSeconds(b.fields["Video Timecode"] || ""));
  const checkedCount = quotes.filter((q) => q.fields["On Website"]).length;

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const patchMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/quotes/${id}`, fields);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/quotes", { date }] }),
    onError: (error: Error) =>
      toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const sendQuotesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sermons/${sermonId}/send-quotes`);
      return res.json();
    },
    onSuccess: (result: { status: string; count: number; pageUrl: string }) => {
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
  });

  if (!date) return null;

  return (
    <div className="mt-4">
      <Separator className="my-3" />
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Quote className="w-3.5 h-3.5" /> Website Quotes
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
                ? "Re-send Quotes to Website"
                : "Send Quotes to Website"}
          </Button>
        </div>
      </div>
      {quotes.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No quotes for this service date yet. Claude extracts them from the transcript; they land here for review.
        </p>
      ) : (
        <div className="space-y-1.5">
          {quotes.map((q) => {
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
                    onChange={(e) =>
                      patchMutation.mutate({ id: q.id, fields: { "On Website": e.target.checked } })
                    }
                    aria-label="Publish this quote"
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
          })}
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

  const { data: sermon, isLoading } = useQuery<Sermon>({
    queryKey: ["/api/sermons", params.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sermons/${params.id}`);
      return res.json();
    },
  });

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
    if (sermon) {
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
      setHasChanges(false);
      toast({ title: "Saved", description: "Sermon updated successfully." });
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
  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sermons/${params.id}/send-to-website`);
      return res.json();
    },
    onSuccess: (result: { status: string; pageUrl: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sermons", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/sermons"] });
      toast({
        title:
          result.status === "unchanged"
            ? "Already up to date"
            : result.status === "updated"
              ? "Updated on website"
              : "Sent to website",
        description:
          result.status === "unchanged"
            ? "The website already has this exact sermon."
            : "The site is rebuilding; the page is live in about 30 seconds.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Send failed", description: error.message, variant: "destructive" });
    },
  });

  const prepareMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sermons/${params.id}/prepare`);
      return res.json();
    },
    onSuccess: () =>
      toast({
        title: "Prepare started",
        description:
          "Claude is drafting the descriptions and moment quotes from the transcript. Refresh in a few minutes to review.",
      }),
    onError: (error: Error) =>
      toast({ title: "Prepare failed", description: error.message, variant: "destructive" }),
  });

  const handleFieldChange = (fieldName: string, value: any) => {
    setFields((prev) => ({ ...prev, [fieldName]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // Build the diff of changed fields
    if (!sermon) return;
    const changed: Record<string, any> = {};
    for (const [key, val] of Object.entries(fields)) {
      if (JSON.stringify(val) !== JSON.stringify(sermon.fields[key as keyof typeof sermon.fields])) {
        changed[key] = val;
      }
    }
    if (title !== (sermon.fields["Title"] || "")) {
      changed["Title"] = title;
    }
    if (Object.keys(changed).length > 0) {
      updateMutation.mutate(changed);
    }
  };

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

  // What Send to Website still needs before it can run.
  const sendMissing: string[] = [];
  if (!title.trim()) sendMissing.push("Title");
  if (!fields["Service"]) sendMissing.push("Service date");
  if (isSunday && !fields["YouTube Trimmed URL"]) sendMissing.push("YouTube trimmed video");
  if (!isSunday && !fields["Wednesday YouTube Link"]) sendMissing.push("YouTube link");
  const canSend = sendMissing.length === 0 && !hasChanges && !sendMutation.isPending;

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
            }}
            placeholder="Enter sermon title..."
            className={`text-base font-semibold bg-transparent outline-none w-full text-foreground placeholder:text-muted-foreground/50 ${
              title.trim() ? "border-none" : "border-0 border-b border-red-500/50"
            }`}
            data-testid="input-sermon-title"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              size="sm"
              className="gap-1 h-7 text-xs"
              data-testid="button-save"
            >
              <Save className="w-3 h-3" />
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
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

            {/* SUNDAY Step 2: Full Service Transcription */}
            <WorkflowStep
              title="Full Service Transcription"
              icon={<FileText className="w-3.5 h-3.5" />}
              isComplete={!!fields["Transcription URL"]}
              stepNumber={2}
            >
              <UrlField
                label="Transcription URL"
                value={fields["Transcription URL"] || ""}
                fieldName="Transcription URL"
                onChange={handleFieldChange}
                placeholder="google drive link"
                required
              />
            </WorkflowStep>

            {/* SUNDAY Step 3: YouTube */}
            <WorkflowStep
              title="YouTube"
              icon={<Youtube className="w-3.5 h-3.5" />}
              isComplete={!!(fields["YouTube Full Service URL"] && fields["YouTube Trimmed URL"] && fields["YouTube Hidden"])}
              stepNumber={3}
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

            {/* SUNDAY Step 4: Facebook */}
            <WorkflowStep
              title="Facebook"
              icon={<SiFacebook className="w-3.5 h-3.5" />}
              isComplete={!!fields["Facebook Done"]}
              stepNumber={4}
            >
              <CheckboxField
                label="Trimmed and Titled"
                checked={!!fields["Facebook Done"]}
                fieldName="Facebook Done"
                onChange={handleFieldChange}
              />
            </WorkflowStep>

            {/* SUNDAY Step 5: Website */}
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
                  onClick={() => sendMutation.mutate()}
                  data-testid="button-send-to-website"
                >
                  <Globe className="w-3 h-3" />
                  {sendMutation.isPending
                    ? "Sending..."
                    : fields["Sermon URL"]
                      ? "Re-send to Website"
                      : "Send to Website"}
                </Button>
                {hasChanges && (
                  <p className="text-[10px] text-muted-foreground/70">Save your changes first.</p>
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

            {/* WEDNESDAY Step 3: Full Service Transcription */}
            <WorkflowStep
              title="Full Service Transcription"
              icon={<FileText className="w-3.5 h-3.5" />}
              isComplete={!!fields["Transcription URL"]}
              stepNumber={3}
            >
              <UrlField
                label="Transcription URL"
                value={fields["Transcription URL"] || ""}
                fieldName="Transcription URL"
                onChange={handleFieldChange}
                required
              />
            </WorkflowStep>

            {/* WEDNESDAY Step 4: Trim Live Streams */}
            <WorkflowStep
              title="Trim Live Streams"
              icon={<ScissorsLineDashed className="w-3.5 h-3.5" />}
              isComplete={!!(fields["Facebook Done"] && fields["Wednesday YouTube Trimmed"])}
              stepNumber={4}
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

            {/* WEDNESDAY Step 5: YouTube Link */}
            <WorkflowStep
              title="YouTube Link"
              icon={<Link2 className="w-3.5 h-3.5" />}
              isComplete={!!fields["Wednesday YouTube Link"]}
              stepNumber={5}
            >
              <UrlField
                label="YouTube Link"
                value={fields["Wednesday YouTube Link"] || ""}
                fieldName="Wednesday YouTube Link"
                onChange={handleFieldChange}
                required
              />
            </WorkflowStep>

            {/* WEDNESDAY Step 6: Website */}
            <WorkflowStep
              title="Website"
              icon={<Globe className="w-3.5 h-3.5" />}
              isComplete={!!fields["Website Done"]}
              stepNumber={6}
            >
              <div className="space-y-1">
                <Button
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  disabled={!canSend}
                  onClick={() => sendMutation.mutate()}
                  data-testid="button-send-to-website"
                >
                  <Globe className="w-3 h-3" />
                  {sendMutation.isPending
                    ? "Sending..."
                    : fields["Sermon URL"]
                      ? "Re-send to Website"
                      : "Send to Website"}
                </Button>
                {hasChanges && (
                  <p className="text-[10px] text-muted-foreground/70">Save your changes first.</p>
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
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Additional Info
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-7 text-xs"
          disabled={prepareMutation.isPending}
          onClick={() => prepareMutation.mutate()}
          data-testid="button-prepare-sermon"
          title="Draft descriptions + moment quotes from the transcript with AI"
        >
          <Wand2 className="w-3 h-3" />
          {prepareMutation.isPending ? "Starting..." : "Prepare with AI"}
        </Button>
      </div>
      <div className="space-y-3 mb-4">
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

      <WebsiteQuotes sermonId={params.id!} serviceDate={fields["Service"]} />

      {/* Save floating button on mobile */}
      {hasChanges && (
        <div className="md:hidden fixed bottom-16 left-0 right-0 p-2 bg-background/80 backdrop-blur border-t border-border">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full gap-1 h-9 text-sm"
            data-testid="button-save-mobile"
          >
            <Save className="w-3.5 h-3.5" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
