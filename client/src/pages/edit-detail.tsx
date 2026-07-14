import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExpandTextarea } from "@/components/ui/expand-textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  ChevronRight,
  Save,
  Trash2,
  Upload,
  Scissors,
  Headphones,
  FileText,
  Youtube,
  Globe,
  ExternalLink,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatLongDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { OpenLinkButton, requiredClass } from "@/components/fields";
import { PlatformBadge, StatusBadge, TypeBadge } from "@/components/badges";
import type { Edit, Sermon } from "@shared/schema";

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

// Progress tint mirroring the sermon page's complete/incomplete language:
// amber while pending, emerald once done.
function doneRing(done: boolean): string {
  return done
    ? " border-emerald-500/60 focus-visible:ring-emerald-500/20"
    : " border-amber-500/60 focus-visible:ring-amber-500/20";
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-3 space-y-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
        {title}
      </p>
      {children}
    </Card>
  );
}

function UrlRow({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  hint,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">
        {label}
        {hint && <span className="text-[10px] text-muted-foreground/60 ml-1">{hint}</span>}
      </Label>
      <div className="flex gap-2">
        <Input
          type="url"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`text-xs h-8 bg-background${required ? requiredClass(true, value) : ""}`}
        />
        {value && <OpenLinkButton url={value} label={`Open ${label}`} />}
      </div>
    </div>
  );
}

// Notes render as a small "+ Add" link until they have content.
function CollapsibleNotes({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(!!value);
  useEffect(() => {
    if (value) setOpen(true);
  }, [value]);
  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        + Add {label}
      </Button>
    );
  }
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs min-h-[60px] bg-background resize-none"
      />
    </div>
  );
}

function SermonReferenceCard({
  icon,
  label,
  url,
}: {
  icon: React.ReactNode;
  label: string;
  url?: string;
}) {
  const inner = (
    <div className="flex items-center gap-2.5">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {url ? (
          <p className="text-xs text-blue-400 truncate mt-0.5">
            {url.length > 50 ? url.slice(0, 50) + "..." : url}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">Not set</p>
        )}
      </div>
      {url && <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
    </div>
  );
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Card className="p-3 border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
          {inner}
        </Card>
      </a>
    );
  }
  return <Card className="p-3 border border-border bg-muted/30">{inner}</Card>;
}

function SermonReference({ sermon }: { sermon: Sermon }) {
  const platform = sermon.fields["Platform"];
  const isSunday = platform === "Sunday";
  const cards = isSunday
    ? [
        { icon: <Upload className="w-3 h-3" />, label: "Full Service", url: sermon.fields["Video URL"] },
        { icon: <Scissors className="w-3 h-3" />, label: "Trimmed Media", url: sermon.fields["Trimmed Video URL"] },
        { icon: <Headphones className="w-3 h-3" />, label: "Audio", url: sermon.fields["Audio URL"] },
        { icon: <FileText className="w-3 h-3" />, label: "Transcription", url: sermon.fields["Transcription URL"] },
        { icon: <Youtube className="w-3 h-3" />, label: "YouTube New Video", url: sermon.fields["YouTube Trimmed URL"] },
        { icon: <Globe className="w-3 h-3" />, label: "Website URL", url: sermon.fields["Sermon URL"] },
      ]
    : [
        { icon: <Upload className="w-3 h-3" />, label: "Clean Edit", url: sermon.fields["Video URL"] },
        { icon: <Headphones className="w-3 h-3" />, label: "Audio", url: sermon.fields["Audio URL"] },
        { icon: <FileText className="w-3 h-3" />, label: "Transcription", url: sermon.fields["Transcription URL"] },
        { icon: <Youtube className="w-3 h-3" />, label: "YouTube Link", url: sermon.fields["Wednesday YouTube Link"] },
        { icon: <Globe className="w-3 h-3" />, label: "Website URL", url: sermon.fields["Sermon URL"] },
      ];
  return (
    <div className="space-y-2 mt-4">
      <Separator />
      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Sermon Reference
        </span>
        {sermon.fields["Title"] && (
          <span className="text-xs text-muted-foreground">— {sermon.fields["Title"]}</span>
        )}
        <PlatformBadge platform={platform} className="text-[10px] leading-tight" />
        <Link href={`/sermon/${sermon.id}`}>
          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground ml-auto">
            Open Sermon <ChevronRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {cards.map((card) => (
          <SermonReferenceCard key={card.label} icon={card.icon} label={card.label} url={card.url} />
        ))}
      </div>
    </div>
  );
}

