import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export interface AppNotification {
  id: string;
  message: string;
  href?: string;
  createdAt: number;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  notify: (notification: Omit<AppNotification, "createdAt">) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const STORAGE_KEY = "dataphi-crm-notifications";
const MAX_NOTIFICATIONS = 30;

const NotificationContext = createContext<NotificationContextValue | null>(null);

function loadInitial(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppNotification[]) : [];
  } catch {
    return [];
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      /* private-browsing / quota — notifications just won't survive a refresh */
    }
  }, [notifications]);

  const notify = useCallback((n: Omit<AppNotification, "createdAt">) => {
    setNotifications((prev) => {
      if (prev.some((p) => p.id === n.id)) return prev; // dedupe by id (e.g. "account-42")
      return [{ ...n, createdAt: Date.now() }, ...prev].slice(0, MAX_NOTIFICATIONS);
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}
