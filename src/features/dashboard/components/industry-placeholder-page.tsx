import PageHeader from "@/features/dashboard/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

type Props = {
  title: string;
  subtitle: string;
};

export default function IndustryPlaceholderPage({ title, subtitle }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Construction className="h-5 w-5 text-muted-foreground" />
            Coming soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This feature is under development and will be available shortly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
