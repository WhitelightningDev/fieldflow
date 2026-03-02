import type { Tables } from "@/integrations/supabase/types";
import type { DashboardData } from "@/features/dashboard/store/dashboard-data-store";

type JobCard = Tables<"job_cards">;
type Invoice = Tables<"invoices">;

function safeJsonStringify(value: unknown, maxLen = 6000) {
  try {
    const s = JSON.stringify(value, null, 2);
    return s.length > maxLen ? `${s.slice(0, maxLen)}\n…(truncated)` : s;
  } catch {
    return "";
  }
}

export function buildAiChatContext(data: DashboardData): string {
  const company = data.company as any;

  const recentJobs = ((data.jobCards ?? []) as JobCard[])
    .slice(0, 10)
    .map((j) => ({
      id: j.id,
      title: j.title,
      status: j.status,
      scheduled_at: j.scheduled_at ?? null,
      technician_id: j.technician_id ?? null,
      site_id: j.site_id ?? null,
      customer_id: j.customer_id ?? null,
    }));

  const recentInvoices = ((data.invoices ?? []) as Invoice[])
    .slice(0, 10)
    .map((i) => ({
      id: i.id,
      status: i.status ?? null,
      total_cents: i.total_cents ?? null,
      amount_paid_cents: i.amount_paid_cents ?? null,
      sent_at: i.sent_at ?? null,
      customer_id: i.customer_id ?? null,
    }));

  return safeJsonStringify({
    company: {
      id: company?.id ?? null,
      name: company?.name ?? null,
      industry: company?.industry ?? null,
      subscription_tier: company?.subscription_tier ?? null,
      included_techs: company?.included_techs ?? null,
      per_tech_price_cents: company?.per_tech_price_cents ?? null,
      subscription_status: company?.subscription_status ?? null,
      trial_ends_at: company?.trial_ends_at ?? null,
    },
    counts: {
      technicians_total: (data.technicians ?? []).length,
      technicians_active: (data.technicians ?? []).filter((t: any) => Boolean(t.active)).length,
      jobs_total: (data.jobCards ?? []).length,
      invoices_total: (data.invoices ?? []).length,
      customers_total: (data.customers ?? []).length,
      sites_total: (data.sites ?? []).length,
      inventory_items_total: (data.inventoryItems ?? []).length,
    },
    recentJobs,
    recentInvoices,
  });
}

