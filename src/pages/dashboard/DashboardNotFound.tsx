import { NotFoundContent } from "@/components/errors/not-found-content";

export default function DashboardNotFound() {
  return (
    <div className="py-10">
      <NotFoundContent
        title="Page not found"
        subtitle="This dashboard page doesn’t exist."
        primaryTo="/dashboard"
        primaryLabel="Back to Overview"
        showBrand={false}
      />
    </div>
  );
}

