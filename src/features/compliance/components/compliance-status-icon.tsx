import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getComplianceState } from "@/features/compliance/compliance-status";

export default function ComplianceStatusIcon({
  company,
  className,
}: {
  company: any;
  className?: string;
}) {
  const { icon: Icon, label, className: tone } = getComplianceState({
    status: company?.compliance_status,
    progress: company?.compliance_progress,
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center", className)} aria-label={label}>
          <Icon className={cn("h-4 w-4", tone)} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" align="center">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

