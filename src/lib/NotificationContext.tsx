import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';

export type NotificationType = 'warning' | 'error' | 'info' | 'success';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: string;
  isRead: boolean;
  link?: {
    registerId: string;
    rowId?: string | number;
  };
}

export interface Reminder {
  id: string;
  triggerTime?: number; // Unix timestamp (optional)
  message: string;
  registerId: string;
  rowId?: string | number;
  colId?: string;
  status: 'Pending' | 'Complete';
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  scheduleReminder: (reminder: Omit<Reminder, 'id'>) => void;
  reminders: Reminder[];
  setReminders: React.Dispatch<React.SetStateAction<Reminder[]>>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    try {
      const stored = localStorage.getItem('ag_reminders');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    localStorage.setItem('ag_reminders', JSON.stringify(reminders));
  }, [reminders]);

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      isRead: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const remindersRef = useRef(reminders);
  
  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const currentReminders = remindersRef.current;
      
      const triggered = currentReminders.filter(r => r.status === 'Pending' && r.triggerTime !== undefined && r.triggerTime <= now);
      
      if (triggered.length > 0) {
        // Push the notifications
        setNotifications(curr => {
          const newNotifs: AppNotification[] = triggered.map(r => ({
            id: Date.now().toString() + Math.random().toString(36).substring(7),
            title: 'Reminder',
            message: r.message,
            type: 'info',
            timestamp: new Date().toISOString(),
            isRead: false,
            link: { registerId: r.registerId, rowId: r.rowId }
          }));
          return [...newNotifs, ...curr];
        });
        
        // Mark triggered reminders as Complete
        setReminders(prev => prev.map(r => (r.status === 'Pending' && r.triggerTime !== undefined && r.triggerTime <= now) ? { ...r, status: 'Complete' } : r));
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const scheduleReminder = (reminder: Omit<Reminder, 'id'>) => {
    setReminders(prev => [...prev, { ...reminder, id: Date.now().toString() }]);
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll,
      scheduleReminder,
      reminders,
      setReminders
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
