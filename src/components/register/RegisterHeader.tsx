import { Bookmark, Download, Share2, X, MoreHorizontal, Trash2, Lock, Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { RequestModal } from './modals/RequestModal';
import { useAuth } from '../../lib/auth';
import { deleteRegister } from '../../lib/api';
import { useNavigate } from 'react-router-dom';

interface SavedTemplate {
  id: string;
  name: string;
  columns: Array<{ name: string; type: string; dropdownOptions?: string[]; formula?: string }>;
  createdAt: string;
}

interface RegisterHeaderProps {
  register: any;
  setShareModal: (open: boolean) => void;
  handleOpenExport: () => void;
  canDownload?: boolean;
  canEdit?: boolean;
  onViewReminders?: () => void;
}

export function RegisterHeader({ 
  register, 
  setShareModal, 
  handleOpenExport,
  canDownload = true,
  canEdit = true,
  onViewReminders
}: RegisterHeaderProps) {
  const [saveTemplateModal, setSaveTemplateModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [requestModal, setRequestModal] = useState<{ type: 'download' | 'delete_register'; isOpen: boolean }>({ type: 'download', isOpen: false });
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const templateInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = user?.role === 'superadmin';

  // Focus template name input when modal opens
  useEffect(() => {
    if (saveTemplateModal) {
      setTimeout(() => templateInputRef.current?.focus(), 80);
    }
  }, [saveTemplateModal]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);


  const handleSaveTemplate = () => {
    const name = templateName.trim();
    if (!name) {
      toast.error('Please enter a template name');
      return;
    }
    if (!register?.columns || register.columns.length === 0) {
      toast.error('No columns to save as template');
      return;
    }

    const template: SavedTemplate = {
      id: Date.now().toString(),
      name,
      columns: register.columns
        .sort((a: any, b: any) => a.position - b.position)
        .map((c: any) => ({
          name: c.name,
          type: c.type,
          ...(c.dropdownOptions?.length ? { dropdownOptions: c.dropdownOptions } : {}),
          ...(c.formula ? { formula: c.formula } : {}),
        })),
      createdAt: new Date().toISOString(),
    };

    // Save to localStorage
    const existing = JSON.parse(localStorage.getItem('rb_saved_templates') || '[]');
    existing.push(template);
    localStorage.setItem('rb_saved_templates', JSON.stringify(existing));

    toast.success(`Template "${name}" saved!`);
    setSaveTemplateModal(false);
    setTemplateName('');
    setShowMoreMenu(false);
  };

  const handleDeleteClick = async () => {
    if (isSuperAdmin) {
      if (window.confirm(`Are you sure you want to PERMANENTLY DELETE the register "${register?.name}"? This cannot be undone.`)) {
        try {
          await deleteRegister(register.id);
          toast.success('Register deleted successfully');
          navigate('/');
        } catch (err: any) {
          toast.error(`Failed to delete: ${err.message}`);
        }
      }
    } else {
      setRequestModal({ type: 'delete_register', isOpen: true });
    }
    setShowMoreMenu(false);
  };

  return (
    <div className="register-header-actions" ref={menuRef}>
      <button 
        className={`register-header-btn${showMoreMenu ? ' active' : ''}`} 
        onClick={() => setShowMoreMenu(!showMoreMenu)}
        title="More Actions"
      >
        <MoreHorizontal size={20} />
      </button>

      {showMoreMenu && (
        <div className="header-more-menu">
          <button className="more-menu-item" onClick={() => { setShareModal(true); setShowMoreMenu(false); }}>
            <Share2 size={16} />
            <span>Share Register</span>
          </button>
          
          <button 
            className="more-menu-item" 
            onClick={() => { 
              if (canDownload) handleOpenExport(); 
              else setRequestModal({ type: 'download', isOpen: true });
              setShowMoreMenu(false); 
            }}
          >
            {canDownload ? <Download size={16} /> : <Lock size={16} color="var(--primary)" />}
            <span style={{ color: canDownload ? 'inherit' : 'var(--primary)', fontWeight: canDownload ? 400 : 600 }}>
              {canDownload ? 'Download Options' : 'Request Download'}
            </span>
          </button>

          <button className="more-menu-item" onClick={() => { onViewReminders?.(); setShowMoreMenu(false); }}>
            <Bell size={16} />
            <span>View Reminders</span>
          </button>

          <button className="more-menu-item" onClick={() => { setTemplateName(register?.name || ''); setSaveTemplateModal(true); }}>
            <Bookmark size={16} />
            <span>Save as Template</span>
          </button>

          <div className="context-divider" style={{ margin: '4px 0' }} />
          
          <button className="more-menu-item danger" onClick={handleDeleteClick}>
            <Trash2 size={16} />
            <span>{isSuperAdmin ? 'Delete Register' : 'Request Deletion'}</span>
          </button>
        </div>
      )}

      {/* Save Template Modal */}
      {saveTemplateModal && (
        <div className="modal-backdrop" onClick={() => setSaveTemplateModal(false)}>
          <div className="save-template-modal" onClick={e => e.stopPropagation()}>
            <div className="save-template-header">
              <Bookmark size={18} />
              <h3>Save as Template</h3>
              <button className="save-template-close" onClick={() => setSaveTemplateModal(false)}>
                <X size={16} />
              </button>
            </div>
            <p className="save-template-desc">
              Save the current column structure as a reusable template.
            </p>
            <div className="save-template-preview">
              <span className="save-template-preview-label">Columns to save:</span>
              <div className="save-template-preview-cols">
                {register?.columns
                  ?.sort((a: any, b: any) => a.position - b.position)
                  .map((c: any) => (
                    <span key={c.id} className="save-template-col-chip">
                      {c.name}
                      <span className="save-template-col-type">{c.type}</span>
                    </span>
                  ))
                }
              </div>
            </div>
            <label className="save-template-label">Template Name</label>
            <input
              ref={templateInputRef}
              className="save-template-input"
              type="text"
              placeholder="e.g., Student Fee Collection"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveTemplate(); if (e.key === 'Escape') setSaveTemplateModal(false); }}
              maxLength={60}
            />
            <div className="save-template-actions">
              <button className="save-template-cancel" onClick={() => setSaveTemplateModal(false)}>Cancel</button>
              <button className="save-template-save" onClick={handleSaveTemplate}>
                <Bookmark size={14} /> Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Request Modal */}
      <RequestModal 
        isOpen={requestModal.isOpen}
        onClose={() => setRequestModal(prev => ({ ...prev, isOpen: false }))}
        type={requestModal.type}
        registerName={register?.name || 'Unknown Register'}
        registerId={register?.id}
      />
    </div>
  );
}

