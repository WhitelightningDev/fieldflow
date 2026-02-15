import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/features/auth/hooks/use-auth";
import AuthRedirectHandler from "@/features/auth/components/auth-redirect-handler";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CompanySignup from "./pages/CompanySignup";
import Dashboard from "./pages/Dashboard";
import AuthCallback from "./pages/AuthCallback";
import DashboardHome from "./pages/dashboard/DashboardHome";
import Jobs from "./pages/dashboard/Jobs";
import Customers from "./pages/dashboard/Customers";
import Technicians from "./pages/dashboard/Technicians";
import Inventory from "./pages/dashboard/Inventory";
import Sites from "./pages/dashboard/Sites";
import Teams from "./pages/dashboard/Teams";
import CreateCompany from "./pages/dashboard/CreateCompany";
import SolarProjects from "./pages/dashboard/SolarProjects";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthRedirectHandler />
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/company-signup" element={<CompanySignup />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/dashboard" element={<Dashboard />}>
              <Route index element={<DashboardHome />} />
              <Route path="create-company" element={<CreateCompany />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="customers" element={<Customers />} />
              <Route path="technicians" element={<Technicians />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="sites" element={<Sites />} />
              <Route path="teams" element={<Teams />} />
              <Route path="solar" element={<SolarProjects />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
