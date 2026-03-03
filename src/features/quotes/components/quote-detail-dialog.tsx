import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { statusBadge, type QuoteRequest } from "./quote-requests-table";
import { format } from "date-fns";
import { Calendar, Mail, MapPin, MessageSquare, Phone, User, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  quote: QuoteRequest | null;
  onClose: () => void;
  onNavigateToJobs: () => void;
  onRequestCallout: (id: string) => void;
  onSendPortalLogin: (id: string) => void;
  isRequestingCallout: boolean;
  isSendingPortalLogin: boolean;
};

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/50">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm text-foreground mt-0.5">{children}</div>
      </div>
    </div>
  );
}

export function QuoteDetailDialog({
  quote,
  onClose,
  onNavigateToJobs,
  onRequestCallout,
  onSendPortalLogin,
  isRequestingCallout,
  isSendingPortalLogin,
}: Props) {
  const { data: callout, isLoading: calloutLoading } = useQuery({
    queryKey: ["quote_request_callout", quote?.id],
    enabled: !!quote?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_request_callouts" as any)
        .select("*")
        .eq("quote_request_id", quote!.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    retry: false,
  });

  const calloutStatus = String(callout?.status ?? "");

  return (
    <Dialog open={!!quote} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Quote Request</span>
            {quote && statusBadge(quote.status)}
          </DialogTitle>
        </DialogHeader>

        {quote && (
          <div className="divide-y divide-border/40">
            <DetailRow icon={User} label="Name">
              {quote.name}
            </DetailRow>

            <DetailRow icon={Mail} label="Email">
              <a href={`mailto:${quote.email}`} className="text-primary hover:underline">
                {quote.email}
              </a>
            </DetailRow>

            {quote.phone && (
              <DetailRow icon={Phone} label="Phone">
                {quote.phone}
              </DetailRow>
            )}

            {quote.trade && (
              <DetailRow icon={Wrench} label="Trade">
                <span className="capitalize">{quote.trade}</span>
              </DetailRow>
            )}

            {quote.address && (
              <DetailRow icon={MapPin} label="Address">
                {quote.address}
              </DetailRow>
            )}

            {quote.message && (
              <DetailRow icon={MessageSquare} label="Message">
                <p className="whitespace-pre-wrap text-muted-foreground">{quote.message}</p>
              </DetailRow>
            )}

            <DetailRow icon={Calendar} label="Received">
              {format(new Date(quote.created_at), "dd MMM yyyy HH:mm")}
            </DetailRow>

            {/* Call-out section */}
            {calloutLoading ? (
              <div className="py-3">
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : callout ? (
              <div className="py-3">
                <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1">
                  <div className="text-xs font-semibold">Call-out Fee</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={calloutStatus === "paid" ? "default" : calloutStatus === "declined" ? "destructive" : "secondary"} className="text-[10px]">
                      {calloutStatus || "—"}
                    </Badge>
                    {typeof callout.total_cents === "number" && (
                      <span>R{(callout.total_cents / 100).toFixed(2)} (incl VAT)</span>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {quote && (
          <DialogFooter className="flex-wrap gap-2 pt-2">
            {quote.job_card_id && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onNavigateToJobs();
                }}
              >
                View job
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!quote.profile_consent || isRequestingCallout || calloutStatus === "paid"}
              onClick={() => onRequestCallout(quote.id)}
            >
              {isRequestingCallout
                ? "Requesting…"
                : calloutStatus === "requested"
                  ? "Re-send call-out"
                  : "Request call-out fee"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!quote.profile_consent || isSendingPortalLogin}
              onClick={() => onSendPortalLogin(quote.id)}
            >
              {isSendingPortalLogin ? "Sending…" : "Send portal login"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
