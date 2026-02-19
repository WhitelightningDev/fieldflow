import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand/brand-mark";
import { useAuth } from "@/features/auth/hooks/use-auth";

type Props = {
  title?: string;
  subtitle?: string;
  primaryTo?: string;
  primaryLabel?: string;
  showBrand?: boolean;
  showPath?: boolean;
};

export function NotFoundContent({
  title = "404",
  subtitle = "This page doesn’t exist (or was moved).",
  primaryTo,
  primaryLabel,
  showBrand = true,
  showPath = true,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, roles } = useAuth();

  const defaultPrimary = React.useMemo(() => {
    if (!session) return { to: "/", label: "Go home" };
    const roleSet = new Set(roles);
    const isTech = roleSet.has("technician");
    return { to: isTech ? "/tech" : "/dashboard", label: isTech ? "Go to Tech dashboard" : "Go to Dashboard" };
  }, [roles, session]);

  const finalPrimaryTo = primaryTo ?? defaultPrimary.to;
  const finalPrimaryLabel = primaryLabel ?? defaultPrimary.label;

  return (
    <div className="w-full max-w-xl text-center space-y-4">
      {showBrand ? (
        <div className="flex justify-center">
          <BrandMark iconSize={44} />
        </div>
      ) : null}

      <div className="space-y-1">
        <div className="text-5xl font-bold tracking-tight">{title}</div>
        <div className="text-muted-foreground">{subtitle}</div>
      </div>

      {showPath ? (
        <div className="text-xs text-muted-foreground">
          Tried to open: <span className="font-mono text-foreground">{location.pathname}</span>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go back
        </Button>
        <Button asChild className="gradient-bg hover:opacity-90 shadow-glow">
          <Link to={finalPrimaryTo}>{finalPrimaryLabel}</Link>
        </Button>
        {!session ? (
          <Button asChild variant="ghost">
            <Link to="/login">Log in</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

