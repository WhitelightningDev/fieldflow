import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

export default function NoCompanyStateCard() {
  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">No company yet</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Create your company to unlock job cards, inventory, teams, and sites.
        </div>
        <Button asChild className="gradient-bg hover:opacity-90 shadow-glow">
          <Link to="/dashboard/create-company">Create company</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

