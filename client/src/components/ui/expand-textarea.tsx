import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Textarea with an expand/collapse button instead of drag-to-resize.
// Collapsed: compact fixed height (clipped content hints via the button).
// Expanded: tall enough to read long descriptions without scrolling.
type Props = React.ComponentProps<typeof Textarea> & {
  collapsedHeight?: string; // tailwind h class for the collapsed state
};

export function ExpandTextarea({
  className,
  collapsedHeight = "h-[60px]",
  ...props
}: Props) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div className="relative">
      <Textarea
        {...props}
        className={cn(
          "resize-none pr-7 transition-[height]",
          expanded ? "h-56" : collapsedHeight,
          className
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? "Collapse" : "Expand"}
        className="absolute right-1 top-1 p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
      >
        {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
      </button>
    </div>
  );
}
