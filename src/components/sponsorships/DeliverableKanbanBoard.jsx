import React, { useState } from 'react';

// Specialized Kanban columns mapping to a creator's actual sponsorship workflow
const KANBAN_COLUMNS = {
  contracting: { title: 'Contracting', color: '#6366f1' },
  production: { title: 'Production & Draft', color: '#3b82f6' },
  invoicing: { title: 'Awaiting Payment', color: '#f59e0b' },
  completed: { title: 'Completed', color: '#10b981' }
};

// Mock data representing active brand deals
const INITIAL_DEALS = [
  { id: 'deal_1', brand: 'TechGear', amount: 5000, status: 'contracting', deliverable: '60s Integration', dueDate: 'Oct 15', overdue: false },
  { id: 'deal_2', brand: 'NordVPN', amount: 8500, status: 'production', deliverable: 'Dedicated Video', dueDate: 'Oct 10', overdue: false },
  { id: 'deal_3', brand: 'FitLife', amount: 2500, status: 'invoicing', deliverable: 'TikTok Series', dueDate: 'Sept 25', overdue: true }, // Overdue invoice
  { id: 'deal_4', brand: 'CodeAcademy', amount: 12000, status: 'completed', deliverable: '3-Part Course', dueDate: 'Sept 10', overdue: false }
];

/**
 * DeliverableKanbanBoard
 * A drag-and-drop workflow system strictly designed for a Creator's sponsorship pipeline.
 * It tracks deliverables, automates invoice reminders, and stores contracts visually.
 */
export const DeliverableKanbanBoard = () => {
  const [deals, setDeals] = useState(INITIAL_DEALS);
  const [automationLog, setAutomationLog] = useState([]);

  // In a real app, this would use react-beautiful-dnd or dnd-kit.
  // For the mock, we simulate dropping a card to a new column.
  const handleDragStart = (e, dealId) => {
    e.dataTransfer.setData('dealId', dealId);
  };

  const handleDrop = (e, targetStatus) => {
    const dealId = e.dataTransfer.getData('dealId');
    const deal = deals.find(d => d.id === dealId);
    
    if (deal && deal.status !== targetStatus) {
      setDeals(deals.map(d => d.id === dealId ? { ...d, status: targetStatus } : d));
      
      // Simulate automation triggers based on column movement
      if (targetStatus === 'invoicing') {
        logAutomation(`Auto-generated and sent Net-30 invoice to ${deal.brand}.`);
      } else if (targetStatus === 'completed') {
        logAutomation(`Marked ${deal.brand} deal as closed. Synced $${deal.amount.toLocaleString()} to revenue dashboard.`);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Required to allow dropping
  };

  const logAutomation = (msg) => {
    setAutomationLog(prev => [{ id: Date.now(), text: msg, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
  };

  const handleSendReminder = (dealId) => {
    const deal = deals.find(d => d.id === dealId);
    logAutomation(`Sent polite automated follow-up email to ${deal.brand} accounting team regarding $${deal.amount.toLocaleString()} overdue invoice.`);
    
    // Simulate updating the UI to show reminder was sent
    setDeals(deals.map(d => d.id === dealId ? { ...d, reminderSent: true } : d));
  };

  // Group deals by their status column
  const dealsByColumn = Object.keys(KANBAN_COLUMNS).reduce((acc, statusKey) => {
    acc[statusKey] = deals.filter(deal => deal.status === statusKey);
    return acc;
  }, {});

  // Financial summary
  const totalPipeline = deals.filter(d => d.status !== 'completed').reduce((sum, d) => sum + d.amount, 0);
  const totalAwaiting = dealsByColumn['invoicing'].reduce((sum, d) => sum + d.amount, 0);

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Header & Financial Summary */}
      <div style={{ maxWidth: '1400px', margin: '0 auto 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', color: '#0f172a' }}>Sponsorship Pipeline</h2>
          <p style={{ margin: 0, color: '#64748b' }}>Automated deliverable tracking and invoice management.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '12px 24px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold', color: '#64748b' }}>Active Pipeline</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>${totalPipeline.toLocaleString()}</p>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '12px 24px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold', color: '#64748b' }}>Awaiting Payment</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>${totalAwaiting.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Main Kanban Board Layout */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '20px' }}>
        
        {Object.entries(KANBAN_COLUMNS).map(([statusKey, col]) => (
          <div 
            key={statusKey} 
            onDrop={(e) => handleDrop(e, statusKey)}
            onDragOver={handleDragOver}
            style={{ 
              flex: 1, minWidth: '300px', backgroundColor: '#e2e8f0', borderRadius: '12px', 
              padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' 
            }}
          >
            {/* Column Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', textTransform: 'uppercase', fontWeight: '700', color: col.color, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: col.color }} />
                {col.title}
              </h3>
              <span style={{ backgroundColor: '#cbd5e1', color: '#475569', fontSize: '12px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>
                {dealsByColumn[statusKey].length}
              </span>
            </div>

            {/* Render Cards in this Column */}
            {dealsByColumn[statusKey].map(deal => (
              <div 
                key={deal.id}
                draggable
                onDragStart={(e) => handleDragStart(e, deal.id)}
                style={{ 
                  backgroundColor: '#ffffff', borderRadius: '8px', padding: '16px', 
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', cursor: 'grab', 
                  border: deal.overdue ? '1px solid #ef4444' : '1px solid transparent',
                  borderLeft: `4px solid ${col.color}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>{deal.brand}</h4>
                  <span style={{ fontWeight: 'bold', color: '#334155' }}>${deal.amount.toLocaleString()}</span>
                </div>
                
                <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748b' }}>{deal.deliverable}</p>
                
                {/* Dynamic Footer based on status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: deal.overdue ? '#ef4444' : '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {deal.overdue ? '⚠️ Overdue' : '🗓️ Due'} {deal.dueDate}
                  </span>
                  
                  {/* Action buttons (e.g., automated follow up for overdue invoices) */}
                  {statusKey === 'invoicing' && deal.overdue && !deal.reminderSent && (
                    <button 
                      onClick={() => handleSendReminder(deal.id)}
                      style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Send Reminder
                    </button>
                  )}
                  {deal.reminderSent && (
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>Reminder Sent ✓</span>
                  )}
                </div>
              </div>
            ))}
            
            {/* Empty State Drop Zone Hint */}
            {dealsByColumn[statusKey].length === 0 && (
              <div style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: '500' }}>
                Drop deal here
              </div>
            )}
          </div>
        ))}
      </div>

      {/* System Automation Log */}
      <div style={{ maxWidth: '1400px', margin: '32px auto 0' }}>
        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: '#64748b', marginBottom: '12px' }}>System Automation Log</h3>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '16px', minHeight: '100px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {automationLog.length === 0 ? (
            <span style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>Listening for stage changes... Drag a card to trigger automations.</span>
          ) : (
            automationLog.map(log => (
              <div key={log.id} style={{ fontSize: '13px', color: '#334155', display: 'flex', gap: '12px' }}>
                <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>[{log.time}]</span>
                <span>⚡ {log.text}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default DeliverableKanbanBoard;
