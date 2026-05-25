import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowLeft, Calendar, FileText, Link as LinkIcon, Pencil, Plus, RotateCcw, Settings, Trash2, User } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { listBusinesses, listHistory, type HistoryEntry } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function HistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: businesses } = useQuery({ queryKey: ['businesses'], queryFn: listBusinesses });
  const businessId = businesses?.[0]?.id;

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const { data: history, isLoading, isError, error } = useQuery({
    queryKey: ['history', businessId],
    queryFn: () => listHistory(businessId!),
    enabled: !!businessId,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: 1,
  });

  const filteredHistory = React.useMemo(() => {
    if (!history) return [];
    if (isAdmin) return history;

    // Filter history for current user
    return history.filter(entry => {
      // Match by userId or userEmail first
      if (entry.userId && user?.id && String(entry.userId) === String(user.id)) return true;
      if (entry.userEmail && user?.email && entry.userEmail.toLowerCase() === user.email.toLowerCase()) return true;
      
      // Fallback to userName matching if neither ID nor Email is present in log entry (for older logs)
      if (!entry.userId && !entry.userEmail && entry.userName && user?.name && entry.userName.toLowerCase() === user.name.toLowerCase()) return true;
      
      return false;
    });
  }, [history, isAdmin, user]);

  return (
    <div className="history-page">
      <div className="history-header">
        <button className="back-button" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </button>
        <div className="header-title-group">
          <h1 className="header-title">History</h1>
          <p className="header-subtitle">
            {isAdmin 
              ? 'All changes and actions made across registers by all users' 
              : 'Your personal changes and actions made across registers'}
          </p>
        </div>
      </div>

      <div className="history-content">
        {isLoading ? (
          <div className="loading-state">
            <Activity size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>Loading history...</p>
          </div>
        ) : isError ? (
          <div className="empty-state" style={{ color: '#ef4444' }}>
            <Activity size={48} className="empty-icon" />
            <p style={{ fontWeight: 600 }}>Failed to load history</p>
            <p style={{ fontSize: 13, marginTop: 4, color: '#64748b' }}>
              {(error as any)?.message || 'An unknown error occurred. Check your internet connection.'}
            </p>
          </div>
        ) : !filteredHistory || filteredHistory.length === 0 ? (
          <div className="empty-state">
            <Activity size={48} className="empty-icon" />
            <p>No history recorded yet.</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Actions like adding rows, creating registers, and editing data will appear here.</p>
          </div>
        ) : (
          <div className="history-timeline">
            {filteredHistory.map((entry: HistoryEntry) => {
              const { icon, color, bg } = getActionStyle(entry.action);
              return (
                <div key={entry.id} className="history-card">
                  <div className="history-card-icon">
                    <div className="icon-circle" style={{ borderColor: color, background: bg }}>
                      <span style={{ color }}>{icon}</span>
                    </div>
                    <div className="timeline-connector" />
                  </div>
                  <div className="history-card-main">
                    <div className="history-card-header">
                      <span className="action-badge" style={{ background: bg, color }}>
                        {entry.action}
                      </span>
                      <span className="timestamp">
                        <Calendar size={12} />
                        {new Intl.DateTimeFormat('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        }).format(new Date(entry.timestamp))}
                      </span>
                    </div>
                    <p className="history-details">{entry.details}</p>
                    <div className="history-meta">
                      {entry.userName && (
                        <span className="meta-item">
                          <User size={12} />
                          {entry.userName}
                        </span>
                      )}
                      {entry.registerName && (
                        <span className="meta-item">
                          <FileText size={12} />
                          {entry.registerName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .history-page {
          flex: 1;
          background: #f8fafc;
          height: 100vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .history-header {
          background: white;
          padding: 24px 32px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 20px;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .back-button {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          color: #64748b;
        }

        .back-button:hover {
          background: #f1f5f9;
          color: var(--navy);
          border-color: var(--navy);
        }

        .header-title-group .header-title {
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }

        .header-title-group .header-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 4px 0 0;
        }

        .history-content {
          padding: 32px;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }

        .history-timeline {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .history-card {
          display: flex;
          gap: 24px;
        }

        .history-card-icon {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex-shrink: 0;
        }

        .icon-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: white;
          border: 2px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
          flex-shrink: 0;
        }

        .timeline-connector {
          flex: 1;
          width: 2px;
          background: #e2e8f0;
          margin: 4px 0;
          min-height: 20px;
        }

        .history-card:last-child .timeline-connector {
          display: none;
        }

        .history-card-main {
          flex: 1;
          background: white;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #e2e8f0;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .history-card-main:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }

        .history-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .action-badge {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .timestamp {
          font-size: 12px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .history-details {
          font-size: 15px;
          color: #1e293b;
          line-height: 1.5;
          margin: 0 0 16px;
        }

        .history-meta {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          border-top: 1px solid #f1f5f9;
          padding-top: 12px;
        }

        .meta-item {
          font-size: 12px;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .loading-state, .empty-state {
          text-align: center;
          padding: 60px 0;
          color: #64748b;
        }

        .empty-icon {
          margin-bottom: 16px;
          opacity: 0.3;
        }
      `}</style>
    </div>
  );
}

function getActionStyle(action: string): { icon: React.ReactNode; color: string; bg: string } {
  const a = action.toLowerCase();
  if (a.includes('add row') || a.includes('create')) return { icon: <Plus size={16} />, color: '#10b981', bg: '#ecfdf5' };
  if (a.includes('delete')) return { icon: <Trash2 size={16} />, color: '#ef4444', bg: '#fef2f2' };
  if (a.includes('rename') || a.includes('edit')) return { icon: <Pencil size={16} />, color: '#3b82f6', bg: '#eff6ff' };
  if (a.includes('link')) return { icon: <LinkIcon size={16} />, color: '#8b5cf6', bg: '#f5f3ff' };
  if (a.includes('restore')) return { icon: <RotateCcw size={16} />, color: '#f59e0b', bg: '#fffbeb' };
  if (a.includes('column') || a.includes('type')) return { icon: <Settings size={16} />, color: '#8b5cf6', bg: '#f5f3ff' };
  return { icon: <Activity size={16} />, color: '#64748b', bg: '#f1f5f9' };
}
