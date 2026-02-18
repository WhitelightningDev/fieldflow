import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import * as React from "react";

type Props = {
  onOpen: () => void;
};

export default function ProfileCompletionBanner({ onOpen }: Props) {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) return null;

  return (
    <div className="border-b bg-primary/5 px-4 py-2.5 flex items-center gap-3">
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <p className="flex-1 text-sm text-foreground">
        <span className="font-medium">Your company profile is incomplete.</span>{" "}
        Add your logo, address and contact details to customise your dashboard and invoices.
      </p>
      <Button size="sm" variant="default" className="gradient-bg hover:opacity-90 shadow-glow shrink-0" onClick={onOpen}>
        Complete profile
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0 h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
