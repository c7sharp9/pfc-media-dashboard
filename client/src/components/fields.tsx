import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// The one way to open an external URL anywhere in the app:
// a ghost icon button that opens in a new tab, with a tooltip saying what it opens.
// Uses window.open (not an <a>) so it can sit inside clickable cards and links.
export function OpenLinkButton({
  url,
  label = "Open link",
  className = "h-8 px-2",
}: {
  url: string;
  label?: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`shrink-0 ${className}`}
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            window.open(url, "_blank", "noopener,noreferrer");
          }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// Red outline for inputs that are required but still unpopulated.
// Field status colors (Jonathan's system, 2026-07-13):
//   light green = filled, grey = fine to stay empty, yellow = wanted but not
//   required, red = required and missing.
export function fieldRing(
  level: "required" | "wanted" | "optional",
  value: any
) {
  if (value) return " border-emerald-500/45 focus-visible:ring-emerald-500/20";
  if (level === "required") return " border-red-500/60 focus-visible:ring-red-500/40";
  if (level === "wanted") return " border-amber-500/55 focus-visible:ring-amber-500/25";
  return "";
}

export function requiredClass(required: boolean | undefined, value: any) {
  return fieldRing(required ? "required" : "optional", value);
}

export function UrlField({
  label,
  value,
  fieldName,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  fieldName: string;
  onChange: (field: string, value: string) => void;
  placeholder?: string;
  required?: boolean;
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
          className={`text-xs h-8 bg-background${requiredClass(required, value)}`}
          data-testid={`input-${fieldName.replace(/\s+/g, "-").toLowerCase()}`}
        />
        {value && <OpenLinkButton url={value} label={`Open ${label.toLowerCase()}`} />}
      </div>
    </div>
  );
}

export function CheckboxField({
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
        data-testid={`checkbox-${fieldName.replace(/\s+/g, "-").toLowerCase()}`}
      />
      <Label className="text-xs text-muted-foreground cursor-pointer">{label}</Label>
    </div>
  );
}
