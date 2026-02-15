import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Camera, Image, Trash2, Upload } from "lucide-react";
import * as React from "react";

type Photo = { id: string; storage_path: string; kind: string; caption: string | null; url?: string };

type Props = {
  jobId: string;
  kind: "before" | "after";
};

export default function JobPhotoUpload({ jobId, kind }: Props) {
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const fetchPhotos = React.useCallback(async () => {
    const { data } = await supabase
      .from("job_photos")
      .select("*")
      .eq("job_card_id", jobId)
      .eq("kind", kind)
      .order("created_at", { ascending: true });
    if (!data) return;
    const withUrls = data.map((p: any) => ({
      ...p,
      url: supabase.storage.from("job-photos").getPublicUrl(p.storage_path).data.publicUrl,
    }));
    setPhotos(withUrls);
  }, [jobId, kind]);

  React.useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${jobId}/${kind}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("job-photos").upload(path, file);
      if (uploadErr) {
        toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
        continue;
      }
      await supabase.from("job_photos").insert({
        job_card_id: jobId,
        kind,
        storage_path: path,
        taken_at: new Date().toISOString(),
      });
    }
    setUploading(false);
    fetchPhotos();
    toast({ title: `${kind} photo(s) uploaded` });
    if (fileRef.current) fileRef.current.value = "";
  };

  const deletePhoto = async (photo: Photo) => {
    await supabase.storage.from("job-photos").remove([photo.storage_path]);
    await supabase.from("job_photos").delete().eq("id", photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    toast({ title: "Photo deleted" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium capitalize">{kind} Photos</h4>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Upload className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : "Add Photo"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
      {photos.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm">
          <Image className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No {kind} photos yet
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group rounded-lg overflow-hidden border">
              <img src={photo.url} alt={`${kind} photo`} className="w-full h-32 object-cover" />
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => deletePhoto(photo)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
