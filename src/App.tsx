import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/my-performance" element={<MyPerformance />} />
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
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
