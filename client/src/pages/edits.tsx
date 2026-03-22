import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Edit } from "@shared/schema";

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
        </div>
      )}
    </Card>
  );
}

function NewEditDialog() {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Record<string, any>>({});
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/edits", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/edits"] });
      setOpen(false);
      setFields({});
      toast({ title: "Created", description: "New edit added." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    createMutation.mutate(fields);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1" data-testid="button-new-edit">
          <Plus className="w-4 h-4" />
          New Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Edit</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input
              value={fields["Title"] || ""}
              onChange={(e) => setFields({ ...fields, Title: e.target.value })}
              className="text-sm"
              data-testid="input-new-edit-title"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Broadcast Date</Label>
            <Input
              type="date"
              value={fields["Broadcast Date"] || ""}
              onChange={(e) => setFields({ ...fields, "Broadcast Date": e.target.value })}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Editor Name</Label>
            <Input
              value={fields["Editor Name"] || ""}
              onChange={(e) => setFields({ ...fields, "Editor Name": e.target.value })}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select
              value={fields["Status"] || ""}
              onValueChange={(v) => setFields({ ...fields, Status: v })}
            >
              <SelectTrigger className="text-sm">
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
            <Label className="text-xs">Type</Label>
            <div className="flex gap-4">
              {["Recap", "Clip", "Sizzle"].map((t) => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={(fields["Type"] || []).includes(t)}
                    onCheckedChange={(checked) => {
                      const current = fields["Type"] || [];
                      const next = checked
                        ? [...current, t]
                        : current.filter((x: string) => x !== t);
                      setFields({ ...fields, Type: next });
                    }}
                  />
                  <span className="text-xs">{t}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Video URL</Label>
            <Input
              type="url"
              value={fields["Video URL"] || ""}
              onChange={(e) => setFields({ ...fields, "Video URL": e.target.value })}
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
