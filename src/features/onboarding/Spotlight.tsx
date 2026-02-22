import * as React from "react";

type Props = {
  rect: DOMRect | null;
  padding?: number;
  radius?: number;
  mode?: "spotlight" | "outline";
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function Spotlight({ rect, padding = 10, radius = 10, mode = "outline" }: Props) {
  const style = React.useMemo(() => {
    if (!rect) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Compute a padded highlight box and clamp it into the viewport so the
    // huge shadow doesn't drift when targets are partially off-screen.
    const rawLeft = rect.left - padding;
    const rawTop = rect.top - padding;
    const rawWidth = rect.width + padding * 2;
    const rawHeight = rect.height + padding * 2;

    const left = clamp(rawLeft, 8, Math.max(8, vw - 8));
    const top = clamp(rawTop, 8, Math.max(8, vh - 8));
    const width = clamp(rawWidth, 0, Math.max(0, vw - left - 8));
    const height = clamp(rawHeight, 0, Math.max(0, vh - top - 8));

    const out: React.CSSProperties = {
      left,
      top,
      width,
      height,
      borderRadius: radius,
    };
    if (mode === "spotlight") out.boxShadow = "0 0 0 9999px rgba(0,0,0,0.6)";
    return out;
  }, [rect, padding, radius, mode]);

  if (!style) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed z-[9999] ring-2 ring-primary/70 bg-transparent transition-[left,top,width,height] duration-150 ease-out pointer-events-none"
      style={style}
    />
  );
}
