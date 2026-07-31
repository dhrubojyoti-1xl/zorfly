// Sidebar promo card — the same design in every panel (tenant app and master
// admin) so the navigation rail is identical across roles. Copy and the
// destination differ per panel; the card itself never does.
function PlantArt() {
  return (
    <svg
      className="side-promo-art"
      width="42"
      height="48"
      viewBox="0 0 70 82"
      fill="none"
      aria-hidden="true"
    >
      <path d="M35 52V26" stroke="#3f8f6d" strokeWidth="3" strokeLinecap="round" />
      <path d="M35 34c0-9 6-16 14-18 1 10-5 17-14 18z" fill="#7cc79b" />
      <path d="M35 44c0-8-5-14-12-16-1 9 4 15 12 16z" fill="#5aad84" />
      <path d="M35 26c0-7 4-12 10-14 1 8-3 13-10 14z" fill="#a5dcb9" />
      <path d="M22 54h26l-3.5 20a3 3 0 0 1-3 2.5H28.5a3 3 0 0 1-3-2.5z" fill="#f0c98a" />
      <path d="M20 49h30v6H20z" fill="#f5d9a8" />
    </svg>
  );
}

export default function SidebarPromo({ text, ctaLabel, onClick }) {
  return (
    <div className="side-promo">
      <PlantArt />
      <span className="side-promo-text">{text}</span>
      <button type="button" className="side-promo-btn" onClick={onClick}>
        {ctaLabel} <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
