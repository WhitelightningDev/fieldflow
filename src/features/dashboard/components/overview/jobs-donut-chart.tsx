import { cn } from "@/lib/utils";
import * as React from "react";

type Segment = { label: string; count: number; color: string };

export function JobsDonutChart({ segments, size = 160 }: { segments: Segment[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.count, 0);
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <svg width={size} height={size} viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="60" fill="none" stroke="hsl(var(--border))" strokeWidth="20" />
        </svg>
        <p className="text-sm text-muted-foreground mt-3">No jobs yet</p>
      </div>
    );
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width={size} height={size} viewBox="0 0 160 160" className="-rotate-90">
          {segments.map((seg, i) => {
            const pct = seg.count / total;
            const dash = pct * circumference;
            const gap = circumference - dash;
            const currentOffset = offset;
            offset += dash;
            return (
              <circle
                key={i}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="20"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-currentOffset}
                strokeLinecap="butt"
                className="transition-all duration-500"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground">{total}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{seg.label}:</span>
            <span className="font-medium text-foreground">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
