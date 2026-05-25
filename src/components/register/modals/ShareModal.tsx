import { Link2, Copy, UserPlus, UserX } from 'lucide-react';

interface ShareModalProps {
  shareModal: boolean;
  setShareModal: (v: boolean) => void;
  register: any;
  sharePhone: string;
  setSharePhone: (v: string) => void;
  sharePermission: 'view' | 'edit';
  setSharePermission: (v: 'view' | 'edit') => void;
  shareLinkMutation: any;
  addSharedUserMutation: any;
  removeSharedUserMutation: any;
}

export function ShareModal({
  shareModal,
  setShareModal,
  register,
  sharePhone,
  setSharePhone,
  sharePermission,
  setSharePermission,
  shareLinkMutation,
  addSharedUserMutation,
  removeSharedUserMutation,
}: ShareModalProps) {
  if (!shareModal) return null;

  return (
    <div className="modal-overlay" onClick={() => setShareModal(false)}>
      <div className="modal-content modal-max-480" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Share Register</h3>

        {/* Share Link */}
        <div className="share-link-row">
          <div className="share-link-box">
            <Link2 size={14} />
            <span className="share-link-text">
              {register.shareLink || 'Generate a share link'}
            </span>
          </div>
          {register.shareLink ? (
            <button className="share-copy-btn" onClick={() => navigator.clipboard.writeText(register.shareLink!)}>
              <Copy size={12} /> Copy
            </button>
          ) : (
            <button className="share-copy-btn" onClick={() => shareLinkMutation.mutate()}>
              <Link2 size={12} /> Generate
            </button>
          )}
        </div>

        {/* Add user */}
        <label className="modal-label">Add Person</label>
        <div className="share-add-row">
          <input 
            className="modal-input share-phone-input" 
            aria-label="Phone number" 
            title="Phone number" 
            value={sharePhone} 
            onChange={(e) => setSharePhone(e.target.value)} 
            placeholder="Phone number" 
          />
          <select 
            className="modal-input share-perm-select" 
            aria-label="Permission Level" 
            title="Permission Level" 
            value={sharePermission} 
            onChange={(e) => setSharePermission(e.target.value as 'view' | 'edit')}
          >
            <option value="view">View</option>
            <option value="edit">Edit</option>
          </select>
          <button 
            className="modal-confirm-btn" 
            aria-label="Add User" 
            title="Add User" 
            onClick={() => sharePhone.trim() && addSharedUserMutation.mutate()}
          >
            <UserPlus size={14} />
          </button>
        </div>

        {/* Shared users */}
        {register.sharedWith && register.sharedWith.length > 0 && (
          <>
            <label className="modal-label shared-user-label">Shared With</label>
            {register.sharedWith.map((u: any) => (
              <div key={u.id} className="shared-user-row">
                <div className="shared-user-avatar">{u.name[0]}</div>
                <div className="shared-user-info-wrapper">
                  <div className="shared-user-name">{u.name}</div>
                  <div className="shared-user-phone">{u.phone} • {u.permission}</div>
                </div>
                <button 
                  className="share-remove-btn" 
                  aria-label="Remove User" 
                  title="Remove User" 
                  onClick={() => removeSharedUserMutation.mutate(u.id)}
                >
                  <UserX size={16} />
                </button>
              </div>
            ))}
          </>
        )}

        <button className="modal-cancel-btn modal-close-btn" onClick={() => setShareModal(false)}>Close</button>
      </div>
    </div>
  );
}
