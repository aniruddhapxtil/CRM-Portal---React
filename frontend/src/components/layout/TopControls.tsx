import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/NotificationContext";
import { useTheme } from "../../context/ThemeContext";

function timeAgo(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function NotificationBell() {
  const { notifications, dismiss, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="relative">
      <button
        type="button"
        className="tap-target relative flex items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-canvas hover:text-ink"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {notifications.length > 0 && (
          <span className="notif-pulse absolute right-0 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {notifications.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="glass-panel-dark animate-fade-in absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-extrabold text-white">Notifications</span>
              {notifications.length > 0 && (
                <button type="button" className="text-xs font-semibold text-brand-light hover:underline" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-white/60">You're all caught up.</div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-2 border-b border-white/10 px-4 py-3 last:border-0">
                    <div className="flex-1">
                      {n.href ? (
                        <button
                          type="button"
                          className="text-left text-sm font-semibold text-white hover:text-brand-light"
                          onClick={() => {
                            setOpen(false);
                            navigate(n.href!);
                          }}
                        >
                          {n.message}
                        </button>
                      ) : (
                        <span className="text-sm font-semibold text-white">{n.message}</span>
                      )}
                      <div className="mt-0.5 text-[11px] text-white/50">{timeAgo(n.createdAt)}</div>
                    </div>
                    <button
                      type="button"
                      className="tap-target rounded-md px-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                      aria-label="Dismiss"
                      onClick={() => dismiss(n.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="tap-target relative flex w-10 shrink-0 items-center justify-center overflow-hidden rounded-md text-muted transition-colors duration-200 hover:bg-canvas hover:text-ink"
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={`absolute transition-all duration-300 ${isDark ? "-rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
      >
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          strokeLinecap="round"
        />
      </svg>
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={`absolute transition-all duration-300 ${isDark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"}`}
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function TopControls({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur sm:px-6 lg:justify-end">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        aria-label="Open menu"
        className="tap-target flex items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-canvas hover:text-ink lg:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
        </svg>
      </button>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <NotificationBell />
      </div>
    </div>
  );
}
