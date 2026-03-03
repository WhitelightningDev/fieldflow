import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { GripVertical, Plus, X, LayoutDashboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ─── Widget definition ─── */
export type WidgetId = string;

export interface WidgetDefinition {
  id: WidgetId;
  label: string;
  icon: LucideIcon;
  description: string;
  defaultSize: "sm" | "md" | "lg" | "full";
  render: (props: any) => React.ReactNode;
}

/* ─── Persistence ─── */
const STORAGE_KEY = "ff-widget-layout";

function loadLayout(defaults: WidgetId[]): WidgetId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return defaults;
}

function saveLayout(ids: WidgetId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {}
}

/* ─── Size to grid span ─── */
const sizeToSpan: Record<string, string> = {
  sm: "col-span-1",
  md: "col-span-1 lg:col-span-2",
  lg: "col-span-1 lg:col-span-2 xl:col-span-3",
  full: "col-span-full",
};

/* ─── Draggable Widget Grid ─── */
export function WidgetGrid({
  registry,
  defaultLayout,
  widgetProps,
}: {
  registry: WidgetDefinition[];
  defaultLayout: WidgetId[];
  widgetProps: any;
}) {
  const [activeIds, setActiveIds] = React.useState<WidgetId[]>(() => loadLayout(defaultLayout));
  const [editing, setEditing] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const dragItem = React.useRef<number | null>(null);
  const dragOverItem = React.useRef<number | null>(null);

  const registryMap = React.useMemo(() => new Map(registry.map((w) => [w.id, w])), [registry]);

  const activeWidgets = React.useMemo(
    () => activeIds.map((id) => registryMap.get(id)).filter(Boolean) as WidgetDefinition[],
    [activeIds, registryMap],
  );

  const inactiveWidgets = React.useMemo(
    () => registry.filter((w) => !activeIds.includes(w.id)),
    [registry, activeIds],
  );

  const persist = React.useCallback((ids: WidgetId[]) => {
    setActiveIds(ids);
    saveLayout(ids);
  }, []);

  const handleRemove = React.useCallback(
    (id: WidgetId) => {
      persist(activeIds.filter((wid) => wid !== id));
    },
    [activeIds, persist],
  );

  const handleAdd = React.useCallback(
    (id: WidgetId) => {
      if (!activeIds.includes(id)) {
        persist([...activeIds, id]);
      }
    },
    [activeIds, persist],
  );

  const handleDragStart = (idx: number) => {
    dragItem.current = idx;
  };

  const handleDragEnter = (idx: number) => {
    dragOverItem.current = idx;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const items = [...activeIds];
    const [dragged] = items.splice(dragItem.current, 1);
    items.splice(dragOverItem.current, 0, dragged);
    persist(items);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleReset = () => {
    persist(defaultLayout);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={editing ? "default" : "outline"}
          size="sm"
          onClick={() => setEditing(!editing)}
          className="gap-1.5"
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          {editing ? "Done" : "Customize"}
        </Button>
        {editing && (
          <>
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add widget
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs text-muted-foreground">
              Reset
            </Button>
          </>
        )}
      </div>

      {/* Widget grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {activeWidgets.map((widget, idx) => (
          <div
            key={widget.id}
            className={cn(
              "relative group transition-all duration-200",
              sizeToSpan[widget.defaultSize],
              editing && "ring-2 ring-dashed ring-border/50 rounded-2xl",
            )}
            draggable={editing}
            onDragStart={() => handleDragStart(idx)}
            onDragEnter={() => handleDragEnter(idx)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
          >
            {editing && (
              <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleRemove(widget.id)}
                  className="h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/90 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {editing && (
              <div className="absolute top-1/2 -left-1 -translate-y-1/2 z-10 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            {widget.render(widgetProps)}
          </div>
        ))}
      </div>

      {activeWidgets.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-border/50 bg-muted/20 py-12 text-center">
          <LayoutDashboard className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No widgets displayed</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setPickerOpen(true)}>
            Add widgets
          </Button>
        </div>
      )}

      {/* Widget picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Widgets</DialogTitle>
            <DialogDescription>Choose widgets to add to your dashboard overview.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {inactiveWidgets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">All widgets are already active.</p>
            ) : (
              inactiveWidgets.map((w) => {
                const Icon = w.icon;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      handleAdd(w.id);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card p-3 text-left transition-all hover:bg-accent/30 hover:shadow-sm"
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{w.label}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{w.description}</div>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
