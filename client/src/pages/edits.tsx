import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Save,
  Trash2,
  ArrowLeft,
  Check,
  Upload,
  Scissors,
  Headphones,
  FileText,
  Youtube,
  Globe,
  Loader2,
  AlertCircle,
  Church,
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Edit, Sermon } from "@shared/schema";

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusColor(status?: string): string {
  switch (status) {
    case "In Progress":
      return "bg-blue-500/15 text-blue-400 border-blue-500/20";
    case "Ready for Review":
      return "bg-yellow-500/15 text-yellow-400 border-yellow-500/20";
    case "Revision Needed":
      return "bg-orange-500/15 text-orange-400 border-orange-500/20";
    case "Completed":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    default:
      return "";
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case "Recap":
      return "bg-purple-500/15 text-purple-400 border-purple-500/20";
    case "Clip":
      return "bg-cyan-500/15 text-cyan-400 border-cyan-500/20";
    case "Sizzle":
      return "bg-pink-500/15 text-pink-400 border-pink-500/20";
    default:
      return "";
  }
}

// Read-only card showing a sermon URL field with icon
function SermonReferenceCard({
  icon,
  label,
  url,
}: {
  icon: React.ReactNode;
  label: string;
  url?: string;
}) {
  return (
    <Card className="p-3 border border-border bg-muted/30">
      <div className="flex items-start gap-2.5">
        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-foreground">{label}</span>
          {url ? (
            <div className="flex items-center gap-1.5 mt-1">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 truncate underline underline-offset-2"
              >
                {url.length > 50 ? url.slice(0, 50) + "..." : url}
              </a>
              <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </a>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Not set</p>
          )}
        </div>
      </div>
    </Card>
  );
}

