import { Type, Hash, Calendar, ChevronDown, FlaskConical, Phone, Mail, Globe, Star, CheckSquare, Image, ListOrdered, IndianRupee } from 'lucide-react';
import React from 'react';

export const COL_TYPES = [
  { id: 'text',           label: 'Text',           icon: React.createElement(Type, { size: 12 }) },
  { id: 'number',         label: 'Number',         icon: React.createElement(Hash, { size: 12 }) },
  { id: 'auto_increment', label: 'Auto Increment', icon: React.createElement(ListOrdered, { size: 12 }) },
  { id: 'currency',       label: 'Currency (₹)',   icon: React.createElement(IndianRupee, { size: 12 }) },
  { id: 'date',           label: 'Date',           icon: React.createElement(Calendar, { size: 12 }) },
  { id: 'dropdown',       label: 'Dropdown',       icon: React.createElement(ChevronDown, { size: 12 }) },
  { id: 'formula',        label: 'Formula',        icon: React.createElement(FlaskConical, { size: 12 }) },
  { id: 'phone',          label: 'Phone',          icon: React.createElement(Phone, { size: 12 }) },
  { id: 'email',          label: 'Email',          icon: React.createElement(Mail, { size: 12 }) },
  { id: 'url',            label: 'URL',            icon: React.createElement(Globe, { size: 12 }) },
  { id: 'rating',         label: 'Rating',         icon: React.createElement(Star, { size: 12 }) },
  { id: 'checkbox',       label: 'Checkbox',       icon: React.createElement(CheckSquare, { size: 12 }) },
  { id: 'image',          label: 'Image',          icon: React.createElement(Image, { size: 12 }) },
];
