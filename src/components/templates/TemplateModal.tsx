import React from 'react';
import { X, FileText, Eye, type LucideIcon } from 'lucide-react';
import { type Template } from '../../lib/templates';

interface TemplateModalProps {
  selectedCategory: string | null;
  setSelectedCategory: (id: string | null) => void;
  categoryData: any;
  subTemplates: Template[];
  creatingTemplate: string | null;
  handleCreate: (tpl: Template) => void;
  getColTypeIcon: (type: string) => React.ReactNode;
  ICON_MAP: Record<string, LucideIcon>;
}

export function TemplateModal(props: TemplateModalProps) {
  const {
    selectedCategory, setSelectedCategory, categoryData, subTemplates,
    creatingTemplate, handleCreate, getColTypeIcon, ICON_MAP
  } = props;

  if (!selectedCategory) return null;

  const HeaderIcon = ICON_MAP[categoryData?.icon || ''] || FileText;

  return (
    <div className="modal-overlay" onClick={() => setSelectedCategory(null)}>
      <div className="modal-content modal-content--tpl" onClick={(e) => e.stopPropagation()}>
        <div className={`template-modal-header bg-cat-${categoryData?.id || 'default'}`}>
          <div className="template-modal-header-icon">
            <HeaderIcon size={24} />
          </div>
          <div>
            <div className="template-modal-header-title">{categoryData?.name} Templates</div>
            <div className="template-modal-header-sub">Choose a layout to get started</div>
          </div>
          <button 
            className="template-modal-close" 
            title="Close" 
            aria-label="Close" 
            onClick={() => setSelectedCategory(null)}
          >
            <X size={20} />
          </button>
        </div>

        {subTemplates.map((tpl, idx) => (
          <div key={idx} className="tpl-card">
            <div className="tpl-card-header">
              <FileText size={22} color={categoryData?.color || 'var(--navy)'} />
              <div>
                <div className="tpl-name">{tpl.name}</div>
                <div className="tpl-desc">{tpl.description}</div>
              </div>
            </div>
            {tpl.columns.length > 0 && (
              <div className="tpl-chips">
                {tpl.columns.slice(0, 5).map((col, i) => (
                  <span key={i} className="tpl-chip">{getColTypeIcon(col.type)} {col.name}</span>
                ))}
                {tpl.columns.length > 5 && <span className="tpl-chip">+{tpl.columns.length - 5} more</span>}
              </div>
            )}
            <button
              className="tpl-use-btn"
              onClick={() => handleCreate(tpl)}
              disabled={!!creatingTemplate}
            >
              {creatingTemplate === tpl.name ? (
                <div className="spinner" />
              ) : (
                <>
                  <Eye size={14} /> Preview & Use
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
