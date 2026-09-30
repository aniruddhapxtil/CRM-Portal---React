import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { signOut } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";

const COLLAPSE_KEY = "dataphi-crm-sidebar-collapsed";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** When set, only shown to users whose role is in this list. Omit to show to everyone. */
  roles?: string[];
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {children}
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  {
    to: "/voice",
    label: "Voice Station",
    icon: (
      <Icon>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </Icon>
    ),
  },
  {
    to: "/accounts",
    label: "Accounts",
    icon: (
      <Icon>
        <rect x="3" y="7" width="18" height="14" rx="1" />
        <path d="M9 3h6v4H9z" />
        <line x1="8" y1="12" x2="8" y2="12" />
        <line x1="12" y1="12" x2="12" y2="12" />
        <line x1="16" y1="12" x2="16" y2="12" />
      </Icon>
    ),
  },
  {
    to: "/subsidiaries",
    label: "Subsidiaries",
    icon: (
      <Icon>
        <line x1="6" y1="3" x2="6" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
      </Icon>
    ),
  },
  {
    to: "/contacts",
    label: "Contacts",
    icon: (
      <Icon>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
      </Icon>
    ),
  },
  {
    to: "/leads",
    label: "Leads",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </Icon>
    ),
  },
  {
    to: "/opportunities",
    label: "Opportunities",
    icon: (
      <Icon>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </Icon>
    ),
  },
  {
    to: "/projects",
    label: "Projects",
    icon: (
      <Icon>
        <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </Icon>
    ),
  },
  {
    to: "/activities",
    label: "Activity",
    icon: (
      <Icon>
        <polyline points="3 12 8 12 10 6 14 18 16 12 21 12" />
      </Icon>
    ),
  },
  {
    to: "/qualifications",
    label: "Qualifications",
    roles: ["Admin", "Team Lead", "Executive"],
    icon: (
      <Icon>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </Icon>
    ),
  },
  {
    to: "/admin/users",
    label: "Users",
    roles: ["Admin"],
    icon: (
      <Icon>
        <path d="M12 2 4 5v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5z" />
      </Icon>
    ),
  },
];

function SidebarNavLink({ to, label, icon, collapsed, onClick }: NavItem & { collapsed: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `tap-target group flex items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 ${
          isActive
            ? "border border-brand/40 bg-brand-tint text-ink"
            : "border border-transparent text-muted hover:bg-brand-tint/60 hover:text-ink"
        } ${collapsed ? "justify-center" : ""}`
      }
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

export function AppSidebar({ mobileOpen, onCloseMobile }: { mobileOpen: boolean; onCloseMobile: () => void }) {
  const user = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const items = NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(user.role));

  function content(isCollapsedVariant: boolean, onNavClick?: () => void) {
    return (
      <>
        <div
          className={`flex items-center gap-2 border-b border-border p-4 ${
            isCollapsedVariant ? "flex-col justify-center gap-3 px-2" : ""
          }`}
        >
          <img
            src="/monogram.png"
            alt="DataPhi"
            className="h-8 w-8 shrink-0 object-contain"
          />
          {!isCollapsedVariant && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-base font-extrabold text-ink">DataPhi CRM</div>
              <div className="truncate text-xs text-muted">Conversation to Conversion</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={isCollapsedVariant ? "Expand sidebar" : "Collapse sidebar"}
            className="tap-target hidden shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink lg:flex"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={isCollapsedVariant ? "9 18 15 12 9 6" : "15 18 9 12 15 6"} />
            </svg>
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {items.map((item) => (
            <SidebarNavLink key={item.to} {...item} collapsed={isCollapsedVariant} onClick={onNavClick} />
          ))}
        </nav>

        <div className="border-t border-border p-3">
          {!isCollapsedVariant && (
            <div className="mb-2 px-1 leading-tight">
              <div className="truncate text-sm font-bold text-ink">{user.name}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted">
                {user.role}
                {user.mode === "demo" && (
                  <span className="rounded-full bg-warning-light px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-warning">
                    Demo
                  </span>
                )}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            className={`tap-target flex w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted transition-colors duration-150 hover:bg-danger-light hover:text-danger ${
              isCollapsedVariant ? "justify-center" : ""
            }`}
          >
            <Icon>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </Icon>
            {!isCollapsedVariant && <span>Sign out</span>}
          </button>
          {!isCollapsedVariant && <div className="mt-2 px-1 text-[11px] text-muted">DataPhi CRM</div>}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[76px]" : "w-64"
        }`}
      >
        {content(collapsed)}
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-black/50" onClick={onCloseMobile} />
          <aside className="animate-slide-in-left absolute left-0 top-0 flex h-full w-72 flex-col bg-surface">
            {content(false, onCloseMobile)}
          </aside>
        </div>
      )}
    </>
  );
}
