import React from 'react';
import { 
  Type, Hash, Calendar, ChevronDown, FlaskConical, 
  IndianRupee, Mail, Phone, Globe, Star, 
  CheckSquare, Image as ImageIcon, ListOrdered,
  Link as LinkIcon
} from 'lucide-react';

interface ColumnIconProps {
  type?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const ColumnIcon: React.FC<ColumnIconProps> = ({ type, size = 16, className, style }) => {
  switch (type) {
    case 'number':
      return <Hash size={size} className={className} style={style} />;
    case 'currency':
      return <IndianRupee size={size} className={className} style={style} />;
    case 'date':
      return <Calendar size={size} className={className} style={style} />;
    case 'dropdown':
      return <ChevronDown size={size} className={className} style={style} />;
    case 'formula':
      return <FlaskConical size={size} className={className} style={style} />;
    case 'checkbox':
      return <CheckSquare size={size} className={className} style={style} />;
    case 'image':
      return <ImageIcon size={size} className={className} style={style} />;
    case 'email':
      return <Mail size={size} className={className} style={style} />;
    case 'phone':
      return <Phone size={size} className={className} style={style} />;
    case 'url':
      return <Globe size={size} className={className} style={style} />;
    case 'rating':
      return <Star size={size} className={className} style={style} />;
    case 'auto_increment':
      return <ListOrdered size={size} className={className} style={style} />;
    case 'link':
      return <LinkIcon size={size} className={className} style={style} />;
    default:
      return <Type size={size} className={className} style={style} />;
  }
};
