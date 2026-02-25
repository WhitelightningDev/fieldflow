import * as React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("App crashed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const msg = this.state.error?.message ?? "Unknown error";
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-xl border bg-card/70 backdrop-blur-sm p-6 space-y-3">
          <div className="text-lg font-semibold">Something went wrong</div>
          <div className="text-sm text-muted-foreground">
            The app hit a runtime error and couldn’t render. Try refreshing the page. If it keeps happening, open your browser console and share the first red error.
          </div>
          <div className="rounded-lg border bg-background/40 p-3 text-xs whitespace-pre-wrap break-words">
            {msg}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => window.location.reload()} className="gradient-bg hover:opacity-90 shadow-glow">
              Refresh
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

