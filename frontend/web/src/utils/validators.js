// Client-side validation mirroring the server rules (both layers are
// mandatory per the team QA standard). Messages are field-specific and
// end with a full stop.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'Email ID is required.';
  if (trimmed.length > 254) return 'Email ID must not exceed 254 characters.';
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid Email ID.';
  return '';
}

export function validatePassword(value, { forLogin = false } = {}) {
  if (!value) return 'Password is required.';
  if (!forLogin && value.length < 8) return 'Password must be at least 8 characters.';
  if (value.length > 72) return 'Password must not exceed 72 characters.';
  return '';
}

export function validateFullName(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'Full Name is required.';
  if (trimmed.length < 2) return 'Full Name must be at least 2 characters.';
  if (trimmed.length > 100) return 'Full Name must not exceed 100 characters.';
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(trimmed)) return 'Full Name must contain letters only.';
  return '';
}

export function validateContactNumber(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'Contact Number is required.';
  if (!/^\d{10,15}$/.test(trimmed)) return 'Enter a valid Contact Number.';
  return '';
}

export function validateCompanyName(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'Company Name is required.';
  if (trimmed.length < 2) return 'Company Name must be at least 2 characters.';
  if (trimmed.length > 100) return 'Company Name must not exceed 100 characters.';
  return '';
}

export function validateDepartmentName(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'Department Name is required.';
  if (trimmed.length < 2) return 'Department Name must be at least 2 characters.';
  if (trimmed.length > 100) return 'Department Name must not exceed 100 characters.';
  return '';
}