export default function EditDetailPage() {
  const params = useParams() as { id: string };
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: edits, isLoading } = useQuery<Edit[]>({ queryKey: ["/api/edits"] });
  const edit = edits?.find((e) => e.id === params.id);

  const [fields, setFields] = useState<Edit["fields"]>({} as Edit["fields"]);
  const [hasChanges, setHasChanges] = useState(false);
  const [transcriptUrl, setTranscriptUrl] = useState("");
  const [transcriptDirty, setTranscriptDirty] = useState(false);

  useEffect(() => {
    if (edit) setFields(edit.fields);
  }, [edit]);

  // Resolve the linked sermon: prefer the real Sermon Link record ID,
  // fall back to broadcast-date matching for older edits.
  const sermonLinkId = edit?.fields["Sermon Link"]?.[0];
  const broadcastDate = edit?.fields["Broadcast Date"];
  const { data: sermonById } = useQuery<Sermon>({
    queryKey: ["/api/sermons", sermonLinkId],
    enabled: !!sermonLinkId,
  });
  const { data: sermonSearch } = useQuery<{ records: Sermon[] }>({
    queryKey: ["/api/sermons/search", broadcastDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sermons/search?date=${broadcastDate}`);
      return res.json();
    },
    enabled: !sermonLinkId && !!broadcastDate,
  });
  const linkedSermon = sermonLinkId ? sermonById || null : sermonSearch?.records?.[0] || null;

  // The full-service transcript lives on the sermon record; mirror it here.
  const sermonTranscript = linkedSermon?.fields["Transcription URL"] || "";
  useEffect(() => {
    if (!transcriptDirty) setTranscriptUrl(sermonTranscript);
  }, [sermonTranscript, transcriptDirty]);

  const updateMutation = useMutation({
    mutationFn: async ({
      changed,
      transcript,
    }: {
      changed: Record<string, any>;
      transcript?: string;
    }) => {
      if (Object.keys(changed).length > 0) {
        await apiRequest("PATCH", `/api/edits/${params.id}`, changed);
      }
      if (transcript !== undefined && linkedSermon) {
        await apiRequest("PATCH", `/api/sermons/${linkedSermon.id}`, {
          "Transcription URL": transcript,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/edits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sermons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sermons/search"] });
      setHasChanges(false);
      setTranscriptDirty(false);
      toast({ title: "Saved", description: "Edit updated." });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/edits/${params.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/edits"] });
      toast({ title: "Deleted", description: "Edit removed." });
      navigate("/edits");
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const prepareMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/edits/${params.id}/prepare`);
      return res.json();
    },
    onSuccess: () =>
      toast({
        title: "Prepare started",
        description:
          "Stream upload, transcript, and draft descriptions are running. Refresh in ~10 minutes to review the drafts.",
      }),
    onError: (err: Error) =>
      toast({ title: "Prepare failed", description: err.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/edits/${params.id}/publish`);
      return res.json();
    },
    onSuccess: () =>
      toast({
        title: "Publishing started",
        description: "The pipeline is running; the recap is on the site in about 10 minutes.",
      }),
    onError: (err: Error) =>
      toast({ title: "Publish failed", description: err.message, variant: "destructive" }),
  });

  const set = (field: string, value: any) => {
    setFields((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!edit) return;
    const changed: Record<string, any> = {};
    for (const [key, val] of Object.entries(fields)) {
      if (JSON.stringify(val) !== JSON.stringify(edit.fields[key as keyof typeof edit.fields])) {
        changed[key] = val;
      }
    }
    updateMutation.mutate({ changed, transcript: transcriptDirty ? transcriptUrl : undefined });
  };

  const showSave = hasChanges || (transcriptDirty && !!linkedSermon);
  const isRecap = (fields["Type"] || []).includes("Recap");

  if (isLoading) {
    return (
      <div className="p-3 md:p-4 max-w-5xl mx-auto space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="grid md:grid-cols-2 gap-3">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }
  if (!edit) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Edit not found.{" "}
        <Link href="/edits" className="text-primary hover:underline">
          Back to Edits
        </Link>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 max-w-5xl mx-auto">
      {/* Header */}
      <Link href="/edits" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2">
        <ArrowLeft className="w-3.5 h-3.5" /> All edits
      </Link>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <Input
            value={fields["Title"] || ""}
            onChange={(e) => set("Title", e.target.value)}
            placeholder="Edit title..."
            className={`text-lg font-semibold h-10 bg-transparent border-transparent hover:border-border focus:border-border px-2 -ml-2${requiredClass(true, fields["Title"])}`}
            data-testid="input-edit-title"
          />
          <div className="flex items-center gap-2 mt-1 flex-wrap px-0.5">
            {(fields["Type"] || []).map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
            <StatusBadge status={fields["Status"]} />
            {broadcastDate && (
              <span className="text-xs text-muted-foreground">{formatLongDate(broadcastDate)}</span>
            )}
          </div>
        </div>
        {showSave && (
          <Button onClick={handleSave} disabled={updateMutation.isPending} size="sm" className="gap-1 text-xs h-8">
            <Save className="w-3.5 h-3.5" />
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3 items-start">
        {/* Left: production */}
        <div className="space-y-3">
          <SectionCard title="Details">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Editor Name</Label>
                <Input
                  value={fields["Editor Name"] || ""}
                  onChange={(e) => set("Editor Name", e.target.value)}
                  className="text-xs h-8 bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={fields["Status"] || ""} onValueChange={(v) => set("Status", v)}>
                  <SelectTrigger className={`text-xs h-8 bg-background${doneRing(fields["Status"] === "Completed")}`}>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Ready for Review">Ready for Review</SelectItem>
                    <SelectItem value="Revision Needed">Revision Needed</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Broadcast Date</Label>
                <Input
                  type="date"
                  value={fields["Broadcast Date"] || ""}
                  onChange={(e) => set("Broadcast Date", e.target.value)}
                  className={`text-xs h-8 bg-background${requiredClass(true, fields["Broadcast Date"])}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Date Completed</Label>
                <Input
                  type="date"
                  value={fields["Date Completed"] || ""}
                  onChange={(e) => set("Date Completed", e.target.value || null)}
                  className={`text-xs h-8 bg-background${doneRing(!!fields["Date Completed"])}`}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <div className="flex gap-4">
                {["Recap", "Clip", "Sizzle"].map((t) => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={(fields["Type"] || []).includes(t)}
                      onCheckedChange={(checked) => {
                        const current = fields["Type"] || [];
                        set("Type", checked ? [...current, t] : current.filter((x: string) => x !== t));
                      }}
                    />
                    <span className="text-xs text-foreground">{t}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Edit Description</Label>
              <ExpandTextarea
                value={fields["Edit Description"] || ""}
                onChange={(e) => set("Edit Description", e.target.value)}
                placeholder="What is this edit? One or two sentences (internal)."
                collapsedHeight="h-[44px]"
                className="text-xs bg-background"
              />
            </div>
          </SectionCard>

          <SectionCard title="Links">
            <UrlRow label="Video URL" hint="(include version number in file name)" value={fields["Video URL"] || ""} onChange={(v) => set("Video URL", v)} required />
            <UrlRow label="XML (Zipped)" value={fields["XML"] || ""} onChange={(v) => set("XML", v)} required />
            <UrlRow label="Vertical URL" value={fields["Vertical"] || ""} onChange={(v) => set("Vertical", v)} />
            <UrlRow
              label="Full Service Transcription"
              hint={linkedSermon ? "(saved to sermon)" : "(no linked sermon)"}
              value={transcriptUrl}
              disabled={!linkedSermon}
              placeholder={linkedSermon ? "Enter transcription URL..." : "Link a sermon to set a transcription"}
              onChange={(v) => {
                setTranscriptUrl(v);
                setTranscriptDirty(true);
              }}
            />
            <UrlRow
              label="Final Edit Transcription"
              hint="(auto-generated when the recap is sent to the website)"
              value={fields["Transcript"] || ""}
              onChange={(v) => set("Transcript", v)}
              placeholder="Filled by the publish pipeline..."
            />
          </SectionCard>
        </div>

        {/* Right: website + notes */}
        <div className="space-y-3">
          <SectionCard title="Website">
            <div className="grid grid-cols-1 gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Short Website Description</Label>
                  <CharCount value={fields["Short Website Description"]} />
                </div>
                <ExpandTextarea
                  value={fields["Short Website Description"] || ""}
                  onChange={(e) => set("Short Website Description", e.target.value.slice(0, SHORT_DESC_MAX))}
                  placeholder="One-line tagline. Max 125 characters."
                  collapsedHeight="h-[52px]"
                  className="text-xs bg-background"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Manual Short</Label>
                  <CharCount value={fields["Manual Short Website Description"]} />
                </div>
                <ExpandTextarea
                  value={fields["Manual Short Website Description"] || ""}
                  onChange={(e) => set("Manual Short Website Description", e.target.value.slice(0, SHORT_DESC_MAX))}
                  placeholder="Optional. Wins over generated at publish."
                  collapsedHeight="h-[52px]"
                  className="text-xs bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Long Description</Label>
                <ExpandTextarea
                  value={fields["Long Description"] || ""}
                  onChange={(e) => set("Long Description", e.target.value)}
                  placeholder="Fuller context for the recap page."
                  collapsedHeight="h-[52px]"
                  className="text-xs bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Manual Long</Label>
                <ExpandTextarea
                  value={fields["Manual Long Description"] || ""}
                  onChange={(e) => set("Manual Long Description", e.target.value)}
                  placeholder="Optional. Wins over generated at publish."
                  collapsedHeight="h-[52px]"
                  className="text-xs bg-background"
                />
              </div>
            </div>
            {isRecap && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs"
                    disabled={!fields["Video URL"] || hasChanges || prepareMutation.isPending}
                    onClick={() => prepareMutation.mutate()}
                    data-testid="button-prepare-recap"
                  >
                    <FileText className="w-3 h-3" />
                    {prepareMutation.isPending
                      ? "Starting..."
                      : fields["Stream ID"]
                        ? "Re-prepare"
                        : "Prepare"}
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 h-7 text-xs"
                    disabled={!fields["Video URL"] || hasChanges || publishMutation.isPending}
                    onClick={() => publishMutation.mutate()}
                    data-testid="button-publish-recap"
                  >
                    <Globe className="w-3 h-3" />
                    {publishMutation.isPending
                      ? "Starting..."
                      : fields["Recap URL"]
                        ? "Re-send to Website"
                        : "Send to Website"}
                  </Button>
                  {fields["Stream ID"] && (
                    <span className="text-[10px] font-medium text-emerald-500">Prepared ✓</span>
                  )}
                  {fields["Recap URL"] && (
                    <a
                      href={fields["Recap URL"]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-medium text-emerald-500 hover:underline"
                    >
                      On the website ↗
                    </a>
                  )}
                </div>
                {hasChanges && (
                  <p className="text-[10px] text-muted-foreground/70">Save your changes first.</p>
                )}
                {!hasChanges && !fields["Video URL"] && (
                  <p className="text-[10px] text-red-400/80">Needs a Video URL.</p>
                )}
                {!hasChanges && fields["Video URL"] && !fields["Stream ID"] && (
                  <p className="text-[10px] text-muted-foreground/70">
                    Prepare first (~10 min): uploads to Stream, transcribes, and drafts the
                    descriptions above for review. Send then goes live in about a minute.
                  </p>
                )}
                {!hasChanges && fields["Stream ID"] && !fields["Short Website Description"] && !fields["Manual Short Website Description"] && (
                  <p className="text-[10px] text-muted-foreground/70">
                    No Short Website Description yet; it will publish without a tagline.
                  </p>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Notes">
            <CollapsibleNotes label="JA Notes" value={fields["JA Notes"] || ""} onChange={(v) => set("JA Notes", v)} />
            <CollapsibleNotes label="Editor Notes" value={fields["Editors Notes"] || ""} onChange={(v) => set("Editors Notes", v)} />
          </SectionCard>

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive text-xs gap-1"
              onClick={() => {
                if (confirm("Delete this edit?")) deleteMutation.mutate();
              }}
              data-testid="button-delete-edit"
            >
              <Trash2 className="w-3 h-3" /> Delete edit
            </Button>
          </div>
        </div>
      </div>

      {linkedSermon && <SermonReference sermon={linkedSermon} />}

      {/* Floating save on mobile */}
      {showSave && (
        <div className="md:hidden fixed bottom-16 left-0 right-0 p-2 bg-background/80 backdrop-blur border-t border-border">
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full gap-1 h-9 text-sm">
            <Save className="w-3.5 h-3.5" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
