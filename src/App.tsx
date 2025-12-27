import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DoctorOnboarding from "./pages/DoctorOnboarding";
import NoClinicError from "./pages/NoClinicError";
import ErrorBoundary from "./components/ErrorBoundary";

const App = () => (
  <ErrorBoundary>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Rota principal: cadastro de médico por clínica */}
          <Route path="/:clinicaId" element={<DoctorOnboarding />} />
          {/* Rota raiz: erro (sem ID de clínica) */}
          <Route path="/" element={<NoClinicError />} />
          {/* Fallback para rotas não encontradas */}
          <Route path="*" element={<NoClinicError />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </ErrorBoundary>
);

export default App;
