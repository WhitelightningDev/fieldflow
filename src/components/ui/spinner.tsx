import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  size?: "sm" | "md" | "lg";
};

const sizeClasses: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-4 w-4 border-b-2",
  md: "h-8 w-8 border-b-2",
  lg: "h-12 w-12 border-b-2",
};

export function Spinner({ size = "md", className, ...props }: Props) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-primary",
        sizeClasses[size],
        className,
      )}
      aria-label="Loading"
      role="status"
      {...props}
    />
  );
}

