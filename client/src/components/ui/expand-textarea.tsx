import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Textarea with an expand/collapse button instead of drag-to-resize.
// Collapsed: compact fixed height. Expanded: sized to fit the content
// exactly (no dead space), with a small floor so empty boxes look sane.
type Props = React.ComponentProps<typeof Textarea> & {
  collapsedHeight?: string; // tailwind h class for the collapsed state
  defaultExpanded?: boolean; // start fit-to-content (shows the whole value)
};

export function ExpandTextarea({
  className,
  collapsedHeight = "h-[60px]",
  defaultExpanded = false,
  ...props
}: Props) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  // Fit-to-content while expanded (re-measures as the user types).
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (expanded) {
      el.style.height = "auto";
      el.style.height = Math.max(el.scrollHeight + 2, 72) + "px";
    } else {
      el.style.height = "";
    }
  }, [expanded, props.value]);

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={ref}
        className={cn(
          "resize-none pr-7",
          !expanded && collapsedHeight,
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
