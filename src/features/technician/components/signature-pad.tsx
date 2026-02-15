import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Check, RotateCcw } from "lucide-react";
import * as React from "react";

type Props = { jobId: string; onSigned?: () => void };

export default function SignaturePad({ jobId, onSigned }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = React.useState(false);
  const [hasSignature, setHasSignature] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = getCtx();
    if (!ctx) return;
    setDrawing(true);
    const rect = canvasRef.current!.getBoundingClientRect();
    const pos = "touches" in e
      ? { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
      : { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const ctx = getCtx();
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const pos = "touches" in e
      ? { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
      : { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "hsl(var(--foreground))";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDraw = () => setDrawing(false);

  const clear = () => {
    const ctx = getCtx();
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
  };

  const saveSignature = async () => {
    if (!canvasRef.current || !hasSignature) return;
    setSaving(true);
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) { setSaving(false); return; }
      const path = `${jobId}/signature-${Date.now()}.png`;
      const { error: uploadErr } = await supabase.storage.from("job-photos").upload(path, blob, { contentType: "image/png" });
      if (uploadErr) {
        toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      await supabase.from("job_photos").insert({
        job_card_id: jobId,
        kind: "signature",
        storage_path: path,
        taken_at: new Date().toISOString(),
      });
      // Mark job as invoiced (signature collected)
      await supabase.from("job_cards").update({ status: "invoiced" as any }).eq("id", jobId);
      setSaving(false);
      toast({ title: "Signature saved" });
      onSigned?.();
    }, "image/png");
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Customer Signature</h4>
      <div className="border rounded-lg overflow-hidden bg-background">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={clear} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Clear
        </Button>
        <Button
          size="sm"
          onClick={saveSignature}
          disabled={!hasSignature || saving}
          className="gradient-bg hover:opacity-90 shadow-glow gap-1.5"
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Confirm Signature"}
        </Button>
      </div>
    </div>
  );
}
