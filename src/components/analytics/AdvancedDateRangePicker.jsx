import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  subDays,
  startOfYear,
  isBefore,
  isAfter
} from 'date-fns';
// Note: In production, ensure `date-fns-tz` is installed to handle advanced timezone math
// import { formatInTimeZone, utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

const TIMEZONES = [
  'UTC', 
  'America/New_York', 
  'America/Los_Angeles', 
  'Europe/London', 
  'Asia/Tokyo', 
  'Australia/Sydney'
];

const PRESETS = [
  { label: 'Today', getValue: () => [new Date(), new Date()] },
  { label: 'Yesterday', getValue: () => [subDays(new Date(), 1), subDays(new Date(), 1)] },
  { label: 'Last 7 Days', getValue: () => [subDays(new Date(), 6), new Date()] },
  { label: 'Last 30 Days', getValue: () => [subDays(new Date(), 29), new Date()] },
  { label: 'This Year', getValue: () => [startOfYear(new Date()), new Date()] },
];

/**
 * Internal single-month Calendar component.
 */
const Calendar = ({ currentMonth, startDate, endDate, onDateClick }) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDateOfWeek = startOfWeek(monthStart);
  const endDateOfWeek = endOfWeek(monthEnd);

  const rows = [];
  let days = [];
  let day = startDateOfWeek;

  while (day <= endDateOfWeek) {
    for (let i = 0; i < 7; i++) {
      const formattedDate = format(day, "d");
      const cloneDay = day;
      
      let isSelected = false;
      let isInRange = false;
      
      if (startDate && isSameDay(day, startDate)) isSelected = true;
      if (endDate && isSameDay(day, endDate)) isSelected = true;
      if (startDate && endDate && isAfter(day, startDate) && isBefore(day, endDate)) isInRange = true;

      const isCurrentMonth = isSameMonth(day, monthStart);

      days.push(
        <div 
          key={day.toISOString()} 
          onClick={() => onDateClick(cloneDay)}
          style={{ 
            padding: '8px', 
            margin: '2px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isSelected ? '#3b82f6' : isInRange ? '#dbeafe' : 'transparent',
            color: isSelected ? '#ffffff' : !isCurrentMonth ? '#cbd5e1' : '#334155',
            borderRadius: isSelected ? '6px' : '0',
            fontWeight: isSelected ? 'bold' : 'normal',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => {
            if (!isSelected && !isInRange) e.currentTarget.style.backgroundColor = '#f1f5f9';
          }}
          onMouseOut={(e) => {
            if (!isSelected && !isInRange) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {formattedDate}
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(<div key={day.toISOString()} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>{days}</div>);
    days = [];
  }

  return (
    <div style={{ width: '260px' }}>
      <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '16px', color: '#1e293b' }}>
        {format(currentMonth, "MMMM yyyy")}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', fontWeight: 'bold', textAlign: 'center', marginBottom: '8px', color: '#64748b', fontSize: '12px' }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d}>{d}</div>)}
      </div>
      {rows}
    </div>
  );
};

const AdvancedDateRangePicker = ({ onChange }) => {
  const [currentMonthLeft, setCurrentMonthLeft] = useState(new Date());
  const [currentMonthRight, setCurrentMonthRight] = useState(addMonths(new Date(), 1));
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [timezone, setTimezone] = useState('UTC');

  const handleDateClick = (day) => {
    // If no start date, or both dates exist, start a new selection
    if (!startDate || (startDate && endDate) || isBefore(day, startDate)) {
      setStartDate(day);
      setEndDate(null);
    } else {
      // Validate that end date is strictly after or equal to start date
      setEndDate(day);
      if (onChange) {
         onChange({ startDate, endDate: day, timezone });
      }
    }
  };

  const applyPreset = (preset) => {
    const [start, end] = preset.getValue();
    setStartDate(start);
    setEndDate(end);
    
    // Shift calendars to view the newly selected start date
    setCurrentMonthLeft(start);
    setCurrentMonthRight(addMonths(start, 1));
    
    if (onChange) {
       onChange({ startDate: start, endDate: end, timezone });
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonthLeft(subMonths(currentMonthLeft, 1));
    setCurrentMonthRight(subMonths(currentMonthRight, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthLeft(addMonths(currentMonthLeft, 1));
    setCurrentMonthRight(addMonths(currentMonthRight, 1));
  };

  return (
    <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', width: 'fit-content', fontFamily: 'sans-serif', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      
      {/* Sidebar Presets */}
      <div style={{ width: '160px', borderRight: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: '12px 0' }}>
        <h4 style={{ margin: '0 0 12px 16px', color: '#64748b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Presets</h4>
        {PRESETS.map((preset, idx) => (
          <div 
            key={idx} 
            onClick={() => applyPreset(preset)}
            style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px', color: '#334155', fontWeight: '500', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#e2e8f0'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            {preset.label}
          </div>
        ))}
      </div>

      {/* Main Dual-Calendar Area */}
      <div style={{ padding: '24px', backgroundColor: '#ffffff' }}>
        
        {/* Header / Timezone Select */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>Timezone:</span>
             <select 
                value={timezone} 
                onChange={(e) => {
                  setTimezone(e.target.value);
                  if (onChange && startDate && endDate) onChange({ startDate, endDate, timezone: e.target.value });
                }}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', cursor: 'pointer', fontSize: '13px', color: '#334155' }}
             >
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
             </select>
          </div>
          
          <div style={{ fontSize: '14px', color: '#334155', fontWeight: '600', backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '6px' }}>
            {startDate ? format(startDate, 'MMM d, yyyy') : 'Start Date'} 
            {' — '} 
            {endDate ? format(endDate, 'MMM d, yyyy') : 'End Date'}
          </div>
        </div>

        {/* Calendars */}
        <div style={{ display: 'flex', gap: '40px' }}>
          <div style={{ position: 'relative' }}>
             <button onClick={handlePrevMonth} style={{ position: 'absolute', top: 0, left: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}>&lt;</button>
             <Calendar currentMonth={currentMonthLeft} startDate={startDate} endDate={endDate} onDateClick={handleDateClick} />
          </div>
          <div style={{ position: 'relative' }}>
             <button onClick={handleNextMonth} style={{ position: 'absolute', top: 0, right: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}>&gt;</button>
             <Calendar currentMonth={currentMonthRight} startDate={startDate} endDate={endDate} onDateClick={handleDateClick} />
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdvancedDateRangePicker;
