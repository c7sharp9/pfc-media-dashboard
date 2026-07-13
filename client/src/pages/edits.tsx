import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronDown,
  ChevronUp,
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
import { Link, useParams } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatShortDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { OpenLinkButton, requiredClass } from "@/components/fields";
import { PlatformBadge, StatusBadge, TypeBadge } from "@/components/badges";
import NewEditDialog from "@/components/new-edit-dialog";
import type { Edit, Sermon } from "@shared/schema";

// Read-only card showing a sermon URL field. The whole card is the link.
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

// Sermon reference section shown in expanded edit cards
function SermonReference({ sermon }: { sermon: Sermon }) {
  const platform = sermon.fields["Platform"];
  const isSunday = platform === "Sunday";

  const sundayCards = [
    { icon: <Upload className="w-3 h-3" />, label: "Full Service", url: sermon.fields["Video URL"] },
    { icon: <Scissors className="w-3 h-3" />, label: "Trimmed Media", url: sermon.fields["Trimmed Video URL"] },
    { icon: <Headphones className="w-3 h-3" />, label: "Audio", url: sermon.fields["Audio URL"] },
    { icon: <FileText className="w-3 h-3" />, label: "Transcription", url: sermon.fields["Transcription URL"] },
    { icon: <Youtube className="w-3 h-3" />, label: "YouTube New Video", url: sermon.fields["YouTube Trimmed URL"] },
    { icon: <Globe className="w-3 h-3" />, label: "Website URL", url: sermon.fields["Sermon URL"] },
  ];

  const wednesdayCards = [
    { icon: <Upload className="w-3 h-3" />, label: "Clean Edit", url: sermon.fields["Video URL"] },
    { icon: <Headphones className="w-3 h-3" />, label: "Audio", url: sermon.fields["Audio URL"] },
    { icon: <FileText className="w-3 h-3" />, label: "Transcription", url: sermon.fields["Transcription URL"] },
    { icon: <Youtube className="w-3 h-3" />, label: "YouTube Link", url: sermon.fields["Wednesday YouTube Link"] },
    { icon: <Globe className="w-3 h-3" />, label: "Website URL", url: sermon.fields["Sermon URL"] },
  ];

  const cards = isSunday ? sundayCards : wednesdayCards;

  return (
    <div className="space-y-2">
      <Separator />
      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Sermon Reference
        </span>
        {sermon.fields["Title"] && (
          <span className="text-xs text-muted-foreground">
            — {sermon.fields["Title"]}
          </span>
        )}
        <PlatformBadge platform={platform} className="text-[10px] leading-tight" />
        <Link href={`/sermon/${sermon.id}`}>
          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground ml-auto">
            Open Sermon
            <ChevronRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cards.map((card) => (
          <SermonReferenceCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            url={card.url}
          />
        ))}
      </div>
    </div>
  );
}

// Notes render as a small "+ Add" link until they have content (or are opened).
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
        className="text-xs min-h-[60px] bg-background"
      />
    </div>
  );
}

