import { Wrench } from "lucide-react";
import { EmptyStateCard } from "@/components/ui/empty-state-card";

export default function TechPlaceholder({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <EmptyStateCard
        icon={<Wrench className="h-10 w-10" />}
        title="Coming soon"
        description="This feature is being built for your industry."
      />
    </div>
  );
}
