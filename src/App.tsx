import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import MyPerformance from "./pages/MyPerformance";
import TeamPerformance from "./pages/TeamPerformance";
import SegmentPerformance from "./pages/SegmentPerformance";
import Pipeline from "./pages/Pipeline";
import Revenue from "./pages/Revenue";
import Products from "./pages/Products";
import ARCashflow from "./pages/ARCashflow";
import ProfilePage from "./pages/ProfilePage";
import AdminPanel from "./pages/AdminPanel";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
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
      <AppLayout>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/my-performance" element={<MyPerformance />} />
          <Route path="/my-performance/kpis" element={<MyPerformance />} />
          <Route path="/my-performance/activities" element={<MyPerformance />} />
          <Route path="/my-performance/pipeline" element={<MyPerformance />} />
          <Route path="/team-performance" element={<TeamPerformance />} />
          <Route path="/segment-performance" element={<SegmentPerformance />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/products" element={<Products />} />
          <Route path="/ar-cashflow" element={<ARCashflow />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
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
);

export default App;
