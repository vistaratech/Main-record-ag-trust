import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { listBusinesses, createBusiness, createRegister, type RegisterSummary } from '../lib/api';
import { CATEGORIES, TEMPLATES, type Template, DEFAULT_BLANK_COLUMNS } from '../lib/templates';
import {
  ArrowLeft, FileText, Hash, Calendar, ChevronDown, FlaskConical, Type,
  Building, GraduationCap, Store, Bus, Warehouse, Package, CalendarIcon, HeartPulse,
  Utensils, Dumbbell, Building2, User, ShieldCheck, Leaf, Plane,
  Phone, Mail, Globe, Star, CheckSquare, Image, Plus
} from 'lucide-react';
import { useEffect } from 'react';

import { CategoryCard } from '../components/templates/CategoryCard';
import { TemplateModal } from '../components/templates/TemplateModal';

const ICON_MAP: Record<string, any> = {
  'building': Building, 'graduation-cap': GraduationCap, 'store': Store, 'bus': Bus,
  'warehouse': Warehouse, 'package': Package, 'calendar': CalendarIcon, 'heart-pulse': HeartPulse,
  'utensils': Utensils, 'dumbbell': Dumbbell, 'building-2': Building2, 'user': User,
  'shield-check': ShieldCheck, 'leaf': Leaf, 'plane': Plane, 'plus': Plus,
};

function getColTypeIcon(type: string) {
  switch (type) {
    case 'number':   return <Hash size={10} />;
    case 'date':     return <Calendar size={10} />;
    case 'dropdown': return <ChevronDown size={10} />;
    case 'formula':  return <FlaskConical size={10} />;
    case 'phone':    return <Phone size={10} />;
    case 'email':    return <Mail size={10} />;
    case 'url':      return <Globe size={10} />;
    case 'rating':   return <Star size={10} />;
    case 'checkbox': return <CheckSquare size={10} />;
    case 'image':    return <Image size={10} />;
    default:         return <Type size={10} />;
  }
}

export default function TemplatesPage() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryId || null);
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);

  const { data: businesses } = useQuery({ queryKey: ['businesses'], queryFn: listBusinesses });
  const businessId = businesses?.[0]?.id;

  useEffect(() => {
    if (businesses && businesses.length === 0) {
      createBusiness('My Business').then(() => queryClient.invalidateQueries({ queryKey: ['businesses'] }));
    }
  }, [businesses, queryClient]);

  const createMutation = useMutation({
    mutationFn: (tpl: Template) => {
      const cat = CATEGORIES.find((c) => c.id === selectedCategory);
      // Capture businessId at call time so onSuccess closure is never stale
      return createRegister({
        businessId: businessId!, name: tpl.name, icon: tpl.icon,
        iconColor: cat?.color, category: cat?.name || 'general', template: tpl.name,
        columns: tpl.columns.map((c) => ({ name: c.name, type: c.type, dropdownOptions: c.dropdownOptions, formula: c.formula })),
      });
    },
    onSuccess: (newReg) => {
      // Use newReg.businessId (always defined) instead of the outer businessId closure
      // which can be undefined if the businesses query hasn't resolved yet
      const bId = newReg.businessId;
      // Directly patch the register list cache — bypasses staleTime entirely
      queryClient.setQueryData(['registers', bId], (old: RegisterSummary[] | undefined) => {
        const safeOld = old || [];
        if (safeOld.find((r) => r.id === newReg.id)) return safeOld;
        return [...safeOld, {
          id: newReg.id, businessId: newReg.businessId, name: newReg.name,
          icon: newReg.icon, iconColor: newReg.iconColor,
          category: newReg.category, template: newReg.template,
          createdAt: newReg.createdAt, updatedAt: newReg.updatedAt,
          entryCount: newReg.entryCount ?? 0, lastActivity: '',
        }];
      });
      // Background refetch to sync server state (won't block navigation)
      queryClient.invalidateQueries({ queryKey: ['registers', bId] });
      navigate(`/register/${newReg.id}`);
    },
    onError: (err: any) => {
      alert(err.message || 'Error creating register');
      setCreatingTemplate(null);
    },
  });

  const categoryData = selectedCategory ? CATEGORIES.find((c) => c.id === selectedCategory) : null;
  const subTemplates = selectedCategory ? TEMPLATES[selectedCategory] || [] : [];

  return (
    <div className="templates-page-root content-area templates-page-scroll">
      {/* Header */}
      <div className="register-header">
        <button className="register-header-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="register-header-title">Choose a Template</h1>
      </div>

      {/* Category Grid */}
      <div className="templates-page-body">
        <h2 className="templates-heading">Select a Category</h2>
        <p className="templates-subheading">
          Pick a business type to see ready-made templates
        </p>
        <div className="categories-grid categories-grid--no-pad">
          {CATEGORIES.map((cat) => (
            <CategoryCard 
              key={cat.id} cat={cat} 
              icon={ICON_MAP[cat.icon] || FileText} 
              count={cat.id === 'blank' ? 0 : (TEMPLATES[cat.id] || []).length} 
              onClick={() => {
                if (cat.id === 'blank') {
                  if (!businessId) return;
                  setCreatingTemplate('Blank Register');
                  createMutation.mutate({
                    name: 'Blank Register',
                    columns: DEFAULT_BLANK_COLUMNS,
                    icon: 'file',
                    description: 'Start from scratch'
                  });
                } else {
                  setSelectedCategory(cat.id);
                }
              }} 
            />
          ))}
        </div>
      </div>

      {/* Template selection modal */}
      <TemplateModal 
        selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
        categoryData={categoryData} subTemplates={subTemplates}
        creatingTemplate={creatingTemplate}
        handleCreate={(tpl) => { 
          if (!businessId) return; // Prevent creation if businessId isn't loaded yet
          setCreatingTemplate(tpl.name); 
          createMutation.mutate(tpl); 
        }}
        getColTypeIcon={getColTypeIcon} ICON_MAP={ICON_MAP}
      />
    </div>
  );
}
