import { useEffect, useState } from 'react';
import Button from './Button.jsx';
import Modal from './Modal.jsx';
import TextField from './TextField.jsx';
import { api, apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { validateContactNumber, validateFullName } from '../utils/validators.js';

// Edit own profile (name + contact number). Email is immutable.
export default function EditProfileModal({ open, onClose }) {
  const { user, loadSession } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ fullName: '', contactNumber: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      setForm({ fullName: user.fullName || '', contactNumber: user.contactNumber || '' });
      setErrors({});
    }
  }, [open, user]);

  const handleSave = async () => {
    const nextErrors = {
      fullName: validateFullName(form.fullName),
      contactNumber: form.contactNumber ? validateContactNumber(form.contactNumber) : ''
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setSaving(true);
    try {
      const response = await api.patch('/auth/profile', {
        fullName: form.fullName.trim(),
        contactNumber: form.contactNumber.trim()
      });
      toast.show(response.data.data.message, 'success');
      await loadSession();
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
      title="Edit Profile"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <TextField
        label="Full Name"
        name="profileName"
        value={form.fullName}
        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        error={errors.fullName}
        required
        maxLength={100}
      />
      <div className="field">
        <label className="field-label" htmlFor="profileEmail">
          Email ID
        </label>
        <input
          id="profileEmail"
          type="email"
          className="field-input"
          value={user?.email || ''}
          readOnly
          disabled
        />
      </div>
      <TextField
        label="Contact Number"
        name="profileContact"
        value={form.contactNumber}
        onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
        error={errors.contactNumber}
        maxLength={15}
        inputMode="numeric"
      />
    </Modal>
  );
}
