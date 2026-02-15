import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TradeFilter } from "@/features/dashboard/hooks/use-trade-filter";

type Props = {
  value: TradeFilter;
  onChange: (next: TradeFilter) => void;
  options: { value: TradeFilter; label: string }[];
};

export default function TradeFilterSelect({ value, onChange, options }: Props) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TradeFilter)}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="All trades" />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
