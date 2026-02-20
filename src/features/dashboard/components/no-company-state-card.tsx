import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

type Props = {
  title?: string;
  description?: string;
  canCreateCompany?: boolean;
  onRetryLink?: () => void;
};

export default function NoCompanyStateCard({
  title = "No company yet",
  description = "Create your company to unlock job cards, inventory, teams, and sites.",
  canCreateCompany = true,
  onRetryLink,
}: Props) {
  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-muted-foreground">{description}</div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {onRetryLink ? (
            <Button type="button" variant="outline" onClick={onRetryLink}>
              Retry linking
            </Button>
          ) : null}
          {canCreateCompany ? (
            <Button asChild className="gradient-bg hover:opacity-90 shadow-glow">
              <Link to="/dashboard/create-company">Create company</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
