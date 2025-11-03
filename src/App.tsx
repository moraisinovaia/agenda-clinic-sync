import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "./components/AuthGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";

// 🔑 Key única para forçar remontagem completa quando necessário
const APP_MOUNT_KEY = 'v2025-11-03-realtime-v3-polling-fallback';

const App = () => (
  <ErrorBoundary>
    <TooltipProvider key={APP_MOUNT_KEY}>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AuthGuard><Index /></AuthGuard>} />
          <Route path="/auth" element={<Auth />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </ErrorBoundary>
);

export default App;
