import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Plus,
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { OpenLinkButton } from "@/components/fields";
import { PlatformBadge } from "@/components/badges";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatShortDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Sermon } from "@shared/schema";

// When `sermon` is provided (from the sermon detail page), the dialog skips the
// platform/date steps and creates the edit already linked to that sermon.
export default function NewEditDialog({ sermon }: { sermon?: Sermon }) {
  const isPrelinked = !!sermon;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(isPrelinked ? 3 : 1);
  const [platform, setPlatform] = useState<string>(sermon?.fields["Platform"] || "");
  const [broadcastDate, setBroadcastDate] = useState(sermon?.fields["Service"] || "");
  const [linkedSermon, setLinkedSermon] = useState<Sermon | null>(sermon || null);
  const [title, setTitle] = useState(sermon?.fields["Title"] || "");
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
    enabled: !isPrelinked && step === 2 && !!broadcastDate && !!platform && platform !== "Other",
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
    setStep(isPrelinked ? 3 : 1);
    setPlatform(sermon?.fields["Platform"] || "");
    setBroadcastDate(sermon?.fields["Service"] || "");
    setLinkedSermon(sermon || null);
    setTitle(sermon?.fields["Title"] || "");
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
      "Sermon Link": linkedSermon ? [linkedSermon.id] : undefined,
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
        <Button size="sm" className="gap-1 h-7 text-xs" data-testid="button-new-edit">
          <Plus className="w-3.5 h-3.5" />
          New Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step > 1 && !isPrelinked && (
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

        {/* Step indicator (hidden when pre-linked from a sermon) */}
        {!isPrelinked && (
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
        )}

        {/* Step 1: Platform */}
        {step === 1 && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground text-center">
              Select the service platform
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handlePlatformSelect("Sunday")}
                className="flex items-center justify-center px-3 py-2.5 rounded-lg border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors cursor-pointer"
              >
                <span className="text-xs font-medium text-emerald-400">Sunday</span>
              </button>
              <button
                onClick={() => handlePlatformSelect("Wednesday")}
                className="flex items-center justify-center px-3 py-2.5 rounded-lg border border-border hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors cursor-pointer"
              >
                <span className="text-xs font-medium text-amber-400">Wednesday</span>
              </button>
              <button
                onClick={() => handlePlatformSelect("Other")}
                className="flex items-center justify-center px-3 py-2.5 rounded-lg border border-border hover:border-muted-foreground/50 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <span className="text-xs font-medium text-muted-foreground">Other</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Broadcast Date + Sermon Lookup */}
        {step === 2 && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-center gap-2">
              <PlatformBadge platform={platform} />
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
                        {formatShortDate(foundSermon.fields["Service"])} — {foundSermon.fields["Platform"]}
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
              <PlatformBadge platform={platform} />
              <span className="text-xs text-muted-foreground">
                {formatShortDate(broadcastDate)}
              </span>
              {linkedSermon && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                  Linked to sermon
                </span>
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
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="text-sm"
                />
                {videoUrl && (
                  <OpenLinkButton url={videoUrl} label="Open video" className="h-9 px-2" />
                )}
              </div>
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
