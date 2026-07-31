import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardCheck,
  BookOpen,
  Users,
  TrendingUp,
  Building2,
  Search,
  Plus
} from 'lucide-react';
import AccentSwitcher from '../components/AccentSwitcher.jsx';
import CompanySwitcher from '../components/CompanySwitcher.jsx';
import FontSizeSwitcher from '../components/FontSizeSwitcher.jsx';
import ImpersonationBanner from '../components/ImpersonationBanner.jsx';
import NotificationsBell from '../components/NotificationsBell.jsx';
import SidebarPromo from '../components/SidebarPromo.jsx';
import ThemeSwitcher from '../components/ThemeSwitcher.jsx';
import UserMenu from '../components/UserMenu.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const MANAGERS = ['company_admin', 'hr', 'team_leader'];
const ADMIN_HR = ['company_admin', 'hr'];

const NAV_ICONS = {
  dashboard: LayoutDashboard,
  assessments: ClipboardCheck,
  learning: BookOpen,
  people: Users,
  performance: TrendingUp,
  company: Building2,
  search: Search,
  plus: Plus
};

// Sidebar/header icons — Lucide throughout, sized to match the previous
// hand-drawn set's weight.
function Ico({ name }) {
  const Cmp = NAV_ICONS[name];
  return Cmp ? <Cmp size={18} strokeWidth={1.8} aria-hidden="true" /> : null;
}

// Navigation grouped into logical sections with collapsible submenus (UX-ORG).
// Every destination and its role gates are unchanged — this only re-shapes how
// the same routes are presented.
const NAV = [
  { type: 'item', to: '/app', label: 'Dashboard', end: true, icon: 'dashboard', roles: null },
  {
    type: 'group',
    label: 'Assessments',
    icon: 'assessments',
    items: [
      { to: '/app/my-tests', label: 'My Tests', roles: null },
      { to: '/app/tests', label: 'Tests', roles: MANAGERS },
      { to: '/app/questions', label: 'Question Bank', roles: MANAGERS },
      { to: '/app/categories', label: 'Categories', roles: ['company_admin'] },
      { to: '/app/schedules', label: 'Schedules', roles: MANAGERS },
      { to: '/app/reviews', label: 'Review Queue', roles: ADMIN_HR },
      { to: '/app/practice', label: 'Practice', roles: null },
      { to: '/app/calendar', label: 'Calendar', roles: null }
    ]
  },
  {
    type: 'group',
    label: 'Learning',
    icon: 'learning',
    items: [
      { to: '/app/learning', label: 'Learning Content', roles: null },
      { to: '/app/study', label: 'Study Library', roles: null },
      { to: '/app/paths', label: 'Learning Paths', roles: ADMIN_HR },
      { to: '/app/certificates', label: 'Certificates', roles: null },
      { to: '/app/badges', label: 'Badges', roles: null }
    ]
  },
  {
    type: 'group',
    label: 'People',
    icon: 'people',
    items: [
      { to: '/app/employees', label: 'Employees', roles: MANAGERS, perm: 'employees:read' },
      { to: '/app/departments', label: 'Departments', roles: MANAGERS, perm: 'departments:read' },
      { to: '/app/teams', label: 'Teams', roles: MANAGERS, perm: 'teams:read' },
      { to: '/app/branches', label: 'Branches', roles: ADMIN_HR, perm: 'branches:read' },
      { to: '/app/drives', label: 'Recruitment', roles: ADMIN_HR, perm: 'drives:manage' },
      {
        to: '/app/roles',
        label: 'Roles & Permissions',
        roles: ['company_admin'],
        perm: 'roles:manage'
      }
    ]
  },
  {
    type: 'group',
    label: 'Performance',
    icon: 'performance',
    items: [
      { to: '/app/leaderboard', label: 'Leaderboard', roles: null },
      { to: '/app/reports', label: 'Reports & Analytics', roles: MANAGERS, perm: 'reports:read' }
    ]
  },
  {
    type: 'group',
    label: 'Company',
    icon: 'company',
    items: [
      { to: '/app/company-settings', label: 'Company Settings', roles: ['company_admin'] },
      { to: '/app/billing', label: 'Billing', roles: ['company_admin'] },
      { to: '/app/recycle-bin', label: 'Recycle Bin', roles: ADMIN_HR }
    ]
  }
];

const pathMatches = (pathname, to, end) =>
  end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

