import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface NotificationProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

export const Notification: React.FC<NotificationProps> = ({
  id,
  type,
  title,
  message,
  onClose
}) => {
  const icons = {
    success: CheckCircle,
    error: X,
    warning: AlertTriangle,
    info: Info
  };

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const Icon = icons[type];

  return (
    <div className={cn(
      'fixed top-4 right-4 z-50 min-w-80 max-w-md p-4 border rounded-lg shadow-lg animate-in slide-in-from-top-2',
      styles[type]
    )}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{title}</p>
          {message && (
            <p className="text-sm opacity-90 mt-1">{message}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onClose(id)}
          className="h-6 w-6 p-0 hover:bg-black/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};