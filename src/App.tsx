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
import CocCertificates from "./pages/dashboard/CocCertificates";
import ServiceCalls from "./pages/dashboard/ServiceCalls";
import MaintenanceSchedules from "./pages/dashboard/MaintenanceSchedules";
import VehicleLogs from "./pages/dashboard/VehicleLogs";
import PartsCatalog from "./pages/dashboard/PartsCatalog";
import ServiceLogs from "./pages/dashboard/ServiceLogs";
import ComplianceRecords from "./pages/dashboard/ComplianceRecords";
import WarrantyTracker from "./pages/dashboard/WarrantyTracker";
import RepairHistory from "./pages/dashboard/RepairHistory";
import TechDashboard from "./pages/TechDashboard";
import TechDispatch from "./pages/tech/TechDispatch";
import TechMyJobs from "./pages/tech/TechMyJobs";
import TechJobDetail from "./pages/tech/TechJobDetail";
import TechInventory from "./pages/tech/TechInventory";
import TechCocCertificates from "./pages/tech/TechCocCertificates";
import TechPlaceholder from "./pages/tech/TechPlaceholder";
import TechSettings from "./pages/tech/TechSettings";
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
              <Route path="coc-certificates" element={<CocCertificates />} />
              <Route path="service-calls" element={<ServiceCalls />} />
              <Route path="maintenance-schedules" element={<MaintenanceSchedules />} />
              <Route path="vehicle-logs" element={<VehicleLogs />} />
              <Route path="parts-catalog" element={<PartsCatalog />} />
              <Route path="service-logs" element={<ServiceLogs />} />
              <Route path="compliance" element={<ComplianceRecords />} />
              <Route path="warranty-tracker" element={<WarrantyTracker />} />
              <Route path="repair-history" element={<RepairHistory />} />
            </Route>
            {/* Technician dashboard */}
            <Route path="/tech" element={<TechDashboard />}>
              <Route index element={<TechDispatch />} />
              <Route path="my-jobs" element={<TechMyJobs />} />
              <Route path="job/:jobId" element={<TechJobDetail />} />
              <Route path="inventory" element={<TechInventory />} />
              <Route path="settings" element={<TechSettings />} />
              <Route path="solar" element={<TechPlaceholder title="Solar Tasks" />} />
              <Route path="coc" element={<TechCocCertificates />} />
              <Route path="service-calls" element={<TechPlaceholder title="Service Calls" />} />
              <Route path="vehicle-logs" element={<TechPlaceholder title="Vehicle Logs" />} />
              <Route path="service-logs" element={<TechPlaceholder title="Service Logs" />} />
              <Route path="compliance" element={<TechPlaceholder title="Compliance" />} />
              <Route path="warranty" element={<TechPlaceholder title="Warranty" />} />
              <Route path="repairs" element={<TechPlaceholder title="Repairs" />} />
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