// Command palette (⌘K / Ctrl+K) — a keyboard-first jump to any page the user can
// reach. Reuses the same role-filtered destinations as the sidebar.
function CommandPalette({ destinations, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return destinations;
    return destinations.filter(
      (d) => d.label.toLowerCase().includes(q) || d.group.toLowerCase().includes(q)
    );
  }, [query, destinations]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  const go = (dest) => {
    if (!dest) return;
    onClose();
    navigate(dest.to);
  };

  return (
    <div className="cmdk-overlay" onMouseDown={onClose}>
      <div
        className="cmdk"
        role="dialog"
        aria-label="Search pages"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="cmdk-input-row">
          <Ico name="search" />
          <input
            className="cmdk-input"
            type="text"
            autoFocus
            placeholder="Search pages and sections…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                go(results[cursor]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
          />
          <kbd className="cmdk-esc">Esc</kbd>
        </div>
        <div className="cmdk-list">
          {results.length === 0 && <p className="cmdk-empty">No pages match “{query}”.</p>}
          {results.map((dest, index) => (
            <button
              key={dest.to}
              type="button"
              className={`cmdk-item${index === cursor ? ' active' : ''}`}
              onMouseEnter={() => setCursor(index)}
              onClick={() => go(dest)}
            >
              <span className="cmdk-item-label">{dest.label}</span>
              <span className="cmdk-item-group">{dest.group}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { role, user, company, can, logOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const handleLogOut = async () => {
    await logOut();
    navigate('/log-in');
  };

  // Visible if the node targets this built-in role OR the user holds its
  // permission (so custom-role users see what they're allowed to).
  const allowed = useCallback(
    (node) => !node.roles || node.roles.includes(role) || (node.perm && can(node.perm)),
    [can, role]
  );

  // Build the visible navigation tree for this role, dropping empty groups.
  const nav = useMemo(
    () =>
      NAV.map((node) => {
        if (node.type === 'item') return allowed(node) ? node : null;
        const items = node.items.filter((item) => allowed(item));
        return items.length ? { ...node, items } : null;
      }).filter(Boolean),
    [allowed]
  );

  // Flattened destinations power the command palette.
  const destinations = useMemo(() => {
    const list = [];
    for (const node of nav) {
      if (node.type === 'item')
        list.push({ to: node.to, label: node.label, group: 'General', end: node.end });
      else
        for (const item of node.items)
          list.push({ to: item.to, label: item.label, group: node.label });
    }
    return list;
  }, [nav]);

  // Which group holds the current route (kept expanded).
  const activeGroup = useMemo(() => {
    for (const node of nav) {
      if (node.type !== 'group') continue;
      if (node.items.some((item) => pathMatches(location.pathname, item.to, false)))
        return node.label;
    }
    return null;
  }, [nav, location.pathname]);

  const [expanded, setExpanded] = useState(() => new Set(activeGroup ? [activeGroup] : []));

  // Keep the active group open as the route changes, without collapsing groups
  // the user opened manually.
  useEffect(() => {
    if (activeGroup)
      setExpanded((prev) => (prev.has(activeGroup) ? prev : new Set(prev).add(activeGroup)));
  }, [activeGroup]);

  // Global ⌘K / Ctrl+K opens the palette.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleGroup = (label) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const canAuthor = MANAGERS.includes(role);

  return (
    <div className="app-shell">
      <ImpersonationBanner />
      <div className="app-body">
        <aside className={`app-sidebar sidebar-brand${sidebarOpen ? ' open' : ''}`}>
          {/* Brand lives in the sidebar (full-height rail), not the top bar */}
          <div className="side-brand">
            <span className="brand-mark" aria-hidden="true">
              Z
            </span>
            <span className="side-brand-text">
              <span className="side-brand-name">Zorfly</span>
              <span className="side-brand-tag">Assess. Train. Improve.</span>
            </span>
          </div>

          <CompanySwitcher />

          {canAuthor && (
            <button
              type="button"
              className="btn btn-primary side-cta"
              onClick={() => {
                setSidebarOpen(false);
                navigate('/app/tests');
              }}
            >
              <Ico name="plus" />
              Create Test
            </button>
          )}

          <nav className="side-nav">
            {nav.map((node) => {
              if (node.type === 'item') {
                return (
                  <NavLink
                    key={node.to}
                    to={node.to}
                    end={node.end}
                    className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="side-link-ico">
                      <Ico name={node.icon} />
                    </span>
                    {node.label}
                  </NavLink>
                );
              }
              const open = expanded.has(node.label);
              return (
                <div key={node.label} className={`side-group${open ? ' open' : ''}`}>
                  <button
                    type="button"
                    className={`side-group-btn${node.label === activeGroup ? ' current' : ''}`}
                    onClick={() => toggleGroup(node.label)}
                    aria-expanded={open}
                  >
                    <span className="side-link-ico">
                      <Ico name={node.icon} />
                    </span>
                    <span className="side-group-label">{node.label}</span>
                    <span className="side-caret" aria-hidden="true">
                      ▸
                    </span>
                  </button>
                  {open && (
                    <div className="side-group-items">
                      {node.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) => `side-item${isActive ? ' active' : ''}`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Promo card — routes to the existing leaderboard/performance page */}
          <SidebarPromo
            text="Quality Culture Starts With You"
            ctaLabel="Explore Insights"
            onClick={() => {
              setSidebarOpen(false);
              navigate('/app/leaderboard');
            }}
          />

          <div className="side-foot">
            <span className="side-foot-user" title={user?.email}>
              {user?.fullName}
            </span>
            <span className="side-foot-co">{company?.name}</span>
          </div>
        </aside>

        <div className="app-content">
          <header className="app-header">
            <div className="app-header-left">
              <button
                type="button"
                className="hamburger"
                aria-label="Toggle menu"
                title="Toggle menu"
                onClick={() => setSidebarOpen((current) => !current)}
              >
                ☰
              </button>
              <button
                type="button"
                className="header-search"
                onClick={() => setPaletteOpen(true)}
                title="Search (Ctrl+K)"
              >
                <Ico name="search" />
                <span className="header-search-label">Search tests, categories, employees…</span>
                <kbd className="header-search-kbd">⌘K</kbd>
              </button>
            </div>
            <div className="app-header-right">
              <ThemeSwitcher />
              <AccentSwitcher />
              <FontSizeSwitcher />
              <NotificationsBell />
              <UserMenu onLogOut={handleLogOut} />
            </div>
          </header>

          <main className="app-main" onClick={() => sidebarOpen && setSidebarOpen(false)}>
            <Outlet />
          </main>
        </div>
      </div>

      {paletteOpen && (
        <CommandPalette destinations={destinations} onClose={() => setPaletteOpen(false)} />
      )}
    </div>
  );
}
