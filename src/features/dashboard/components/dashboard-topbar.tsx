import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import TradeFilterSelect from "@/features/dashboard/components/trade-filter-select";
import { LayoutGrid } from "lucide-react";
import { Link } from "react-router-dom";

export default function DashboardTopbar() {
  const { trade, setTrade } = useTradeFilter();

  return (
    <div className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 h-14">
        <SidebarTrigger />
        <div className="flex-1 flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <LayoutGrid className="h-4 w-4" />
            Dashboard
          </div>
          <div className="ml-auto flex items-center gap-2">
            <TradeFilterSelect value={trade} onChange={setTrade} />
            <Button asChild variant="outline" size="sm">
              <Link to="/company-signup">Add company</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

