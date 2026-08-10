import React, { useState, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * A highly optimized custom Virtualized List (Windowing) component 
 * that only renders the items currently visible in the viewport.
 */
const VirtualizedList = ({ 
  data, 
  itemHeight, 
  containerHeight, 
  renderRow, 
  overscan = 5 
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  // Calculate the total height of the scroll container dynamically
  const totalHeight = useMemo(() => data.length * itemHeight, [data.length, itemHeight]);

  // Determine the start and end indices of the items to render, including the overscan buffer
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    data.length - 1, 
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  );

  // Update the rendered slice of items strictly based on the scroll position
  const visibleItems = useMemo(() => {
    const items = [];
    for (let i = startIndex; i <= endIndex; i++) {
      // Ensure we have data at this index before rendering
      if (data[i] !== undefined) {
        items.push(
          <div
            key={i}
            style={{
              position: 'absolute',
              top: i * itemHeight,
              height: itemHeight,
              width: '100%',
            }}
          >
            {renderRow(data[i], i)}
          </div>
        );
      }
    }
    return items;
  }, [startIndex, endIndex, data, itemHeight, renderRow]);

  const handleScroll = (e) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: containerHeight,
        overflowY: 'auto',
        position: 'relative',
        willChange: 'transform' // Hardware acceleration hint for smoother scrolling
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems}
      </div>
    </div>
  );
};

VirtualizedList.propTypes = {
  data: PropTypes.array.isRequired,
  itemHeight: PropTypes.number.isRequired,
  containerHeight: PropTypes.number.isRequired,
  renderRow: PropTypes.func.isRequired,
  overscan: PropTypes.number,
};

export default VirtualizedList;
