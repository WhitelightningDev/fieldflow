import { addDays, isBefore, parseISO } from "date-fns";
import type { InventoryItem } from "@/features/dashboard/types/inventory";

export function useInventoryAlerts(items: InventoryItem[]) {
  const today = new Date();
  const expiringSoonCutoff = addDays(today, 14);

  const lowStock = items.filter((i) => i.quantityOnHand <= i.reorderPoint);
  const expiringSoon = items.filter((i) => {
    if (!i.perishable) return false;
    if (!i.expiryDate) return false;
    const expiry = parseISO(i.expiryDate);
    return isBefore(expiry, expiringSoonCutoff);
  });

  return { lowStock, expiringSoon };
}

