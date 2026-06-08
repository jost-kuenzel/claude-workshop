import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Navbar />
        <main className="flex-1 p-6">{children}</main>
        <footer className="py-2 text-center text-xs text-muted-foreground">ACME CRM v1.0.0</footer>
      </div>
    </div>
  );
}
