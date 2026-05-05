import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "./components/AuthGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import MedicoView from "./pages/MedicoView";
import SetupSenha from "./pages/SetupSenha";
import ErrorBoundary from "./components/ErrorBoundary";
import { useDynamicPageBranding } from "./hooks/useDynamicPageBranding";

// 🔑 Key única para forçar remontagem completa quando necessário
const APP_MOUNT_KEY = 'v2025-11-22-realtime-v3.1-tolerant-reconnect';

const DynamicBranding = () => { useDynamicPageBranding(); return null; };

const App = () => (
  <ErrorBoundary>
    <DynamicBranding />
    <TooltipProvider key={APP_MOUNT_KEY}>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AuthGuard><Index /></AuthGuard>} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/setup-senha" element={<AuthGuard><SetupSenha /></AuthGuard>} />
          <Route path="/medico" element={<AuthGuard><MedicoView /></AuthGuard>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </ErrorBoundary>
);

export default App;
