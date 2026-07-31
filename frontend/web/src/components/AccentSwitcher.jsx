import { useEffect, useState } from 'react';

// Per-user accent colour (header control). The choice is stored in localStorage
// — this browser/user only, never global — and applied as inline CSS custom
// properties on <html>, overriding the brand primary. 'navy' clears the
// override and restores the default brand colour.
export const ACCENTS = [
  // 'navy' is the internal sentinel key for "reset to the brand default" (see
  // applyAccent below) — kept as-is so existing localStorage values still
  // resolve correctly. Only its label/swatch colour changed to match the
  // current brand default (mint, not navy).
  { key: 'navy', label: 'Mint (default)', color: '#2fae7c' },
  { key: 'indigo', label: 'Indigo', color: '#4f46e5' },
  { key: 'blue', label: 'Blue', color: '#2563eb' },
  { key: 'violet', label: 'Violet', color: '#7c3aed' },
  { key: 'green', label: 'Green', color: '#047857' },
  { key: 'rose', label: 'Rose', color: '#e11d48' }
];

// Shared with main.jsx so the accent applies before first paint (no flash).
export function applyAccent(key) {
  const root = document.documentElement;
  const accent = ACCENTS.find((a) => a.key === key);
  if (!accent || key === 'navy') {
    root.style.removeProperty('--colour-primary');
    root.style.removeProperty('--colour-primary-hover');
    root.style.removeProperty('--colour-primary-soft');
    delete root.dataset.accent;
    return;
  }
  const hex = accent.color;
  root.style.setProperty('--colour-primary', hex);
  root.style.setProperty('--colour-primary-hover', `color-mix(in srgb, ${hex}, #000 16%)`);
  root.style.setProperty(
    '--colour-primary-soft',
    `color-mix(in srgb, ${hex} 15%, var(--colour-surface))`
  );
  root.dataset.accent = key;
}

export default function AccentSwitcher() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => localStorage.getItem('zorfly_accent') || 'navy');

  useEffect(() => {
    applyAccent(active);
    localStorage.setItem('zorfly_accent', active);
  }, [active]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!event.target.closest('.accent-switcher')) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const current = ACCENTS.find((a) => a.key === active) || ACCENTS[0];

  return (
    <div className="accent-switcher">
      <button
        type="button"
        className="header-icon-btn accent-trigger"
        title="Accent colour"
        aria-label="Accent colour"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="accent-dot" style={{ background: current.color }} aria-hidden="true" />
      </button>
      {open && (
        <div className="header-menu accent-menu">
          <p className="header-menu-title">
            <strong>Accent colour</strong>
            <span>Applies to your view only</span>
          </p>
          <div className="accent-swatches">
            {ACCENTS.map((accent) => (
              <button
                key={accent.key}
                type="button"
                className={`accent-swatch${active === accent.key ? ' active' : ''}`}
                style={{ background: accent.color }}
                title={accent.label}
                aria-label={accent.label}
                onClick={() => {
                  setActive(accent.key);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
