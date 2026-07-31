import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import VirtualizedList from '../advanced/VirtualizedList';

/**
 * ResizeHandle component to manage column width dragging.
 */
const ResizeHandle = ({ onResize, columnKey, currentWidth }) => {
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = currentWidth;
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const delta = e.clientX - startX.current;
      // Minimum column width is 60px to prevent completely hiding the column
      const newWidth = Math.max(60, startWidth.current + delta);
      onResize(columnKey, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      // Change global cursor while dragging to prevent cursor flicker
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.cursor = 'default';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isResizing, columnKey, onResize]);

  return (
    <div 
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        right: -2, // slightly overlap border for easier clicking
        top: 0,
        bottom: 0,
        width: '6px',
        cursor: 'col-resize',
        backgroundColor: isResizing ? '#3b82f6' : 'transparent',
        zIndex: 10,
        transition: 'background-color 0.1s'
      }}
      onMouseOver={(e) => { if (!isResizing) e.target.style.backgroundColor = '#94a3b8' }}
      onMouseOut={(e) => { if (!isResizing) e.target.style.backgroundColor = 'transparent' }}
    />
  );
};

/**
 * ResizableHeader component.
 */
const ResizableHeader = ({ column, width, onResize, onSort, sortConfigs }) => {
  // Determine if this column is currently being sorted
  const sortIndex = sortConfigs.findIndex(sc => sc.key === column.key);
  const sortConfig = sortIndex !== -1 ? sortConfigs[sortIndex] : null;

  return (
    <div style={{ 
      width: `${width}px`, 
      minWidth: `${width}px`, 
      maxWidth: `${width}px`, 
      position: 'relative',
      padding: '12px 16px',
      backgroundColor: '#f8fafc',
      borderRight: '1px solid #e2e8f0',
      borderBottom: '1px solid #e2e8f0',
      userSelect: 'none',
      boxSizing: 'border-box'
    }}>
      <div 
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={(e) => onSort(column.key, e.shiftKey)}
        title={column.title}
      >
        <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {column.title}
        </span>
        {sortConfig && (
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#3b82f6', marginLeft: '6px' }}>
            {sortConfig.direction === 'asc' ? '▲' : '▼'}
            {sortConfigs.length > 1 && <sub style={{ fontSize: '10px', marginLeft: '2px', fontWeight: 'bold' }}>{sortIndex + 1}</sub>}
          </span>
        )}
      </div>

      <ResizeHandle onResize={onResize} columnKey={column.key} currentWidth={width} />
    </div>
  );
};

/**
 * High-Performance DataGrid
 * Supports column resizing, multi-column sorting (via Shift+Click), inline filtering, 
 * and relies on the VirtualizedList component to safely render 10,000+ rows.
 * 
 * @param {Array} columns - Array of { key, title, initialWidth, filterable, render }
 * @param {Array} data - Array of row objects
 */