function EditCard({ edit, initialExpanded = false }: { edit: Edit; initialExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [editFields, setEditFields] = useState(edit.fields);
  const [hasChanges, setHasChanges] = useState(false);
  const [transcriptUrl, setTranscriptUrl] = useState("");
  const [transcriptDirty, setTranscriptDirty] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Scroll into view when opened directly via /edits/:id
  useEffect(() => {
    if (initialExpanded && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [initialExpanded]);

  // Resolve the linked sermon: prefer the real Sermon Link record ID,
  // fall back to broadcast-date matching for older edits.
  const sermonLinkId = edit.fields["Sermon Link"]?.[0];
  const broadcastDate = edit.fields["Broadcast Date"];

  const { data: sermonById } = useQuery<Sermon>({
    queryKey: ["/api/sermons", sermonLinkId],
    enabled: expanded && !!sermonLinkId,
  });

  const { data: sermonSearch } = useQuery<{ records: Sermon[] }>({
    queryKey: ["/api/sermons/search", broadcastDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sermons/search?date=${broadcastDate}`);
      return res.json();
    },
    enabled: expanded && !sermonLinkId && !!broadcastDate,
  });

  const linkedSermon = sermonLinkId
    ? sermonById || null
    : sermonSearch?.records?.[0] || null;

  // The transcript lives on the sermon record; mirror it here for editing.
  const sermonTranscript = linkedSermon?.fields["Transcription URL"] || "";
  useEffect(() => {
    if (!transcriptDirty) {
      setTranscriptUrl(sermonTranscript);
    }
  }, [sermonTranscript, transcriptDirty]);

  const updateMutation = useMutation({
    mutationFn: async ({
      fields,
      transcript,
    }: {
      fields: Record<string, any>;
      transcript?: string;
    }) => {
      if (Object.keys(fields).length > 0) {
        await apiRequest("PATCH", `/api/edits/${edit.id}`, fields);
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
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/edits/${edit.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/edits"] });
      toast({ title: "Deleted", description: "Edit removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Publish this recap to the website: kicks off the pfc-website GitHub
  // Action (download -> compress -> Stream -> captions -> site entry).
  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/edits/${edit.id}/publish`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Publishing started",
        description: "The pipeline is running; the recap is on the site in about 10 minutes.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFieldChange = (field: string, value: any) => {
    setEditFields((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const changed: Record<string, any> = {};
    for (const [key, val] of Object.entries(editFields)) {
      if (JSON.stringify(val) !== JSON.stringify(edit.fields[key as keyof typeof edit.fields])) {
        changed[key] = val;
      }
    }
    updateMutation.mutate({
      fields: changed,
      transcript: transcriptDirty ? transcriptUrl : undefined,
    });
  };

  const showSave = hasChanges || (transcriptDirty && !!linkedSermon);

  return (
    <Card ref={cardRef} className="overflow-hidden scroll-mt-4">
      <div
        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid={`edit-card-${edit.id}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {editFields["Type"]?.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
            <StatusBadge status={editFields["Status"]} />
          </div>
          <p className="text-sm font-medium text-foreground truncate mt-0.5">
            {editFields["Title"] || "Untitled Edit"}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {editFields["Editor Name"] && <span>{editFields["Editor Name"]}</span>}
            {editFields["Date Completed"] && (
              <span>Completed: {formatShortDate(editFields["Date Completed"])}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editFields["Video URL"] && (
            <OpenLinkButton
              url={editFields["Video URL"]}
              label="Open video"
              className="h-7 px-2"
            />
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-3 space-y-2.5 bg-card">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input
                value={editFields["Title"] || ""}
                onChange={(e) => handleFieldChange("Title", e.target.value)}
                className={`text-xs h-8 bg-background${requiredClass(true, editFields["Title"])}`}
                data-testid={`input-edit-title-${edit.id}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Editor Name</Label>
              <Input
                value={editFields["Editor Name"] || ""}
                onChange={(e) => handleFieldChange("Editor Name", e.target.value)}
                className={`text-xs h-8 bg-background${requiredClass(true, editFields["Editor Name"])}`}
                data-testid={`input-editor-name-${edit.id}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Broadcast Date</Label>
              <Input
                type="date"
                value={editFields["Broadcast Date"] || ""}
                onChange={(e) => handleFieldChange("Broadcast Date", e.target.value)}
                className={`text-xs h-8 bg-background${requiredClass(true, editFields["Broadcast Date"])}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={editFields["Status"] || ""}
                onValueChange={(v) => handleFieldChange("Status", v)}
              >
                <SelectTrigger className={`text-xs h-8 bg-background${requiredClass(true, editFields["Status"])}`}>
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
              <Label className="text-xs text-muted-foreground">Video URL</Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={editFields["Video URL"] || ""}
                  onChange={(e) => handleFieldChange("Video URL", e.target.value)}
                  className={`text-xs h-8 bg-background${requiredClass(true, editFields["Video URL"])}`}
                />
                {editFields["Video URL"] && (
                  <OpenLinkButton url={editFields["Video URL"]} label="Open video URL" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">XML (Zipped)</Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={editFields["XML"] || ""}
                  onChange={(e) => handleFieldChange("XML", e.target.value)}
                  className="text-xs h-8 bg-background"
                />
                {editFields["XML"] && (
                  <OpenLinkButton url={editFields["XML"]} label="Open XML" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Vertical URL</Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={editFields["Vertical"] || ""}
                  onChange={(e) => handleFieldChange("Vertical", e.target.value)}
                  className="text-xs h-8 bg-background"
                />
                {editFields["Vertical"] && (
                  <OpenLinkButton url={editFields["Vertical"]} label="Open vertical URL" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Full Service Transcription
                <span className="text-[10px] text-muted-foreground/60 ml-1">
                  {linkedSermon ? "(saved to sermon)" : "(no linked sermon)"}
                </span>
              </Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder={
                    linkedSermon
                      ? "Enter transcription URL..."
                      : "Link a sermon to set a transcription"
                  }
                  value={transcriptUrl}
                  disabled={!linkedSermon}
                  onChange={(e) => {
                    setTranscriptUrl(e.target.value);
                    setTranscriptDirty(true);
                  }}
                  className="text-xs h-8 bg-background"
                />
                {transcriptUrl && (
                  <OpenLinkButton url={transcriptUrl} label="Open transcription" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Final Edit Transcription</Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="Enter transcription URL..."
                  value={editFields["Transcript"] || ""}
                  onChange={(e) => handleFieldChange("Transcript", e.target.value)}
                  className="text-xs h-8 bg-background"
                />
                {editFields["Transcript"] && (
                  <OpenLinkButton url={editFields["Transcript"]} label="Open final edit transcription" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Date Completed</Label>
              <Input
                type="date"
                value={editFields["Date Completed"] || ""}
                onChange={(e) => handleFieldChange("Date Completed", e.target.value || null)}
                className="text-xs h-8 bg-background"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Edit Description</Label>
            <Textarea
              value={editFields["Edit Description"] || ""}
              onChange={(e) => handleFieldChange("Edit Description", e.target.value)}
              placeholder="What is this edit? One or two sentences."
              className="text-xs min-h-[48px] bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Short Website Description</Label>
            <Textarea
              value={editFields["Short Website Description"] || ""}
              onChange={(e) => handleFieldChange("Short Website Description", e.target.value)}
              placeholder="One-line tagline for the website."
              className="text-xs min-h-[36px] bg-background"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <div className="flex gap-4">
              {["Recap", "Clip", "Sizzle"].map((t) => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={(editFields["Type"] || []).includes(t)}
                    onCheckedChange={(checked) => {
                      const current = editFields["Type"] || [];
                      const next = checked
                        ? [...current, t]
                        : current.filter((x: string) => x !== t);
                      handleFieldChange("Type", next);
                    }}
                  />
                  <span className="text-xs text-foreground">{t}</span>
                </label>
              ))}
            </div>
          </div>

          <CollapsibleNotes
            label="JA Notes"
            value={editFields["JA Notes"] || ""}
            onChange={(v) => handleFieldChange("JA Notes", v)}
          />
          <CollapsibleNotes
            label="Editor Notes"
            value={editFields["Editors Notes"] || ""}
            onChange={(v) => handleFieldChange("Editors Notes", v)}
          />

          {(editFields["Type"] || []).includes("Recap") && (
            <div className="space-y-1 pt-1">
              <Button
                size="sm"
                className="gap-1.5 h-7 text-xs"
                disabled={!editFields["Video URL"] || hasChanges || publishMutation.isPending}
                onClick={() => publishMutation.mutate()}
                data-testid={`button-publish-recap-${edit.id}`}
              >
                <Globe className="w-3 h-3" />
                {publishMutation.isPending ? "Starting..." : "Send to Website"}
              </Button>
              {hasChanges && (
                <p className="text-[10px] text-muted-foreground/70">Save your changes first.</p>
              )}
              {!hasChanges && !editFields["Video URL"] && (
                <p className="text-[10px] text-red-400/80">Needs a Video URL.</p>
              )}
              {!hasChanges && editFields["Video URL"] && !editFields["Short Website Description"] && (
                <p className="text-[10px] text-muted-foreground/70">No Short Website Description yet; it will publish without a tagline.</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive text-xs gap-1"
              onClick={() => {
                if (confirm("Delete this edit?")) {
                  deleteMutation.mutate();
                }
              }}
              data-testid={`button-delete-edit-${edit.id}`}
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </Button>
            {showSave && (
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                size="sm"
                className="gap-1 text-xs"
                data-testid={`button-save-edit-${edit.id}`}
              >
                <Save className="w-3 h-3" />
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            )}
          </div>

          {linkedSermon && <SermonReference sermon={linkedSermon} />}
        </div>
      )}
    </Card>
  );
}

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
            <span className="truncate">
              {sermon.fields["Title"] || "Untitled sermon"}
            </span>
            <ChevronRight className="w-3 h-3 shrink-0 opacity-60 group-hover:opacity-100" />
          </Link>
        </>
      ) : date ? (
        <span className="text-xs text-muted-foreground/60">No linked sermon</span>
      ) : null}
    </div>
  );
}

export default function EditsPage() {
  const params = useParams() as { id?: string };
  const highlightId = params.id;
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
  const groupDates = useMemo(
    () => groups.map(([date]) => date).filter(Boolean),
    [groups]
  );
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
                  <EditCard
                    key={edit.id}
                    edit={edit}
                    initialExpanded={edit.id === highlightId}
                  />
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
