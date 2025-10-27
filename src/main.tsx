import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from './App.tsx';
import './index.css';
import { AuthProvider } from '@/hooks/useAuth';
import { GlobalErrorBoundary } from '@/components/error/GlobalErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Não retry para erros 4xx
        if (error && typeof error === 'object' && 'status' in error) {
          const status = error.status as number;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 3;
      },
      staleTime: 0, // ✅ CORREÇÃO: Desabilitar cache stale temporariamente
      gcTime: 0, // ✅ CORREÇÃO: Forçar limpeza de cache
      refetchOnMount: 'always', // ✅ CORREÇÃO: Sempre refetch ao montar
    },
  },
});

// StrictMode apenas em desenvolvimento para evitar problemas com Google OAuth
const AppWrapper = ({ children }: { children: React.ReactNode }) => {
  if (import.meta.env.DEV) {
    return <StrictMode>{children}</StrictMode>;
  }
  return <>{children}</>;
};

createRoot(document.getElementById("root")!).render(
  <AppWrapper>
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  </AppWrapper>
);
