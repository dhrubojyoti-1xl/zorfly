import { useEffect, useRef, useState } from 'react';

// Font Size Module (header): a dropdown that scales the whole interface.
// Compact / Medium / Large presets, remembered across sessions.
const SIZES = [
  { key: 'compact', label: 'Compact', description: 'Denser layout', size: '0.85rem' },
  { key: 'medium', label: 'Medium', description: 'Default', size: '1rem' },
  { key: 'large', label: 'Large', description: 'Easier to read', size: '1.2rem' }
];

export default function FontSizeSwitcher() {
  const [active, setActive] = useState(() => localStorage.getItem('zorfly_font_size') || 'medium');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.fontSize = active;
    localStorage.setItem('zorfly_font_size', active);
  }, [active]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="font-size-switcher" ref={wrapRef}>
      <button
        type="button"
        className="header-icon-btn"
        title="Text size"
        aria-label="Text size"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="font-size-trigger" aria-hidden="true">
          <span className="fs-big">T</span>
          <span className="fs-small">t</span>
        </span>
      </button>

      {open && (
        <div className="header-menu font-size-menu">
          <div className="header-menu-title">
            <strong>Text Size</strong>
            <span>Scales the entire interface</span>
          </div>
          {SIZES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`font-size-option${active === s.key ? ' active' : ''}`}
              onClick={() => {
                setActive(s.key);
                setOpen(false);
              }}
            >
              <span className="fs-glyph" style={{ fontSize: s.size }}>
                A
              </span>
              <span className="fs-info">
                <span className="fs-label">{s.label}</span>
                <span className="fs-desc">{s.description}</span>
              </span>
              {active === s.key && <span className="fs-on">ON</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
