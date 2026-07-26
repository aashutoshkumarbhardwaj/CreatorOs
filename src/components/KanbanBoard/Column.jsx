import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Card from './Card';

const Column = ({ id, title, cards }) => {
  const { setNodeRef } = useDroppable({
    id: id,
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        width: '320px',
        padding: '16px',
        margin: '0 16px 0 0',
        flexShrink: 0,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#475569' }}>
          {title}
        </h3>
        <span style={{ background: '#e2e8f0', color: '#64748b', fontSize: '12px', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
          {cards.length}
        </span>
      </div>

      <div ref={setNodeRef} style={{ flexGrow: 1, minHeight: '150px' }}>
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <Card key={card.id} id={card.id} title={card.title} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
};

export default Column;
