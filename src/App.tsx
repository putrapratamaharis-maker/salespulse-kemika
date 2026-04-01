import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { AppLayout } from "@/components/AppLayout";
import { NotificationListener } from "@/components/NotificationListener";
import Index from "./pages/Index";
import MyPerformance from "./pages/MyPerformance";
import MyKPIs from "./pages/MyKPIs";
import MyActivities from "./pages/MyActivities";
import MyPipeline from "./pages/MyPipeline";
import TeamPerformance from "./pages/TeamPerformance";
import SegmentPerformance from "./pages/SegmentPerformance";
import Pipeline from "./pages/Pipeline";
import Revenue from "./pages/Revenue";
import Products from "./pages/Products";
import ARCashflow from "./pages/ARCashflow";
import ProfilePage from "./pages/ProfilePage";
import MyProfile from "./pages/MyProfile";
import AdminPanel from "./pages/AdminPanel";
import AccountManagement from "./pages/AccountManagement";
import UserManagement from "./pages/UserManagement";
import ProductMaster from "./pages/ProductMaster";
import AuditLog from "./pages/AuditLog";
import DealDeletionApproval from "./pages/DealDeletionApproval";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotificationSettings from "./pages/NotificationSettings";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AppProvider>
      <NotificationListener />
      <AppLayout>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/my-performance" element={<MyPerformance />} />
          <Route path="/my-performance/kpis" element={<MyKPIs />} />
          <Route path="/my-performance/activities" element={<MyActivities />} />
          <Route path="/my-performance/pipeline" element={<MyPipeline />} />
          <Route path="/team-performance" element={<TeamPerformance />} />
          <Route path="/segment-performance" element={<SegmentPerformance />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/products" element={<Products />} />
          <Route path="/ar-cashflow" element={<ARCashflow />} />
          <Route path="/profile" element={<MyProfile />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/accounts" element={<AccountManagement />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/product-master" element={<ProductMaster />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/deal-deletion-approval" element={<DealDeletionApproval />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </AppProvider>
  );
}

function AuthRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Auth />;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<AuthRoutes />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
