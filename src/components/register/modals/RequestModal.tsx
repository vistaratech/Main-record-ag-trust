import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Download, Trash2, ShieldCheck, AlertCircle } from 'lucide-react';
import { firebaseCreateRequest } from '../../../lib/firebaseAuth';
import { useAuth } from '../../../lib/auth';
import { useNotifications } from '../../../lib/NotificationContext';

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'download' | 'delete_register';
  registerName: string;
  registerId?: string | number;
  onSuccess?: () => void;
}

export function RequestModal({ isOpen, onClose, type, registerName, registerId, onSuccess }: RequestModalProps) {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!description.trim()) {
      addNotification({ title: 'Input Required', message: 'Please provide a reason for your request.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      await firebaseCreateRequest(String(user?.id || 'unknown'), user?.name || user?.email || 'User', {
        type,
        registerId: registerId?.toString(),
        registerName,
        description: description.trim()
      });

      addNotification({ 
        title: 'Request Sent', 
        message: `Your ${type.replace('_', ' ')} request for "${registerName}" has been sent to the administrator.`, 
        type: 'success' 
      });
      
      onSuccess?.();
      onClose();
      setDescription('');
    } catch (err: any) {
      addNotification({ title: 'Request Failed', message: err.message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 20000 }} onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          maxWidth: '440px', 
          width: '90%', 
          padding: 0, 
          overflow: 'hidden',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '20px 24px', 
          background: type === 'delete_register' ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'linear-gradient(135deg, var(--navy), #0f172a)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '10px' }}>
              {type === 'delete_register' ? <Trash2 size={20} /> : <Download size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {type === 'delete_register' ? 'Request Deletion' : 'Request Download'}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>Approval required from Admin</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.7 }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          <div style={{ 
            background: 'var(--surface)', 
            padding: '12px 16px', 
            borderRadius: '12px', 
            border: '1px solid var(--border)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <ShieldCheck size={18} color="var(--primary)" />
            <div style={{ fontSize: '13px', color: 'var(--navy)', fontWeight: 600 }}>
              {registerName}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px' }}>
              <AlertCircle size={14} /> Reason for Request
            </label>
            <textarea
              placeholder={type === 'delete_register' ? "Explain why this register needs to be deleted..." : "Explain why you need to download this register..."}
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1.5px solid var(--border)',
                fontSize: '14px',
                outline: 'none',
                resize: 'none',
                transition: 'border-color 0.2s',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5, background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <strong>Note:</strong> Your request will be reviewed by an administrator. You will receive a notification once it is approved or rejected.
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', color: 'var(--muted)', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || !description.trim()}
            style={{ 
              padding: '10px 24px', 
              borderRadius: '8px', 
              border: 'none', 
              background: type === 'delete_register' ? '#ef4444' : 'var(--navy)', 
              color: 'white', 
              cursor: 'pointer', 
              fontWeight: 700, 
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: (isSubmitting || !description.trim()) ? 0.6 : 1,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          >
            {isSubmitting ? 'Sending...' : 'Send Request'}
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
