import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import * as React from "react";
import { Link } from "react-router-dom";
import { BrandIcon, BrandWordmark } from "@/components/brand/brand-mark";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  side?: React.ReactNode;
  topRight?: React.ReactNode;
  className?: string;
};

export default function AuthLayout({ title, subtitle, children, side, topRight, className }: Props) {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(199_89%_48%/0.08),transparent_55%)]" />
      <div className="container mx-auto px-4 relative">
        <div className="flex items-center justify-between py-6">
          <Link to="/" className="flex items-center gap-2 group">
            <BrandIcon size={36} className="transition-all duration-300 group-hover:shadow-lg" />
            <BrandWordmark className="text-xl" />
          </Link>
          {topRight}
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start pb-16">
          <div className="hidden lg:block pt-6">
            <div className="max-w-lg">
              <h1 className="text-4xl font-bold leading-tight">{title}</h1>
              {subtitle ? <p className="text-muted-foreground text-lg mt-3">{subtitle}</p> : null}
              <div className="mt-8">{side}</div>
            </div>
          </div>

          <div className="lg:pt-12">
            <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
              <CardContent className="p-6 sm:p-8">{children}</CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
