import AuthLayout from "@/features/auth/components/auth-layout";
import SignupForm from "@/features/auth/components/signup-form";
import TradeCardsGrid from "@/features/company-signup/components/trade-cards-grid";
import { Link } from "react-router-dom";

export default function Signup() {
  return (
    <AuthLayout
      title="Get started."
      subtitle="Join your team, or set up a new company in minutes."
      topRight={
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Already have an account? <span className="text-primary">Log in</span>
        </Link>
      }
      side={
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-semibold">Setting up a new company?</div>
            <div className="text-sm text-muted-foreground">
              Pick your trade to pre-fill the company signup flow.
            </div>
          </div>
          <TradeCardsGrid to={(tradeId) => `/plan-wizard?industry=${tradeId}`} />
        </div>
      }
    >
      <SignupForm />
    </AuthLayout>
  );
}
