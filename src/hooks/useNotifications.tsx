import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const { toast } = useToast();

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if ('Notification' in window && permission === 'default') {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    }
    return permission === 'granted';
  }, [permission]);

  const sendNotification = useCallback((data: Omit<NotificationData, 'id' | 'timestamp' | 'read'>) => {
    const notification: NotificationData = {
      ...data,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [notification, ...prev]);

    // Show toast notification
    toast({
      title: data.title,
      description: data.message,
      variant: data.type === 'error' || data.type === 'warning' ? 'destructive' : 'default',
    });

    // Show browser notification if permission granted
    if (permission === 'granted' && 'Notification' in window) {
      const browserNotification = new Notification(data.title, {
        body: data.message,
        icon: '/favicon.ico',
        tag: notification.id,
      });

      browserNotification.onclick = () => {
        window.focus();
        browserNotification.close();
        if (data.action) {
          data.action.onClick();
        }
      };

      // Auto close after 5 seconds
      setTimeout(() => {
        browserNotification.close();
      }, 5000);
    }

    return notification.id;
  }, [permission, toast]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Pre-defined notification types
  const notifyNewAppointment = useCallback((patientName: string, doctorName: string, time: string) => {
    return sendNotification({
      title: 'Novo Agendamento',
      message: `${patientName} agendado com Dr(a). ${doctorName} às ${time}`,
      type: 'success',
    });
  }, [sendNotification]);

  const notifyAppointmentConflict = useCallback((doctorName: string, time: string) => {
    return sendNotification({
      title: 'Conflito de Horário',
      message: `Possível conflito na agenda de Dr(a). ${doctorName} às ${time}`,
      type: 'warning',
    });
  }, [sendNotification]);

  const notifyUpcomingAppointment = useCallback((patientName: string, doctorName: string, time: string) => {
    return sendNotification({
      title: 'Agendamento Próximo',
      message: `${patientName} com Dr(a). ${doctorName} em 15 minutos (${time})`,
      type: 'info',
    });
  }, [sendNotification]);

  const notifyCancellation = useCallback((patientName: string, reason?: string) => {
    return sendNotification({
      title: 'Agendamento Cancelado',
      message: `Agendamento de ${patientName} foi cancelado${reason ? `: ${reason}` : ''}`,
      type: 'info',
    });
  }, [sendNotification]);

  const notifySystemError = useCallback((error: string) => {
    return sendNotification({
      title: 'Erro do Sistema',
      message: error,
      type: 'error',
    });
  }, [sendNotification]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    permission,
    requestPermission,
    sendNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    
    // Pre-defined notifications
    notifyNewAppointment,
    notifyAppointmentConflict,
    notifyUpcomingAppointment,
    notifyCancellation,
    notifySystemError,
  };
};