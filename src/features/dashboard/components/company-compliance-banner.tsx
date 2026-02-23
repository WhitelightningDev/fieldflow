import { Button } from "@/components/ui/button";
import ComplianceStatusIcon from "@/features/compliance/components/compliance-status-icon";
import { getComplianceState } from "@/features/compliance/compliance-status";
import { cn } from "@/lib/utils";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import * as React from "react";

export default function CompanyComplianceBanner({
  company,
  onOpen,
  variant = "bar",
  className,
}: {
  company: any;
  onOpen: () => void;
  variant?: "bar" | "card";
  className?: string;
}) {
  const compliance = getComplianceState({
    status: company?.compliance_status,
    progress: company?.compliance_progress,
  });

  const isVerified = compliance.state === "verified";
  if (isVerified) return null;

  const tone =
    compliance.state === "unverified"
      ? "border-destructive/20 bg-destructive/5"
      : "border-amber-500/20 bg-amber-500/10";

  return (
    <div
      className={cn(
        variant === "card" ? "rounded-lg border px-4 py-2.5" : "border-b px-4 py-2.5",
        "flex items-start gap-3",
        tone,
        className,
      )}
    >
      <div className="mt-0.5 shrink-0">
        <ComplianceStatusIcon company={company} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">
          <span className="font-medium">Compliance documentation needed.</span>{" "}
          For legal and trust reasons, it’s best to show you’re compliant for your industry before issuing invoices and certificates.
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1.5">
          {compliance.state === "unverified" ? <AlertTriangle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {compliance.state === "unverified"
            ? "Upload your required documents to avoid compliance risk."
            : `You're ${compliance.progress}% complete — finish uploads to show a compliant badge.`}
        </p>
      </div>
      <Button size="sm" className="gradient-bg hover:opacity-90 shadow-glow shrink-0" onClick={onOpen}>
        Open wizard
      </Button>
    </div>
  );
}
