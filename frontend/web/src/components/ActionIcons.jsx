// Shared action icons for table action columns. Pair each with a data-tooltip
// (styled tooltip) + aria-label on an .icon-btn.
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
};

export function EyeIcon() {
  return (
    <svg {...base}>
      <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
export function EditIcon() {
  return (
    <svg {...base}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
export function PublishIcon() {
  return (
    <svg {...base}>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
      <path d="M5 21h14" />
    </svg>
  );
}
export function AssignIcon() {
  return (
    <svg {...base}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M18 8v6M21 11h-6" />
    </svg>
  );
}
export function ResultsIcon() {
  return (
    <svg {...base}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <rect x="7" y="10" width="3" height="6" />
      <rect x="12" y="6" width="3" height="10" />
      <rect x="17" y="13" width="3" height="3" />
    </svg>
  );
}
export function UsersIcon() {
  return (
    <svg {...base}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="8.5" r="2.6" />
      <path d="M15.5 13.2a5.5 5.5 0 0 1 6 6.8" />
    </svg>
  );
}
export function SuspendIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </svg>
  );
}
export function ActivateIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.3l2.4 2.4 4.6-5.2" />
    </svg>
  );
}
export function HistoryIcon() {
  return (
    <svg {...base}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 8v4l3 3" />
    </svg>
  );
}
export function ArchiveIcon() {
  return (
    <svg {...base}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </svg>
  );
}
