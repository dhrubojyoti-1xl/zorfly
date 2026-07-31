import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

// Header notification bell: unread badge + dropdown list. Each row and the
// "View all" footer both go to the dedicated Notifications page — the popup
// is just a fast-glance preview, not where you read the full details.
export default function NotificationsBell() {
  const { company } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wrapRef = useRef(null);

  const load = useCallback(() => {
    api
      .get('/notifications', { params: { limit: 10 } })
      .then((response) => {
        setRows(response.data.data.rows);
        setUnreadCount(response.data.data.unreadCount);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [company?.id, load]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const openBell = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const goToNotifications = () => {
    setOpen(false);
    navigate('/app/notifications');
  };

  // Opening a specific notification marks just that one read (mirrors the
  // dedicated Notifications page) — the popup never bulk-marks everything
  // read on its own, so the unread badge stays meaningful until acted on.
  const openNotification = async (notification) => {
    if (!notification.read) {
      try {
        await api.patch(`/notifications/${notification.id}/read`);
      } catch {
        // Non-critical — still navigate even if the read-flag update fails.
      }
    }
    goToNotifications();
  };

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="bell-btn"
        onClick={openBell}
        title="Notifications"
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>
      {open && (
        <div className="bell-menu">
          {rows.length === 0 ? (
            <p className="company-switcher-empty">No notifications yet.</p>
          ) : (
            <>
              {rows.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  className={`bell-item${notification.read ? '' : ' unread'}`}
                  onClick={() => openNotification(notification)}
                >
                  <strong>{notification.title}</strong>
                  {notification.body && <p>{notification.body}</p>}
                  <span className="bell-time">
                    {new Date(notification.createdAt).toLocaleDateString('en-GB')}
                  </span>
                </button>
              ))}
              <button type="button" className="bell-view-all" onClick={goToNotifications}>
                View all notifications
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
