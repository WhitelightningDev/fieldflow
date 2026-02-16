import { Button } from "@/components/ui/button";
import * as React from "react";
import { RotateCcw } from "lucide-react";

type Props = {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
  height?: number;
};

function getPointerPos(e: React.MouseEvent | React.TouchEvent, rect: DOMRect) {
  if ("touches" in e) {
    const t = e.touches[0];
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }
  const m = e as React.MouseEvent;
  return { x: m.clientX - rect.left, y: m.clientY - rect.top };
}

export default function SignatureCapture({ label, value, onChange, height = 140 }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = React.useState(false);

  const getCtx = React.useCallback(() => canvasRef.current?.getContext("2d") ?? null, []);

  const clear = React.useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }, [getCtx, onChange]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!value) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;
      ctx.drawImage(img, x, y, w, h);
    };
    img.src = value;
  }, [getCtx, value]);

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    setDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const pos = getPointerPos(e, rect);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pos = getPointerPos(e, rect);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const stopDraw = () => {
    setDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{label}</div>
        <Button type="button" size="sm" variant="outline" onClick={clear} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>
      <div className="border rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={900}
          height={height}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
      <div className="text-xs text-muted-foreground">Sign inside the box.</div>
    </div>
  );
}

