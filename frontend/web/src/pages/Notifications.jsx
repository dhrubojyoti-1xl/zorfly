import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import TrashIcon from '../components/TrashIcon.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' }
];

// Dedicated Notifications page — the bell popup is a fast-glance preview;
// this is where the full, untruncated title/body/timestamp lives, where a
// notification's link (e.g. a result, an assignment) is actually followed,
// and where read state (and the notifications themselves) can be managed
// directly (unlike the bell, opening this page does NOT silently mark
// everything read).
export default function Notifications() {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/notifications', { params: { page, limit, status, search } })
      .then((response) => {
        setRows(response.data.data.rows);
        setTotalCount(response.data.data.totalCount);
        setUnreadCount(response.data.data.unreadCount);
      })
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
  }, [page, limit, status, search, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = (next) => {
    setStatus(next);
    setPage(1);
  };

  const changeSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.patch('/notifications/read-all');
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setMarkingAll(false);
    }
  };

  const openNotification = async (notification) => {
    if (!notification.read) {
      try {
        await api.patch(`/notifications/${notification.id}/read`);
      } catch {
        // Non-critical — the row still opens even if the read-flag update fails.
      }
    }
    if (notification.link) navigate(notification.link);
    else load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/notifications/${deleteTarget.id}`);
      setDeleteTarget(null);
      // Deleting the last row on a page you're not on page 1 of would strand
      // you on an empty page — step back a page when that happens.
      if (rows.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Notifications</h2>
          <p className="page-subtitle">Everything Zorfly has sent you, most recent first.</p>
        </div>
        <Button
          variant="secondary"
          onClick={markAllRead}
          disabled={markingAll || unreadCount === 0}
        >
          {markingAll
            ? 'Marking…'
            : `Mark all as read${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
        </Button>
      </div>

      <div className="table-toolbar">
        <div className="view-toggle">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`view-toggle-btn${status === tab.value ? ' active' : ''}`}
              onClick={() => changeStatus(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="search-wrap">
          <input
            type="text"
            className="field-input search-input"
            placeholder="Search notifications"
            value={search}
            maxLength={100}
            onChange={(event) => changeSearch(event.target.value)}
          />
          {search && (
            <button
              type="button"
              className="search-clear"
              aria-label="Clear search"
              title="Clear search"
              onClick={() => changeSearch('')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="loading-text">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="company-switcher-empty">
            {search
              ? 'No notifications match your search.'
              : status === 'unread'
                ? 'No unread notifications.'
                : status === 'read'
                  ? 'No read notifications yet.'
                  : 'No notifications yet.'}
          </p>
        ) : (
          rows.map((notification) => (
            <div
              key={notification.id}
              className={`notif-entry-row${notification.read ? '' : ' unread'}`}
            >
              <button
                type="button"
                className="notif-entry clickable"
                onClick={() => openNotification(notification)}
              >
                <div className="notif-entry-head">
                  <span className="notif-entry-title">{notification.title}</span>
                  <span className="notif-entry-time">
                    {new Date(notification.createdAt).toLocaleString('en-GB')}
                  </span>
                </div>
                {notification.body && <p className="notif-entry-body">{notification.body}</p>}
                {notification.link && <span className="notif-entry-link">Open →</span>}
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-danger notif-entry-delete"
                data-tooltip="Delete"
                aria-label={`Delete notification: ${notification.title}`}
                onClick={() => setDeleteTarget(notification)}
              >
                <TrashIcon />
              </button>
            </div>
          ))
        )}

        {totalCount > limit && (
          <div className="table-footer">
            <span className="table-count">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, totalCount)} of {totalCount}
            </span>
            <div className="pager">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span className="pager-info">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Notification"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p>Are you sure you want to delete “{deleteTarget?.title}”? This can&apos;t be undone.</p>
      </Modal>
    </div>
  );
}
