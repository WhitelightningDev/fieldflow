import * as React from "react";
import { cn } from "@/lib/utils";
import LogoPng from "@/assets/fieldflow-logo-removebg-preview.png";

export function BrandIcon({
  size = 40,
  alt = "FieldFlow",
  className,
  imgClassName,
}: {
  size?: number;
  alt?: string;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div
      className={cn(
        "gradient-bg rounded-lg flex items-center justify-center shadow-glow",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={LogoPng}
        alt={alt}
        className={cn("w-[70%] h-[70%] object-contain", imgClassName)}
      />
    </div>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-bold tracking-tight", className)}>
      Field<span className="gradient-text">Flow</span>
    </span>
  );
}

export function BrandMark({
  iconSize = 40,
  className,
  iconClassName,
  wordmarkClassName,
  alt = "FieldFlow",
}: {
  iconSize?: number;
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  alt?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandIcon size={iconSize} alt={alt} className={iconClassName} />
      <BrandWordmark className={cn("text-xl", wordmarkClassName)} />
    </span>
  );
}

