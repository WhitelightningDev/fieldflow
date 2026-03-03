import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";

const variantIcons = {
  default: null,
  destructive: AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
} as const;

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const Icon = variant ? variantIcons[variant as keyof typeof variantIcons] : null;
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex gap-3 items-start">
              {Icon && <Icon className="h-4 w-4 shrink-0 mt-0.5" />}
              <div className="grid gap-0.5">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
