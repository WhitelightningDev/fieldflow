import TechSidebar from "./tech-sidebar";

export default function TechShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <TechSidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
