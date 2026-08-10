import React, { useState } from 'react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import Column from './Column';

const initialData = {
  columns: {
    'col-1': { id: 'col-1', title: 'Idea', cardIds: ['card-1', 'card-2'] },
    'col-2': { id: 'col-2', title: 'Scripting', cardIds: ['card-3', 'card-4'] },
    'col-3': { id: 'col-3', title: 'Recording', cardIds: [] },
    'col-4': { id: 'col-4', title: 'Editing', cardIds: ['card-5'] },
    'col-5': { id: 'col-5', title: 'Published', cardIds: [] },
  },
  cards: {
    'card-1': { id: 'card-1', title: 'Vlog: Day in the Life' },
    'card-2': { id: 'card-2', title: 'Review: New Camera Gear' },
    'card-3': { id: 'card-3', title: 'Tutorial: Editing tips' },
    'card-4': { id: 'card-4', title: 'Podcast Ep 12 Outline' },
    'card-5': { id: 'card-5', title: 'Shorts Compilation' },
  },
  columnOrder: ['col-1', 'col-2', 'col-3', 'col-4', 'col-5'],
};

// Mock API call for background optimistic updates
const mockApiUpdate = async (cardId, destinationCol) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`[API Mock] Successfully updated ${cardId} to column: ${destinationCol}`);
      resolve();
    }, 500);
  });
};

const Board = () => {
  const [data, setData] = useState(initialData);

  // Setup sensors, including keyboard for accessibility
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Find the starting column
    const startColumn = Object.values(data.columns).find(col =>
      col.cardIds.includes(activeId)
    );
    
    // Determine the finishing column
    let finishColumnId = overId;
    if (data.cards[overId]) {
      // if dropped over a card, find the column that card belongs to
      finishColumnId = Object.values(data.columns).find(col =>
        col.cardIds.includes(overId)
      ).id;
    }
    const finishColumn = data.columns[finishColumnId];

    if (!startColumn || !finishColumn) return;

    // Moving within the same column
    if (startColumn === finishColumn) {
      const newCardIds = Array.from(startColumn.cardIds);
      const oldIndex = newCardIds.indexOf(activeId);
      const newIndex = newCardIds.indexOf(overId);
      
      if (oldIndex !== newIndex) {
        newCardIds.splice(oldIndex, 1);
        if (newIndex === -1) {
          newCardIds.push(activeId);
        } else {
          newCardIds.splice(newIndex, 0, activeId);
        }
        
        setData(prev => ({
          ...prev,
          columns: {
            ...prev.columns,
            [startColumn.id]: {
              ...startColumn,
              cardIds: newCardIds
            }
          }
        }));
      }
      return;
    }

    // Moving between different columns
    const startCardIds = Array.from(startColumn.cardIds);
    startCardIds.splice(startCardIds.indexOf(activeId), 1);

    const finishCardIds = Array.from(finishColumn.cardIds);
    const newIndex = finishCardIds.indexOf(overId);
    
    if (newIndex === -1) {
       finishCardIds.push(activeId);
    } else {
       finishCardIds.splice(newIndex, 0, activeId);
    }

    // Optimistic UI update
    setData(prev => ({
      ...prev,
      columns: {
        ...prev.columns,
        [startColumn.id]: {
          ...startColumn,
          cardIds: startCardIds
        },
        [finishColumn.id]: {
          ...finishColumn,
          cardIds: finishCardIds
        }
      }
    }));

    // Trigger mock API update in the background
    mockApiUpdate(activeId, finishColumn.id).catch(console.error);
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f1f5f9', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h2 style={{ margin: '0 0 24px 0', color: '#1e293b' }}>Content Pipeline</h2>
      <div style={{ display: 'flex', overflowX: 'auto', paddingBottom: '16px' }}>
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          {data.columnOrder.map(columnId => {
            const column = data.columns[columnId];
            const cards = column.cardIds.map(cardId => data.cards[cardId]);
            return <Column key={column.id} id={column.id} title={column.title} cards={cards} />;
          })}
        </DndContext>
      </div>
    </div>
  );
};

export default Board;
