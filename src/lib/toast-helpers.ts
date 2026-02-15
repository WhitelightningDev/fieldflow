import { toast } from "@/hooks/use-toast";

export function toastSuccess(title: string, description?: string) {
  return toast({ title, description, variant: "success" as any });
}

export function toastError(title: string, description?: string) {
  return toast({ title, description, variant: "destructive" });
}

export function toastInfo(title: string, description?: string) {
  return toast({ title, description, variant: "info" as any });
}

export function toastDefault(title: string, description?: string) {
  return toast({ title, description });
}
