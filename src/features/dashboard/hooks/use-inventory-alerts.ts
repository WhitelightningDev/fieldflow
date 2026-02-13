import { addDays, isBefore, parseISO } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type InventoryItem = Tables<"inventory_items">;

export function useInventoryAlerts(items: InventoryItem[]) {
  const today = new Date();
  const expiringSoonCutoff = addDays(today, 14);

  const lowStock = items.filter((i) => i.quantity_on_hand <= i.reorder_point);
  const expiringSoon = items.filter((i) => {
    if (!i.perishable) return false;
    if (!i.expiry_date) return false;
    const expiry = parseISO(i.expiry_date);
    return isBefore(expiry, expiringSoonCutoff);
  });

  return { lowStock, expiringSoon };
}