const DataGrid = ({ columns = [], data = [], height = 600, rowHeight = 44 }) => {
  // State for Column Widths
  const [columnWidths, setColumnWidths] = useState(() => {
    const widths = {};
    columns.forEach(c => widths[c.key] = c.initialWidth || 150);
    return widths;
  });

  // State for Sorting (Supports multiple columns)
  // Array of { key, direction: 'asc'|'desc' }
  const [sortConfigs, setSortConfigs] = useState([]);
  
  // State for Filtering
  const [filters, setFilters] = useState({});

  const handleResize = useCallback((key, newWidth) => {
    setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
  }, []);

  const handleSort = useCallback((key, isMulti) => {
    setSortConfigs(prev => {
      const existingIndex = prev.findIndex(sc => sc.key === key);
      let newConfigs = [...prev];

      if (!isMulti) {
        // Single sort mode: clear all other sort configs
        if (existingIndex === -1) {
          return [{ key, direction: 'asc' }];
        } else {
          // Toggle direction
          const nextDir = prev[existingIndex].direction === 'asc' ? 'desc' : null;
          return nextDir ? [{ key, direction: nextDir }] : [];
        }
      } else {
        // Multi-sort mode (Shift key was held)
        if (existingIndex === -1) {
          newConfigs.push({ key, direction: 'asc' });
        } else {
          if (newConfigs[existingIndex].direction === 'asc') {
            newConfigs[existingIndex].direction = 'desc';
          } else {
            // Remove from multi-sort array if it was desc
            newConfigs.splice(existingIndex, 1);
          }
        }
        return newConfigs;
      }
    });
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Client-side processing pipeline: Filter -> Sort
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Pipeline: Inline Filters
    const activeFilters = Object.entries(filters).filter(([k, v]) => v.trim() !== '');
    if (activeFilters.length > 0) {
      result = result.filter(row => {
        return activeFilters.every(([key, filterValue]) => {
          const cellValue = String(row[key] || '').toLowerCase();
          return cellValue.includes(filterValue.toLowerCase());
        });
      });
    }

    // 2. Pipeline: Multi-Column Sorting
    if (sortConfigs.length > 0) {
      result.sort((a, b) => {
        for (let config of sortConfigs) {
          const valA = a[config.key];
          const valB = b[config.key];
          
          if (valA === valB) continue;
          
          const isAsc = config.direction === 'asc';
          
          // Smart numeric comparison if both are numbers
          if (typeof valA === 'number' && typeof valB === 'number') {
            return isAsc ? valA - valB : valB - valA;
          } else {
            // String locale comparison
            const strA = String(valA || '');
            const strB = String(valB || '');
            const comp = strA.localeCompare(strB, undefined, { numeric: true });
            return isAsc ? comp : -comp;
          }
        }
        return 0; // completely equal
      });
    }

    return result;
  }, [data, filters, sortConfigs]);

  // Render function provided to the VirtualizedList component
  const renderRow = useCallback((row, index, style) => {
    return (
      <div 
        key={row.id || index} 
        style={{ 
          ...style, 
          display: 'flex', 
          borderBottom: '1px solid #f1f5f9',
          backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc', // Zebra striping
          boxSizing: 'border-box'
        }}
      >
        {columns.map(col => (
          <div 
            key={col.key}
            style={{
              width: `${columnWidths[col.key]}px`,
              minWidth: `${columnWidths[col.key]}px`,
              maxWidth: `${columnWidths[col.key]}px`,
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              borderRight: '1px solid #f1f5f9',
              boxSizing: 'border-box',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '14px',
              color: '#334155'
            }}
            title={String(row[col.key])} // Hover tooltip for truncated content
          >
            {col.render ? col.render(row[col.key], row) : row[col.key]}
          </div>
        ))}
      </div>
    );
  }, [columns, columnWidths]);

  // Calculate the total table width to manage the scrollable container correctly
  const totalWidth = columns.reduce((acc, col) => acc + (columnWidths[col.key] || 150), 0);

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', fontFamily: 'system-ui, sans-serif', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      
      {/* Scrollable Container mapping headers and the virtualized body to the same horizontal scroll context */}
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <div style={{ width: `${totalWidth}px` }}>
          
          {/* Main Headers with Resizers */}
          <div style={{ display: 'flex' }}>
            {columns.map(col => (
              <ResizableHeader 
                key={col.key}
                column={col}
                width={columnWidths[col.key]}
                onResize={handleResize}
                onSort={handleSort}
                sortConfigs={sortConfigs}
              />
            ))}
          </div>

          {/* Inline Filter Input Row */}
          <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', backgroundColor: '#f1f5f9' }}>
            {columns.map(col => (
              <div 
                key={`filter-${col.key}`}
                style={{
                  width: `${columnWidths[col.key]}px`,
                  minWidth: `${columnWidths[col.key]}px`,
                  maxWidth: `${columnWidths[col.key]}px`,
                  padding: '8px 12px',
                  borderRight: '1px solid #e2e8f0',
                  boxSizing: 'border-box'
                }}
              >
                {col.filterable !== false && (
                  <input
                    type="text"
                    placeholder={`Filter ${col.title}...`}
                    value={filters[col.key] || ''}
                    onChange={(e) => handleFilterChange(col.key, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      outlineColor: '#3b82f6'
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* The Virtualized Body Area */}
          <div style={{ position: 'relative', width: '100%' }}>
            <VirtualizedList 
              items={processedData}
              itemHeight={rowHeight}
              height={height}
              renderRow={renderRow}
            />
          </div>

        </div>
      </div>
      
      {/* Datagrid Footer Metadata */}
      <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #cbd5e1', fontSize: '13px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Showing <strong>{processedData.length}</strong> of <strong>{data.length}</strong> records</span>
        <span style={{ fontSize: '12px', fontStyle: 'italic' }}>Hold <kbd style={{ background: '#e2e8f0', padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>SHIFT</kbd> while clicking headers to multi-sort</span>
      </div>
    </div>
  );
};

export default DataGrid;
