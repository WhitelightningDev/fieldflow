import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  cardClassName?: string;
  contentClassName?: string;
};

export function EmptyStateCard({ icon, title, description, cardClassName, contentClassName }: Props) {
  return (
    <Card className={cardClassName}>
      <CardContent className={cn("py-12 text-center text-muted-foreground", contentClassName)}>
        {icon ? <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center opacity-40">{icon}</div> : null}
        <div className="font-medium text-foreground">{title}</div>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </CardContent>
    </Card>
  );
}
