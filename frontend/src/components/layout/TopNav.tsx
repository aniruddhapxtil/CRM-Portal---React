import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useTheme } from "../../context/ThemeContext";

const NAV_LINKS = [
  { to: "/voice", label: "Voice Station" },
  { to: "/accounts", label: "Accounts" },
  { to: "/subsidiaries", label: "Subsidiaries" },
  { to: "/contacts", label: "Contacts" },
  { to: "/leads", label: "Leads" },
  { to: "/opportunities", label: "Opportunities" },
  { to: "/projects", label: "Projects" },
  { to: "/activities", label: "Activity" },
] as const;

function NavLinkItem({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `tap-target flex items-center rounded-md px-3 text-sm font-semibold transition-colors duration-200 ${
          isActive
            ? "bg-[var(--nav-active-bg)] text-white"
            : "text-white/70 hover:bg-[var(--nav-active-bg)] hover:text-white"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

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
        className="tap-target relative flex items-center justify-center rounded-md px-2 text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white"
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
      className="tap-target relative flex items-center justify-center overflow-hidden rounded-md px-2 text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white"
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

function UserBadge() {
  const user = useAuth();
  return (
    <div className="flex min-w-0 flex-col text-left leading-tight lg:text-right">
      <span className="truncate text-sm font-semibold text-white">{user.name}</span>
      <span className="flex items-center gap-1.5 text-[11px] text-white/70 lg:justify-end">
        {user.role}
        {user.mode === "demo" && (
          <span className="rounded-full bg-black/25 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">
            Demo login
          </span>
        )}
      </span>
    </div>
  );
}

export function TopNav() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="nav-gradient sticky top-0 z-30">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <div className="flex shrink-0 items-center rounded-lg bg-white/95 px-2.5 py-1.5 shadow-sm">
          <img src="/dataphi-logo-new.png" alt="DataPhi CRM" className="h-7 w-auto" />
        </div>

        <nav className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <NavLinkItem key={l.to} {...l} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <div className="mr-2 hidden items-center gap-2 lg:flex">
            <div className="hidden xl:block">
              <UserBadge />
            </div>
            <button
              type="button"
              className="tap-target rounded-md px-3 text-sm font-semibold text-white/70 transition-colors duration-200 hover:bg-[var(--nav-active-bg)] hover:text-white"
              onClick={signOut}
            >
              Sign out
            </button>
          </div>
          <ThemeToggle />
          <NotificationBell />
          <button
            type="button"
            className="tap-target flex items-center justify-center rounded-md px-2 text-white transition-colors duration-200 hover:bg-white/10 lg:hidden"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="nav-gradient animate-slide-in-right absolute right-0 top-0 flex h-full w-72 flex-col gap-1 p-4">
            <button
              type="button"
              className="tap-target mb-2 ml-auto flex items-center justify-center rounded-md px-2 text-white"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            >
              ✕
            </button>
            {NAV_LINKS.map((l) => (
              <NavLinkItem key={l.to} {...l} onClick={() => setDrawerOpen(false)} />
            ))}
            <div className="mt-auto flex flex-col gap-2 border-t border-white/20 pt-3">
              <div className="px-3">
                <UserBadge />
              </div>
              <button
                type="button"
                className="tap-target flex items-center rounded-md px-3 text-sm font-semibold text-white/70 transition-colors duration-200 hover:bg-[var(--nav-active-bg)] hover:text-white"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
