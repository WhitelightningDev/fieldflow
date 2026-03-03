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
  centerContentOnMobile?: boolean;
  brandInContentOnMobile?: boolean;
  className?: string;
};

export default function AuthLayout({
  title,
  subtitle,
  children,
  side,
  topRight,
  centerContentOnMobile = false,
  brandInContentOnMobile = false,
  className,
}: Props) {
  return (
    <div className={cn("relative min-h-[100dvh] bg-background", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(199_89%_48%/0.08),transparent_55%)]" />
      <div className="container mx-auto px-4 relative flex min-h-[100dvh] flex-col">
        {brandInContentOnMobile ? <div className="lg:hidden h-[env(safe-area-inset-top)]" /> : null}
        <div
          className={cn(
            "flex items-center justify-between gap-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-4 lg:py-6",
            brandInContentOnMobile ? "hidden lg:flex" : null,
          )}
        >
          <Link to="/" className="flex items-center gap-2 group">
            <BrandIcon size={36} className="transition-all duration-300 group-hover:shadow-lg" />
            <BrandWordmark className="text-xl" />
          </Link>
          {topRight}
        </div>

        <div
          className={cn(
            "grid flex-1 lg:grid-cols-2 gap-10 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-16",
            centerContentOnMobile ? "items-center lg:items-start" : "items-start",
          )}
        >
          <div className="hidden lg:block pt-6">
            <div className="max-w-lg">
              <h1 className="text-4xl font-bold leading-tight">{title}</h1>
              {subtitle ? <p className="text-muted-foreground text-lg mt-3">{subtitle}</p> : null}
              <div className="mt-8">{side}</div>
            </div>
          </div>

          <div className="lg:pt-12">
            {brandInContentOnMobile ? (
              <div className="lg:hidden flex flex-col items-center gap-3 pb-6">
                <Link to="/" className="flex items-center gap-2">
                  <BrandIcon size={44} />
                  <BrandWordmark className="text-2xl" />
                </Link>
                {topRight ? <div className="text-center">{topRight}</div> : null}
              </div>
            ) : null}
            <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
              <CardContent className="p-6 sm:p-8">{children}</CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
