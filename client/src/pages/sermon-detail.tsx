import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ExternalLink,
  Save,
  Plus,
  Headphones,
  ScissorsLineDashed,
  Link2,
  Share2,
} from "lucide-react";
import { SiFacebook } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Sermon, Edit } from "@shared/schema";

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

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

function UrlField({
  label,
  value,
  fieldName,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  fieldName: string;
  onChange: (field: string, value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
          value={value || ""}
          onChange={(e) => onChange(fieldName, e.target.value)}
          className="text-xs h-8 bg-background"
          data-testid={`input-${fieldName.replace(/\s+/g, '-').toLowerCase()}`}
        />
        {value && (
          <a href={value} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="h-8 px-2 shrink-0">
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  fieldName,
  onChange,
}: {
  label: string;
  checked: boolean;
  fieldName: string;
  onChange: (field: string, value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(fieldName, !!v)}
        data-testid={`checkbox-${fieldName.replace(/\s+/g, '-').toLowerCase()}`}
      />
      <Label className="text-xs text-muted-foreground cursor-pointer">{label}</Label>
    </div>
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

  const { data: allEdits } = useQuery<Edit[]>({
    queryKey: ["/api/edits"],
  });

  // Edits linked to this sermon by matching broadcast date
  const linkedEdits = allEdits?.filter((e) => {
    if (!sermon) return false;
    return e.fields["Broadcast Date"] === sermon.fields["Service"];
  });

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
              {formatDate(fields["Service"])}
            </span>
            <Badge
              variant="secondary"
              className={`text-xs px-1.5 py-0 ${
                isSunday
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/15 text-amber-400 border-amber-500/20"
              }`}
            >
              {platform}
            </Badge>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Enter sermon title..."
            className="text-base font-semibold bg-transparent border-none outline-none w-full text-foreground placeholder:text-muted-foreground/50"
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
            {/* SUNDAY Step 1: Full Service */}
            <WorkflowStep
              title="Full Service"
              icon={<Upload className="w-3.5 h-3.5" />}
              isComplete={!!fields["Video URL"]}
              stepNumber={1}
            >
              <UrlField
                label="Video File"
                value={fields["Video URL"] || ""}
                fieldName="Video URL"
                onChange={handleFieldChange}
                placeholder="google drive link"
              />
            </WorkflowStep>

            {/* SUNDAY Step 2: Trimmed Media */}
            <WorkflowStep
              title="Trimmed Media"
              icon={<Scissors className="w-3.5 h-3.5" />}
              isComplete={!!(fields["Trimmed Video URL"] && fields["Audio URL"])}
              stepNumber={2}
            >
              <UrlField
                label="Video File"
                value={fields["Trimmed Video URL"] || ""}
                fieldName="Trimmed Video URL"
                onChange={handleFieldChange}
                placeholder="google drive link"
              />
              <UrlField
                label="Audio File"
                value={fields["Audio URL"] || ""}
                fieldName="Audio URL"
                onChange={handleFieldChange}
                placeholder="google drive link"
              />
            </WorkflowStep>

            {/* SUNDAY Step 3: Transcription */}
            <WorkflowStep
              title="Transcription"
              icon={<FileText className="w-3.5 h-3.5" />}
              isComplete={!!fields["Transcription URL"]}
              stepNumber={3}
            >
              <UrlField
                label="Transcription URL"
                value={fields["Transcription URL"] || ""}
                fieldName="Transcription URL"
                onChange={handleFieldChange}
                placeholder="google drive link"
              />
            </WorkflowStep>

            {/* SUNDAY Step 4: YouTube Hide Live Stream */}
            <WorkflowStep
              title="YouTube: Hide Live Stream"
              icon={<EyeOff className="w-3.5 h-3.5" />}
              isComplete={!!fields["YouTube Hidden"]}
              stepNumber={4}
            >
              <CheckboxField
                label="YouTube Hidden"
                checked={!!fields["YouTube Hidden"]}
                fieldName="YouTube Hidden"
                onChange={handleFieldChange}
              />
              <UrlField
                label="YouTube Hidden Live Stream Url"
                value={fields["YouTube Full Service URL"] || ""}
                fieldName="YouTube Full Service URL"
                onChange={handleFieldChange}
              />
            </WorkflowStep>

            {/* SUNDAY Step 5: YouTube New Video */}
            <WorkflowStep
              title="YouTube New Video"
              icon={<Youtube className="w-3.5 h-3.5" />}
              isComplete={!!fields["YouTube Trimmed URL"]}
              stepNumber={5}
            >
              <UrlField
                label="Trimmed Video"
                value={fields["YouTube Trimmed URL"] || ""}
                fieldName="YouTube Trimmed URL"
                onChange={handleFieldChange}
              />
            </WorkflowStep>

            {/* SUNDAY Step 6: Facebook */}
            <WorkflowStep
              title="Facebook"
              icon={<SiFacebook className="w-3.5 h-3.5" />}
              isComplete={!!fields["Facebook Done"]}
              stepNumber={6}
            >
              <CheckboxField
                label="Trimmed and Titled"
                checked={!!fields["Facebook Done"]}
                fieldName="Facebook Done"
                onChange={handleFieldChange}
              />
            </WorkflowStep>

            {/* SUNDAY Step 7: Website */}
            <WorkflowStep
              title="Website"
              icon={<Globe className="w-3.5 h-3.5" />}
              isComplete={!!fields["Website Done"]}
              stepNumber={7}
            >
              <CheckboxField
                label="Post. Graphic. Audio. YouTube Links"
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
              />
            </WorkflowStep>

            {/* WEDNESDAY Step 3: Transcription */}
            <WorkflowStep
              title="Transcription"
              icon={<FileText className="w-3.5 h-3.5" />}
              isComplete={!!fields["Transcription URL"]}
              stepNumber={3}
            >
              <UrlField
                label="Transcription URL"
                value={fields["Transcription URL"] || ""}
                fieldName="Transcription URL"
                onChange={handleFieldChange}
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
              />
            </WorkflowStep>

            {/* WEDNESDAY Step 6: Website */}
            <WorkflowStep
              title="Website"
              icon={<Globe className="w-3.5 h-3.5" />}
              isComplete={!!fields["Website Done"]}
              stepNumber={6}
            >
              <CheckboxField
                label="Post. Graphic. Audio. YouTube Links"
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
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Additional Info
      </h2>
      <div className="space-y-3 mb-4">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <UrlField
            label="Recap URL"
            value={fields["Recap URL"] || ""}
            fieldName="Recap URL"
            onChange={handleFieldChange}
          />
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

      {/* Edits Section */}
      <Separator className="my-3" />
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Edits
        </h2>
        <Link href="/edits">
          <Button variant="ghost" size="sm" className="text-xs gap-1 h-6 px-2" data-testid="button-view-all-edits">
            View All <ExternalLink className="w-3 h-3" />
          </Button>
        </Link>
      </div>
      {linkedEdits && linkedEdits.length > 0 ? (
        <div className="space-y-1.5">
          {linkedEdits.map((edit) => (
            <Card key={edit.id} className="p-2.5 flex items-center gap-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {edit.fields["Title"] || "Untitled Edit"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {edit.fields["Type"]?.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] leading-tight px-1.5 py-0">
                      {t}
                    </Badge>
                  ))}
                  {edit.fields["Status"] && (
                    <Badge
                      variant="secondary"
                      className={`text-[10px] leading-tight px-1.5 py-0 ${getEditStatusColor(edit.fields["Status"])}`}
                    >
                      {edit.fields["Status"]}
                    </Badge>
                  )}
                </div>
              </div>
              {edit.fields["Video URL"] && (
                <a href={edit.fields["Video URL"]} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-6 px-1.5">
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No edits linked to this service date.
        </p>
      )}
      </div>
      </div>{/* close grid */}

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

function getEditStatusColor(status: string): string {
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
