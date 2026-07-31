import { useEffect, useRef, useState } from 'react';
import ChangePasswordModal from './ChangePasswordModal.jsx';
import EditProfileModal from './EditProfileModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_LABELS } from '../utils/constants.js';

// Header profile menu — the clickable user chip opens a dropdown with the
// profile summary and account actions (Edit Profile, Change Password, Log Out).
export default function UserMenu({ onLogOut }) {
  const { user, role, company } = useAuth();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const initial = (user?.fullName || '?').charAt(0).toUpperCase();

  return (
    <div className="user-menu" ref={wrapRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        title="Account"
      >
        <span className="user-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="user-chip">
          <span className="user-chip-name">{user?.fullName}</span>
          <span className="user-chip-role">{ROLE_LABELS[role] || role}</span>
        </span>
        <span className={`chevron${open ? ' chevron-open' : ''}`} aria-hidden="true">
          ▼
        </span>
      </button>

      {open && (
        <div className="header-menu user-menu-dropdown">
          <div className="user-menu-head">
            <span className="user-avatar user-avatar-lg" aria-hidden="true">
              {initial}
            </span>
            <div className="user-menu-info">
              <strong>{user?.fullName}</strong>
              <span className="user-menu-email">{user?.email}</span>
              <span className="state-badge">{ROLE_LABELS[role] || role}</span>
            </div>
          </div>
          {company && <p className="user-menu-company">Viewing: {company.name}</p>}
          <div className="user-menu-actions">
            <button
              type="button"
              className="user-menu-item"
              onClick={() => {
                setEditOpen(true);
                setOpen(false);
              }}
            >
              <span aria-hidden="true">👤</span> Edit Profile
            </button>
            <button
              type="button"
              className="user-menu-item"
              onClick={() => {
                setPasswordOpen(true);
                setOpen(false);
              }}
            >
              <span aria-hidden="true">🔒</span> Change Password
            </button>
            <button
              type="button"
              className="user-menu-item user-menu-item-danger"
              onClick={() => {
                setOpen(false);
                onLogOut();
              }}
            >
              <span aria-hidden="true">↩</span> Log Out
            </button>
          </div>
        </div>
      )}

      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
