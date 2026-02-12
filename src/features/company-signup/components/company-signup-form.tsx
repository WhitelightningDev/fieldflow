import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TRADES, type TradeId } from "@/features/company-signup/content/trades";
import { cn } from "@/lib/utils";
import type { UseFormReturn } from "react-hook-form";
import type { CompanySignupValues } from "@/features/company-signup/hooks/use-company-signup-form";

type Props = {
  form: UseFormReturn<CompanySignupValues>;
  onSubmit: () => void;
  onIndustrySelect?: (tradeId: TradeId) => void;
  className?: string;
};

export default function CompanySignupForm({ form, onSubmit, onIndustrySelect, className }: Props) {
  const selectedIndustry = form.watch("industry");
  const selectedTrade = TRADES.find((t) => t.id === selectedIndustry);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-1">
        <div className="text-2xl font-bold">Create your company account</div>
        <div className="text-sm text-muted-foreground">Start a 14-day trial. No credit card required.</div>
      </div>

      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-5">
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Apex Electrical" autoComplete="organization" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-1 gap-2">
                      {TRADES.map((trade) => {
                        const isSelected = trade.id === field.value;
                        return (
                          <button
                            key={trade.id}
                            type="button"
                            onClick={() => {
                              field.onChange(trade.id);
                              onIndustrySelect?.(trade.id);
                            }}
                            className={cn(
                              "flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-left text-sm hover:bg-secondary/50 transition-colors",
                              isSelected && "ring-2 ring-primary/50 border-primary/40",
                            )}
                          >
                            <trade.icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                            <span className="truncate">{trade.shortName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="teamSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team size</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">Just me</SelectItem>
                      <SelectItem value="2-5">2–5 techs</SelectItem>
                      <SelectItem value="6-15">6–15 techs</SelectItem>
                      <SelectItem value="16-30">16–30 techs</SelectItem>
                      <SelectItem value="31+">31+ techs</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Sam Taylor" autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work email</FormLabel>
                  <FormControl>
                    <Input placeholder="you@company.com" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{selectedTrade?.shortName ?? selectedIndustry}</span>
            </div>
            <Button
              type="submit"
              className="gradient-bg hover:opacity-90 shadow-glow"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Creating..." : "Create company"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
