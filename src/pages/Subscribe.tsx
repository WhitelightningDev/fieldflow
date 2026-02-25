import { useSearchParams } from "react-router-dom";
import PackageSignupFlow from "@/features/subscription/components/package-signup-flow";
import { type PlanTier } from "@/features/subscription/plans";

export default function Subscribe() {
  const [params] = useSearchParams();
  const tier = params.get("plan") as PlanTier | null;
  return <PackageSignupFlow initialTier={tier ?? undefined} />;
}
