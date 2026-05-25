import React from 'react';

interface CategoryCardProps {
  cat: {
    id: string;
    icon: string;
    name: string;
  };
  icon: any;
  count: number;
  onClick: () => void;
}

export function CategoryCard({ cat, icon: Icon, count, onClick }: CategoryCardProps) {
  return (
    <div className="category-card" onClick={onClick}>
      <div className={`category-icon bg-cat-${cat.id}`}>
        <Icon size={24} />
      </div>
      <div className="category-name">{cat.name}</div>
      <div className="category-count">{count} templates</div>
    </div>
  );
}