// Sermon reference section shown in expanded edit cards
function SermonReference({
  sermonId,
  broadcastDate,
}: {
  sermonId?: string;
  broadcastDate?: string;
}) {
  // Direct fetch if we have a sermon ID
  const { data: sermonById } = useQuery<Sermon>({
    queryKey: ["/api/sermons", sermonId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sermons/${sermonId}`);
      return res.json();
    },
    enabled: !!sermonId,
  });

  // Fallback: search by broadcast date if no sermon ID
  const { data: searchResult } = useQuery<{ records: Sermon[] }>({
    queryKey: ["/api/sermons/search", broadcastDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sermons/search?date=${broadcastDate}`);
      return res.json();
    },
    enabled: !sermonId && !!broadcastDate,
  });

  const sermon = sermonById || searchResult?.records?.[0];
  if (!sermon) return null;

  const platform = sermon.fields["Platform"];
  const isSunday = platform === "Sunday";

  const sundayCards = [
    { icon: <Upload className="w-3 h-3" />, label: "Full Service", url: sermon.fields["Video URL"] },
    { icon: <Scissors className="w-3 h-3" />, label: "Trimmed Media", url: sermon.fields["Trimmed Video URL"] },
    { icon: <Headphones className="w-3 h-3" />, label: "Audio", url: sermon.fields["Audio URL"] },
    { icon: <FileText className="w-3 h-3" />, label: "Transcript", url: sermon.fields["Transcription URL"] },
    { icon: <Youtube className="w-3 h-3" />, label: "YouTube New Video", url: sermon.fields["YouTube Trimmed URL"] },
    { icon: <Youtube className="w-3 h-3" />, label: "YouTube Full Service", url: sermon.fields["YouTube Full Service URL"] },
    { icon: <Globe className="w-3 h-3" />, label: "Website URL", url: sermon.fields["Sermon URL"] },
  ];

  const wednesdayCards = [
    { icon: <Upload className="w-3 h-3" />, label: "Clean Edit", url: sermon.fields["Video URL"] },
    { icon: <Headphones className="w-3 h-3" />, label: "Audio", url: sermon.fields["Audio URL"] },
    { icon: <FileText className="w-3 h-3" />, label: "Transcript", url: sermon.fields["Transcription URL"] },
    { icon: <Youtube className="w-3 h-3" />, label: "YouTube Link", url: sermon.fields["Wednesday YouTube Link"] },
    { icon: <Globe className="w-3 h-3" />, label: "Website URL", url: sermon.fields["Sermon URL"] },
  ];

  const cards = isSunday ? sundayCards : wednesdayCards;

  return (
    <div className="space-y-2">
      <Separator />
      <div className="flex items-center gap-2 pt-1">
        <Church className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Sermon Reference
        </span>
        {sermon.fields["Title"] && (
          <span className="text-xs text-muted-foreground">
            — {sermon.fields["Title"]}
          </span>
        )}
        <Badge
          variant="secondary"
          className={`text-[10px] leading-tight px-1.5 py-0 ${
            isSunday
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
              : "bg-amber-500/15 text-amber-400 border-amber-500/20"
          }`}
        >
          {platform}
        </Badge>
        <Link href={`/sermon/${sermon.id}`}>
          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground ml-auto">
            <ExternalLink className="w-3 h-3" />
            Open
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

function EditCard({ edit, onRefresh }: { edit: Edit; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editFields, setEditFields] = useState(edit.fields);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/edits/${edit.id}`, fields);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/edits"] });
      setHasChanges(false);
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
    if (Object.keys(changed).length > 0) {
      updateMutation.mutate(changed);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid={`edit-card-${edit.id}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {formatDate(editFields["Broadcast Date"])}
            </span>
            {editFields["Type"]?.map((t) => (
              <Badge key={t} variant="secondary" className={`text-xs ${getTypeColor(t)}`}>
                {t}
              </Badge>
            ))}
            {editFields["Status"] && (
              <Badge variant="secondary" className={`text-xs ${getStatusColor(editFields["Status"])}`}>
                {editFields["Status"]}
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-foreground truncate mt-0.5">
            {editFields["Title"] || "Untitled Edit"}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {editFields["Editor Name"] && <span>{editFields["Editor Name"]}</span>}
            {editFields["Date Completed"] && (
              <span>Completed: {formatDate(editFields["Date Completed"])}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editFields["Video URL"] && (
            <a
              href={editFields["Video URL"]}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
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
                className="text-xs h-8 bg-background"
                data-testid={`input-edit-title-${edit.id}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Editor Name</Label>
              <Input
                value={editFields["Editor Name"] || ""}
                onChange={(e) => handleFieldChange("Editor Name", e.target.value)}
                className="text-xs h-8 bg-background"
                data-testid={`input-editor-name-${edit.id}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Broadcast Date</Label>
              <Input
                type="date"
                value={editFields["Broadcast Date"] || ""}
                onChange={(e) => handleFieldChange("Broadcast Date", e.target.value)}
                className="text-xs h-8 bg-background"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={editFields["Status"] || ""}
                onValueChange={(v) => handleFieldChange("Status", v)}
              >
                <SelectTrigger className="text-xs h-8 bg-background">
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
              <Input
                type="url"
                value={editFields["Video URL"] || ""}
                onChange={(e) => handleFieldChange("Video URL", e.target.value)}
                className="text-xs h-8 bg-background"
              />
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

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">JA Notes</Label>
            <Textarea
              value={editFields["JA Notes"] || ""}
              onChange={(e) => handleFieldChange("JA Notes", e.target.value)}
              className="text-xs min-h-[60px] bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Editor Notes</Label>
            <Textarea
              value={editFields["Editors Notes"] || ""}
              onChange={(e) => handleFieldChange("Editors Notes", e.target.value)}
              className="text-xs min-h-[60px] bg-background"
            />
          </div>

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
            {hasChanges && (
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

          {edit.fields["Broadcast Date"] && (
            <SermonReference
              broadcastDate={edit.fields["Broadcast Date"]}
            />
          )}
        </div>
      )}
    </Card>
  );
}

function NewEditDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState<string>("");
  const [broadcastDate, setBroadcastDate] = useState("");
  const [linkedSermon, setLinkedSermon] = useState<Sermon | null>(null);
  const [title, setTitle] = useState("");
  const [editorName, setEditorName] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [status, setStatus] = useState("In Progress");
  const [videoUrl, setVideoUrl] = useState("");
  const { toast } = useToast();

  // Search for sermon when date + platform are set
  const {
    data: searchResult,
    isFetching: isSearching,
  } = useQuery<{ records: Sermon[] }>({
    queryKey: ["/api/sermons/search", broadcastDate, platform],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/sermons/search?date=${broadcastDate}&platform=${platform}`
      );
      return res.json();
    },
    enabled: step === 2 && !!broadcastDate && !!platform && platform !== "Other",
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/edits", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/edits"] });
      resetAndClose();
      toast({ title: "Created", description: "New edit added." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetAndClose = () => {
    setOpen(false);
    setStep(1);
    setPlatform("");
    setBroadcastDate("");
    setLinkedSermon(null);
    setTitle("");
    setEditorName("");
    setSelectedTypes([]);
    setStatus("In Progress");
    setVideoUrl("");
  };

  const handlePlatformSelect = (p: string) => {
    setPlatform(p);
    setStep(2);
  };

  const handleDateContinue = () => {
    const foundSermon = searchResult?.records?.[0] || null;
    setLinkedSermon(foundSermon);
    if (foundSermon?.fields["Title"]) {
      setTitle(foundSermon.fields["Title"]);
    }
    setStep(3);
  };

  const handleCreate = () => {
    const payload: Record<string, any> = {
      Title: title,
      "Broadcast Date": broadcastDate,
      "Editor Name": editorName || undefined,
      Status: status,
      Type: selectedTypes.length > 0 ? selectedTypes : undefined,
      "Video URL": videoUrl || undefined,
    };
    // Remove undefined values
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    createMutation.mutate(payload);
  };

  const foundSermon = searchResult?.records?.[0];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetAndClose();
        else setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1" data-testid="button-new-edit">
          <Plus className="w-4 h-4" />
          New Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            New Edit
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1.5 pb-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors ${
                s === step
                  ? "bg-primary"
                  : s < step
                    ? "bg-emerald-500"
                    : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Platform */}
        {step === 1 && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground text-center">
              Select the service platform
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handlePlatformSelect("Sunday")}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Church className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-xs font-medium text-foreground">Sunday</span>
              </button>
              <button
                onClick={() => handlePlatformSelect("Wednesday")}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Church className="w-3 h-3 text-amber-400" />
                </div>
                <span className="text-xs font-medium text-foreground">Wednesday</span>
              </button>
              <button
                onClick={() => handlePlatformSelect("Other")}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:border-muted-foreground/50 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Plus className="w-3 h-3 text-muted-foreground" />
                </div>
                <span className="text-xs font-medium text-foreground">Other</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Broadcast Date + Sermon Lookup */}
        {step === 2 && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-center gap-2">
              <Badge
                variant="secondary"
                className={`text-xs ${
                  platform === "Sunday"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                    : platform === "Wednesday"
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                      : ""
                }`}
              >
                {platform}
              </Badge>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Broadcast Date</Label>
              <Input
                type="date"
                value={broadcastDate}
                onChange={(e) => setBroadcastDate(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Sermon search results */}
            {broadcastDate && platform !== "Other" && (
              <div className="rounded-lg border border-border p-3">
                {isSearching ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Searching for sermon...
                  </div>
                ) : foundSermon ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {foundSermon.fields["Title"] || "Untitled Sermon"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(foundSermon.fields["Service"])} — {foundSermon.fields["Platform"]}
                      </p>
                    </div>
                  </div>
                ) : searchResult ? (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      No sermon found for this date. The edit will be created without a sermon link.
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            <Button
              onClick={handleDateContinue}
              disabled={!broadcastDate}
              className="w-full"
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 3: Details + Create */}
        {step === 3 && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-center gap-2">
              <Badge
                variant="secondary"
                className={`text-xs ${
                  platform === "Sunday"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                    : platform === "Wednesday"
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                      : ""
                }`}
              >
                {platform}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(broadcastDate)}
              </span>
              {linkedSermon && (
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={linkedSermon?.fields["Title"] || "Edit title"}
                className="text-sm"
                data-testid="input-new-edit-title"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Editor Name</Label>
              <Input
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <div className="flex gap-4">
                {["Recap", "Clip", "Sizzle"].map((t) => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={selectedTypes.includes(t)}
                      onCheckedChange={(checked) => {
                        setSelectedTypes((prev) =>
                          checked ? [...prev, t] : prev.filter((x) => x !== t)
                        );
                      }}
                    />
                    <span className="text-xs">{t}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
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
              <Label className="text-xs">Video URL</Label>
              <Input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="w-full"
              data-testid="button-create-edit"
            >
              {createMutation.isPending ? "Creating..." : "Create Edit"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function EditsPage() {
  const [filter, setFilter] = useState("all");

  const { data: edits, isLoading, error } = useQuery<Edit[]>({
    queryKey: ["/api/edits"],
  });

  const filtered = edits?.filter((e) => {
    if (filter === "all") return true;
    return e.fields["Status"] === filter;
  });

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

      <Tabs value={filter} onValueChange={setFilter} className="mb-3">
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

      <div className="space-y-1.5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))
        ) : error ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Failed to load edits. Check the connection to Airtable.
          </div>
        ) : filtered && filtered.length > 0 ? (
          filtered.map((edit) => (
            <EditCard key={edit.id} edit={edit} onRefresh={() => {}} />
          ))
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No edits found.
          </div>
        )}
      </div>
    </div>
  );
}
