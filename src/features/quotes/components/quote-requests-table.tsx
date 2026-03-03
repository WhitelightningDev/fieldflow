import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Eye, Inbox, RefreshCw, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";

export type QuoteRequest = {
  id: string;
  company_id: string;
  widget_installation_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  trade: string | null;
  address: string | null;
  message: string | null;
  status: string;
  job_card_id?: string | null;
  profile_consent?: boolean;
  profile_consent_at?: string | null;
  requester_user_id?: string | null;
  portal_invited_at?: string | null;
  portal_invited_by?: string | null;
  created_at: string;
};

export const STATUS_OPTIONS = [
  { value: "new", label: "New", variant: "default" as const, dot: "bg-primary" },
  { value: "contacted", label: "Contacted", variant: "secondary" as const, dot: "bg-muted-foreground" },
  { value: "quoted", label: "Quoted", variant: "outline" as const, dot: "bg-[hsl(var(--chart-2))]" },
  { value: "callout-requested", label: "Call-out requested", variant: "secondary" as const, dot: "bg-[hsl(38_92%_50%)]" },
  { value: "callout-paid", label: "Call-out paid", variant: "default" as const, dot: "bg-[hsl(142_71%_45%)]" },
  { value: "callout-declined", label: "Call-out declined", variant: "destructive" as const, dot: "bg-destructive" },
  { value: "won", label: "Won", variant: "default" as const, dot: "bg-[hsl(142_71%_45%)]" },
  { value: "lost", label: "Lost", variant: "destructive" as const, dot: "bg-destructive" },
];

export function statusBadge(status: string) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];
  return (
    <Badge variant={opt.variant} className="gap-1.5 font-medium">
      <span className={cn("h-1.5 w-1.5 rounded-full", opt.dot)} />
      {opt.label}
    </Badge>
  );
}

const FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "quoted", label: "Quoted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

/* ─── Skeletons ─── */
function TableSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-7 rounded" />
        </div>
      ))}
    </div>
  );
}

/* ─── Error state ─── */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
        <Inbox className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="font-semibold text-foreground">Failed to load requests</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        Something went wrong while fetching quote requests. Please try again.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5 mr-2" /> Retry
      </Button>
    </div>
  );
}

/* ─── Empty state ─── */
function EmptyState({ filtered }: { filtered?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <Inbox className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-semibold text-foreground">
        {filtered ? "No matching requests" : "No quote requests yet"}
      </h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        {filtered
          ? "Try adjusting your search or filter."
          : "Add the widget to your website or share the QR code to start receiving requests."}
      </p>
    </div>
  );
}

type Props = {
  quotes: QuoteRequest[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
  onView: (q: QuoteRequest) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
};

export function QuoteRequestsTable({
  quotes,
  isLoading,
  isError,
  onRefresh,
  onView,
  onDelete,
  onStatusChange,
}: Props) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const filtered = React.useMemo(() => {
    if (!quotes) return [];
    let result = quotes;
    if (statusFilter !== "all") {
      result = result.filter((q) => q.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((row) =>
        [row.name, row.email, row.phone, row.trade, row.message, row.address, row.status]
          .map((v) => String(v ?? "").toLowerCase())
          .join(" ")
          .includes(q),
      );
    }
    return result;
  }, [quotes, search, statusFilter]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: quotes?.length ?? 0 };
    for (const q of quotes ?? []) {
      c[q.status] = (c[q.status] ?? 0) + 1;
    }
    return c;
  }, [quotes]);

  return (
    <Card className="shadow-sm border-border/40 rounded-xl overflow-hidden">
      <CardHeader className="pb-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Incoming Requests</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {quotes?.length ?? 0} total request{(quotes?.length ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search requests…"
                className="pl-8 h-8 w-48 text-sm"
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={onRefresh}
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mt-3">
          <TabsList className="h-8 bg-muted/30 p-0.5">
            {FILTER_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-xs h-7 px-3 data-[state=active]:shadow-sm"
              >
                {tab.label}
                {(counts[tab.value] ?? 0) > 0 && (
                  <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">
                    {counts[tab.value]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="pt-3 px-0">
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <ErrorState onRetry={onRefresh} />
        ) : filtered.length === 0 ? (
          <EmptyState filtered={search.trim() !== "" || statusFilter !== "all"} />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden px-4 space-y-2">
              {filtered.map((q) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-border/40 bg-card p-3 space-y-2 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => onView(q)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{q.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{q.email}</div>
                    </div>
                    {statusBadge(q.status)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="capitalize">{q.trade ?? "—"}</span>
                    <span>{format(new Date(q.created_at), "dd MMM yyyy")}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Contact</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Trade</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Date</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((q) => (
                    <TableRow
                      key={q.id}
                      className="group cursor-pointer"
                      onClick={() => onView(q)}
                    >
                      <TableCell>
                        <div className="font-medium text-sm">{q.name}</div>
                        {q.address && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{q.address}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{q.email}</div>
                        {q.phone && <div className="text-xs text-muted-foreground">{q.phone}</div>}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{q.trade ?? "—"}</span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={q.status}
                          onValueChange={(val) => onStatusChange(q.id, val)}
                        >
                          <SelectTrigger className="h-7 w-[140px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem
                                key={s.value}
                                value={s.value}
                                disabled={s.value === "callout-paid" || s.value === "callout-declined"}
                                className="text-xs"
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                                  {s.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(q.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onView(q)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(q.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
