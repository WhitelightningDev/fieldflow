import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import PageHeader from "@/features/dashboard/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Copy, ExternalLink, Plus, RefreshCw, Inbox, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";

type QuoteRequest = {
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
  created_at: string;
};

type WidgetInstallation = {
  id: string;
  company_id: string;
  allowed_domains: string[];
  is_active: boolean;
  config: Record<string, unknown>;
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: "new", label: "New", variant: "default" as const },
  { value: "contacted", label: "Contacted", variant: "secondary" as const },
  { value: "quoted", label: "Quoted", variant: "outline" as const },
  { value: "won", label: "Won", variant: "default" as const },
  { value: "lost", label: "Lost", variant: "destructive" as const },
];

function statusBadge(status: string) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];
  return <Badge variant={opt.variant}>{opt.label}</Badge>;
}

export default function QuoteRequests() {
  const { data: dashData } = useDashboardData();
  const companyId = dashData.company?.id;
  const publicKey = (dashData.company as any)?.public_key as string | undefined;
  const queryClient = useQueryClient();

  // Fetch quote requests
  const { data: quotes, isLoading: quotesLoading } = useQuery({
    queryKey: ["quote_requests", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_requests")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as QuoteRequest[];
    },
  });

  // Fetch widget installations
  const { data: widgets, isLoading: widgetsLoading } = useQuery({
    queryKey: ["widget_installations", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("widget_installations")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WidgetInstallation[];
    },
  });

  // Update quote status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("quote_requests")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote_requests"] });
    },
  });

  // Delete quote
  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("quote_requests")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote_requests"] });
      toast({ title: "Quote request deleted" });
    },
  });

  // Create widget installation
  const [newDomains, setNewDomains] = React.useState("");
  const [widgetDialogOpen, setWidgetDialogOpen] = React.useState(false);

  const createWidget = useMutation({
    mutationFn: async (domains: string[]) => {
      const { error } = await supabase
        .from("widget_installations")
        .insert({
          company_id: companyId!,
          allowed_domains: domains,
          is_active: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widget_installations"] });
      setWidgetDialogOpen(false);
      setNewDomains("");
      toast({ title: "Widget installation created" });
    },
  });

  // Detail dialog
  const [selectedQuote, setSelectedQuote] = React.useState<QuoteRequest | null>(null);

  const embedSnippet = publicKey
    ? `<div id="fieldflow-quote"></div>
<script
  src="${window.location.origin}/widgets/quote.js"
  data-company="${publicKey}"
  data-mount="#fieldflow-quote">
</script>`
    : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quote Requests"
        subtitle="Manage incoming quote requests from your website widget"
      />

      {/* Widget Setup Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Embeddable Widget</CardTitle>
          <CardDescription>
            Add this snippet to any website to receive quote requests directly in your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {publicKey ? (
            <>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap break-all">
                  {embedSnippet}
                </pre>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    navigator.clipboard.writeText(embedSnippet);
                    toast({ title: "Copied to clipboard" });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your public key: <code className="bg-muted px-1 py-0.5 rounded">{publicKey}</code>
              </p>
            </>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}

          {/* Widget Installations */}
          <div className="flex items-center justify-between pt-2">
            <h4 className="text-sm font-medium">Allowed Domains</h4>
            <Dialog open={widgetDialogOpen} onOpenChange={setWidgetDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" /> Add Domain
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Widget Domain</DialogTitle>
                  <DialogDescription>
                    Enter the domains allowed to use the quote widget (comma-separated).
                    Leave empty to allow all domains.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  placeholder="example.com, app.example.com"
                  value={newDomains}
                  onChange={(e) => setNewDomains(e.target.value)}
                />
                <DialogFooter>
                  <Button
                    onClick={() => {
                      const domains = newDomains
                        .split(",")
                        .map((d) => d.trim())
                        .filter(Boolean);
                      createWidget.mutate(domains);
                    }}
                    disabled={createWidget.isPending}
                  >
                    {createWidget.isPending ? "Creating…" : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {widgetsLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : widgets && widgets.length > 0 ? (
            <div className="space-y-2">
              {widgets.map((w) => (
                <div key={w.id} className="flex items-center gap-2 text-sm">
                  <Badge variant={w.is_active ? "default" : "secondary"}>
                    {w.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <span className="text-muted-foreground">
                    {w.allowed_domains.length > 0
                      ? w.allowed_domains.join(", ")
                      : "All domains"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No widget installations yet. Quotes from any domain will be accepted.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quote Requests Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Incoming Requests</CardTitle>
            <CardDescription>
              {quotes?.length ?? 0} total request{(quotes?.length ?? 0) !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["quote_requests"] })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {quotesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : quotes && quotes.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.name}</TableCell>
                      <TableCell>{q.email}</TableCell>
                      <TableCell>{q.trade ?? "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={q.status}
                          onValueChange={(val) =>
                            updateStatus.mutate({ id: q.id, status: val })
                          }
                        >
                          <SelectTrigger className="h-8 w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(q.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSelectedQuote(q)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteQuote.mutate(q.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="font-medium">No quote requests yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add the widget to your website to start receiving quote requests.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote Detail Dialog */}
      <Dialog open={!!selectedQuote} onOpenChange={(open) => !open && setSelectedQuote(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quote Request</DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium">Name:</span> {selectedQuote.name}
              </div>
              <div>
                <span className="font-medium">Email:</span>{" "}
                <a href={`mailto:${selectedQuote.email}`} className="text-primary underline">
                  {selectedQuote.email}
                </a>
              </div>
              {selectedQuote.phone && (
                <div>
                  <span className="font-medium">Phone:</span> {selectedQuote.phone}
                </div>
              )}
              {selectedQuote.trade && (
                <div>
                  <span className="font-medium">Trade:</span> {selectedQuote.trade}
                </div>
              )}
              {selectedQuote.address && (
                <div>
                  <span className="font-medium">Address:</span> {selectedQuote.address}
                </div>
              )}
              {selectedQuote.message && (
                <div>
                  <span className="font-medium">Message:</span>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {selectedQuote.message}
                  </p>
                </div>
              )}
              <div>
                <span className="font-medium">Status:</span> {statusBadge(selectedQuote.status)}
              </div>
              <div>
                <span className="font-medium">Received:</span>{" "}
                {format(new Date(selectedQuote.created_at), "dd MMM yyyy HH:mm")}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
