import { useState } from 'react';
import Button from './Button.jsx';
import Modal from './Modal.jsx';
import PasswordField from './PasswordField.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { validatePassword } from '../utils/validators.js';

export default function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const setField = (name) => (event) =>
    setForm((current) => ({ ...current, [name]: event.target.value }));

  const reset = () => {
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setErrors({});
  };

  const handleSave = async () => {
    const nextErrors = {
      currentPassword: form.currentPassword ? '' : 'Current Password is required.',
      newPassword: validatePassword(form.newPassword),
      confirmPassword:
        form.confirmPassword === form.newPassword
          ? ''
          : 'Confirm Password must match the New Password.'
    };
    if (!nextErrors.newPassword && form.newPassword === form.currentPassword) {
      nextErrors.newPassword = 'New Password must be different from the current password.';
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSaving(true);
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });
      toast.show(response.data.data.message, 'success');
      reset();
      onClose();
    } catch (error) {
      const parsed = apiError(error);
      setErrors(parsed.errors);
      toast.show(parsed.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Change Password"
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <PasswordField
        label="Current Password"
        name="currentPassword"
        value={form.currentPassword}
        onChange={setField('currentPassword')}
        error={errors.currentPassword}
        required
        autoComplete="current-password"
      />
      <PasswordField
        label="New Password"
        name="newPassword"
        value={form.newPassword}
        onChange={setField('newPassword')}
        error={errors.newPassword}
        required
        autoComplete="new-password"
      />
      <PasswordField
        label="Confirm Password"
        name="confirmPassword"
        value={form.confirmPassword}
        onChange={setField('confirmPassword')}
        error={errors.confirmPassword}
        required
        autoComplete="new-password"
      />
    </Modal>
  );
}
