import { useNotifications } from '../../lib/NotificationContext';
import { X, Bell, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './NotificationPanel.css';

export function NotificationPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { notifications, markAsRead, clearAll } = useNotifications();
  const navigate = useNavigate();

  return (
    <>
      {isOpen && <div className="notification-overlay" onClick={onClose} />}
      <div className={`notification-panel ${isOpen ? 'open' : ''}`}>
        <div className="notification-header">
          <div className="notification-title">
            <Bell size={18} />
            <span>Notifications</span>
          </div>
          <div className="notification-actions">
            {notifications.length > 0 && (
              <button className="clear-btn" onClick={clearAll}>Clear All</button>
            )}
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="notification-list">
          {notifications.length === 0 ? (
            <div className="notification-empty">
              <Bell size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>No new notifications</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`notification-item ${notif.isRead ? 'read' : 'unread'}`}
                onClick={() => {
                  markAsRead(notif.id);
                  if (notif.link) {
                    navigate(`/register/${notif.link.registerId}`);
                    onClose();
                  }
                }}
              >
                <div className="notification-icon">
                  {notif.type === 'error' && <AlertCircle size={18} color="var(--danger)" />}
                  {notif.type === 'warning' && <AlertTriangle size={18} color="var(--warning)" />}
                  {notif.type === 'success' && <CheckCircle2 size={18} color="var(--success)" />}
                  {notif.type === 'info' && <Info size={18} color="var(--primary)" />}
                </div>
                <div className="notification-content">
                  <div className="notification-item-title">{notif.title}</div>
                  <div className="notification-item-message">{notif.message}</div>
                  <div className="notification-time">
                    {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {!notif.isRead && <div className="unread-dot" />}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
