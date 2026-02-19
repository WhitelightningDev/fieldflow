import { NotFoundContent } from "@/components/errors/not-found-content";

export default function TechNotFound() {
  return (
    <div className="py-10">
      <NotFoundContent
        title="Page not found"
        subtitle="This technician page doesn’t exist."
        primaryTo="/tech"
        primaryLabel="Back to Dispatch"
        showBrand={false}
      />
    </div>
  );
}

