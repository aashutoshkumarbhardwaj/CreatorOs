import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const Card = ({ id, title }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    padding: '16px',
    margin: '0 0 12px 0',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: isDragging 
      ? '0 8px 16px rgba(0,0,0,0.1)' 
      : '0 2px 4px rgba(0,0,0,0.05)',
    cursor: 'grab',
    border: '1px solid #e2e8f0',
    fontWeight: '500',
    color: '#334155'
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      aria-label={`Draggable card: ${title}`}
    >
      {title}
    </div>
  );
};

export default Card;
