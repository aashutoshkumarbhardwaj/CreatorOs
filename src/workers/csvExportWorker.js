// src/workers/csvExportWorker.js

// Web worker to parse JSON array to CSV Blob without freezing the main UI thread
self.onmessage = function(e) {
  const { data } = e.data;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    self.postMessage({ error: 'Invalid data format or empty array provided.' });
    return;
  }

  try {
    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Push headers as the first row
    csvRows.push(headers.join(','));

    // Process all data rows
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header];
        
        // Handle nulls and undefined
        const stringVal = val === null || val === undefined ? '' : String(val);
        
        // Escape quotes and wrap the entire string in quotes if it contains a comma, quote, or newline
        if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
          return `"${stringVal.replace(/"/g, '""')}"`;
        }
        
        return stringVal;
      });
      csvRows.push(values.join(','));
    }

    // Join all rows with a newline character
    const csvString = csvRows.join('\n');
    
    // Create a Blob from the string
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    
    // Send the Blob back to the main thread
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
