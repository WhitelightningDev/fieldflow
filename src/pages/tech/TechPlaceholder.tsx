import { Card, CardContent } from "@/components/ui/card";
import { Wrench } from "lucide-react";

export default function TechPlaceholder({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Wrench className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <div className="font-medium">Coming soon</div>
          <div className="text-sm mt-1">This feature is being built for your industry.</div>
        </CardContent>
      </Card>
    </div>
  );
}
