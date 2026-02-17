import { Button } from "@/components/ui/button";
import { Navigation, Phone } from "lucide-react";

type Props = {
  customerPhone?: string | null;
  siteAddress?: string | null;
  customerAddress?: string | null;
};

export default function JobQuickActions({ customerPhone, siteAddress, customerAddress }: Props) {
  const address = siteAddress || customerAddress;

  const handleCall = () => {
    if (customerPhone) window.open(`tel:${customerPhone}`, "_self");
  };

  const handleNavigate = () => {
    if (address) {
      const q = encodeURIComponent(address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
    }
  };

  if (!customerPhone && !address) return null;

  return (
    <div className="flex gap-2">
      {customerPhone && (
        <Button size="sm" variant="outline" onClick={handleCall} className="gap-1.5 flex-1">
          <Phone className="h-3.5 w-3.5" /> Call Client
        </Button>
      )}
      {address && (
        <Button size="sm" variant="outline" onClick={handleNavigate} className="gap-1.5 flex-1">
          <Navigation className="h-3.5 w-3.5" /> Navigate
        </Button>
      )}
    </div>
  );
}
