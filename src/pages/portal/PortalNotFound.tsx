import { NotFoundContent } from "@/components/errors/not-found-content";

export default function PortalNotFound() {
  return (
    <div className="min-h-[70dvh] flex items-center justify-center px-4">
      <NotFoundContent />
    </div>
  );
}

