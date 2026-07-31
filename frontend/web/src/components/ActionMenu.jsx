import { useEffect, useRef, useState } from 'react';

const PANEL_WIDTH = 200;

// Reusable "⋮" row-action menu. The panel is `position: fixed`, positioned
// from the trigger's own getBoundingClientRect() rather than CSS-anchored
// inside the row — DataTable's `.table-wrap` is `overflow-x: auto`, which
// would otherwise clip a dropdown opened near the table's edge.
export default function ActionMenu({ items }) {
  const visibleItems = (items || []).filter(Boolean);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8)
    );
    setCoords({ top: rect.bottom + 6, left });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (event) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target) &&
        panelRef.current &&
        !panelRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    // Scroll (including inside .table-wrap) would drift the fixed panel away
    // from its trigger — just close it instead of trying to re-track it.
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  if (visibleItems.length === 0) return null;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="icon-btn action-menu-trigger"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="6" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="18" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          className="action-menu-panel"
          ref={panelRef}
          style={{ top: coords.top, left: coords.left, width: PANEL_WIDTH }}
          role="menu"
        >
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`action-menu-item${item.danger ? ' danger' : ''}`}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {Icon && (
                  <span className="action-menu-item-icon" aria-hidden="true">
                    <Icon />
                  </span>
                )}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
