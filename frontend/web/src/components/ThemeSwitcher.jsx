import { useEffect, useState } from 'react';

// Theme switcher (header): Light / Dark / System.
// - 'light' / 'dark' set an explicit data-theme on <html> that overrides the OS.
// - 'system' removes the attribute so the OS preference (prefers-color-scheme)
//   decides. The choice is remembered across sessions.
function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

const THEMES = [
  { key: 'light', title: 'Light theme', Icon: SunIcon },
  { key: 'dark', title: 'Dark theme', Icon: MoonIcon },
  { key: 'system', title: 'System theme', Icon: SystemIcon }
];

// Shared with main.jsx so the theme applies before first paint (no flash).
export function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

export default function ThemeSwitcher() {
  const [active, setActive] = useState(() => localStorage.getItem('zorfly_theme') || 'system');

  useEffect(() => {
    applyTheme(active);
    localStorage.setItem('zorfly_theme', active);
  }, [active]);

  return (
    <div className="theme-switcher" role="group" aria-label="Theme">
      {THEMES.map(({ key, title, Icon }) => (
        <button
          key={key}
          type="button"
          title={title}
          aria-label={title}
          className={`theme-btn${active === key ? ' active' : ''}`}
          onClick={() => setActive(key)}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
