import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/features/auth/hooks/use-auth";
import AuthRedirectHandler from "@/features/auth/components/auth-redirect-handler";
import PwaUpdatePrompt from "@/components/PwaUpdatePrompt";
import PwaInstallPrompt from "@/components/pwa-install-prompt";
import NotificationPermissionPrompt from "@/components/notification-permission-prompt";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CompanySignup from "./pages/CompanySignup";
import PlanWizard from "./pages/PlanWizard";
import Contact from "./pages/Contact";
import Dashboard from "./pages/Dashboard";
import AuthCallback from "./pages/AuthCallback";
import DashboardHome from "./pages/dashboard/DashboardHome";
import Jobs from "./pages/dashboard/Jobs";
import Customers from "./pages/dashboard/Customers";
import Technicians from "./pages/dashboard/Technicians";
import Inventory from "./pages/dashboard/Inventory";
import Sites from "./pages/dashboard/Sites";
import Teams from "./pages/dashboard/Teams";
import Invoices from "./pages/dashboard/Invoices";
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
import Messages from "./pages/dashboard/Messages";
import DashboardSettings from "./pages/dashboard/Settings";
import DashboardNotFound from "./pages/dashboard/DashboardNotFound";
import AiAssistant from "./pages/dashboard/AiAssistant";
import QuoteRequests from "./pages/dashboard/QuoteRequests";
import LoadShedding from "./pages/dashboard/LoadShedding";
import TechDashboard from "./pages/TechDashboard";
import TechDispatch from "./pages/tech/TechDispatch";
import TechMyJobs from "./pages/tech/TechMyJobs";
import TechJobDetail from "./pages/tech/TechJobDetail";
import TechInventory from "./pages/tech/TechInventory";
import TechCocCertificates from "./pages/tech/TechCocCertificates";
import TechPlaceholder from "./pages/tech/TechPlaceholder";
import TechSettings from "./pages/tech/TechSettings";
import TechMessages from "./pages/tech/TechMessages";
import TechNotFound from "./pages/tech/TechNotFound";
import NotFound from "./pages/NotFound";
import Subscribe from "./pages/Subscribe";
import QuoteRequestPublic from "./pages/QuoteRequestPublic";
import Portal from "./pages/Portal";
import MyQuotes from "./pages/portal/MyQuotes";
import QuoteDetail from "./pages/portal/QuoteDetail";
import PortalSettings from "./pages/portal/PortalSettings";
import PortalNotFound from "./pages/portal/PortalNotFound";
import { isNativeApp, NATIVE_DEFAULT_ROUTE } from "./lib/native-app";
import { Navigate } from "react-router-dom";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PwaUpdatePrompt />
      <PwaInstallPrompt />
      <NotificationPermissionPrompt />
      <BrowserRouter>
        <AuthRedirectHandler />
        <AuthProvider>
          <Routes>
            {/* Native app (Capacitor) skips landing page → go straight to /tech */}
            <Route path="/" element={isNativeApp() ? <Navigate to={NATIVE_DEFAULT_ROUTE} replace /> : <Index />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/plan-wizard" element={<PlanWizard />} />
            <Route path="/company-signup" element={<CompanySignup />} />
            <Route path="/subscribe" element={<Subscribe />} />
            <Route path="/quote/:token" element={<QuoteRequestPublic />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/portal" element={<Portal />}>
              <Route index element={<MyQuotes />} />
              <Route path="quotes/:quoteRequestId" element={<QuoteDetail />} />
              <Route path="settings" element={<PortalSettings />} />
              <Route path="*" element={<PortalNotFound />} />
            </Route>
	            <Route path="/dashboard" element={<Dashboard />}>
	              <Route index element={<DashboardHome />} />
	              <Route path="create-company" element={<CreateCompany />} />
	              <Route path="settings" element={<DashboardSettings />} />
                <Route path="ai" element={<AiAssistant />} />
	              <Route path="jobs" element={<Jobs />} />
	              <Route path="invoices" element={<Invoices />} />
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
              <Route path="messages" element={<Messages />} />
              <Route path="quotes" element={<QuoteRequests />} />
              <Route path="*" element={<DashboardNotFound />} />
            </Route>
            {/* Technician dashboard */}
            <Route path="/tech" element={<TechDashboard />}>
              <Route index element={<TechDispatch />} />
              <Route path="my-jobs" element={<TechMyJobs />} />
              <Route path="job/:jobId" element={<TechJobDetail />} />
              <Route path="inventory" element={<TechInventory />} />
              <Route path="messages" element={<TechMessages />} />
              <Route path="settings" element={<TechSettings />} />
              <Route path="solar" element={<TechPlaceholder title="Solar Tasks" />} />
              <Route path="coc" element={<TechCocCertificates />} />
              <Route path="service-calls" element={<TechPlaceholder title="Service Calls" />} />
              <Route path="vehicle-logs" element={<TechPlaceholder title="Vehicle Logs" />} />
              <Route path="service-logs" element={<TechPlaceholder title="Service Logs" />} />
              <Route path="compliance" element={<TechPlaceholder title="Compliance" />} />
              <Route path="warranty" element={<TechPlaceholder title="Warranty" />} />
              <Route path="repairs" element={<TechPlaceholder title="Repairs" />} />
              <Route path="*" element={<TechNotFound />} />
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
