// All buttons: visible border, hover highlight, pointer cursor, and a
// distinct disabled state (team QA standards). Destructive actions use
// variant="danger" (red).
export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  onClick,
  disabled = false,
  title,
  fullWidth = false
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}${fullWidth ? ' btn-block' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}
