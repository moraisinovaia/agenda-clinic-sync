import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load heavy components
export const LazyDashboard = lazy(() => 
  import('@/components/dashboard/SystemHealthDashboard').then(module => ({
    default: module.SystemHealthDashboard
  }))
);

export const LazySchedulingForm = lazy(() => 
  import('@/components/scheduling/SchedulingForm').then(module => ({
    default: module.SchedulingForm
  }))
);

export const LazyAppointmentsList = lazy(() => 
  import('@/components/scheduling/AppointmentsList').then(module => ({
    default: module.AppointmentsList
  }))
);

export const LazyFilaEspera = lazy(() => 
  import('@/components/fila-espera/FilaEsperaList').then(module => ({
    default: module.FilaEsperaList
  }))
);

export const LazyPreparos = lazy(() => 
  import('@/components/preparos/PreparosView').then(module => ({
    default: module.PreparosView
  }))
);

// Wrapper component with loading fallback
interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const LazyWrapper = ({ 
  children, 
  fallback = (
    <div className="flex items-center justify-center h-32">
      <LoadingSpinner size="lg" />
    </div>
  ) 
}: LazyWrapperProps) => (
  <Suspense fallback={fallback}>
    {children}
  </Suspense>
);