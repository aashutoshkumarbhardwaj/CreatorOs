// Sponsorship Calculator JavaScript

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('sponsorship-calculator-form');
    const resultsPanel = document.getElementById('results-panel');
    const emptyState = document.getElementById('empty-state');
    
    // Form submission handler
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Show loading state
        showLoading();
        
        // Collect form data
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Convert numeric values
        data.followers = parseInt(data.followers);
        data.avgViews = parseInt(data.avgViews);
        data.engagementRate = parseFloat(data.engagementRate);
        data.deliverables = parseInt(data.deliverables);
        data.campaignDuration = parseInt(data.campaignDuration);
        
        try {
            // Call API to calculate rate
            const response = await fetch('/api/sponsorship/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error('Failed to calculate rate');
            }
            
            const result = await response.json();
            
            // Display results
            displayResults(result);
            
        } catch (error) {
            console.error('Error calculating rate:', error);
            showError('Failed to calculate rate. Please try again.');
        }
    });
});

function showLoading() {
    const resultsSection = document.querySelector('.calculator-results-section');
    resultsSection.innerHTML = `
        <div class="panel-retro loading-state">
            <div class="loading-spinner"></div>
            <span>Calculating your sponsorship rate...</span>
        </div>
    `;
}

function showError(message) {
    const resultsSection = document.querySelector('.calculator-results-section');
    resultsSection.innerHTML = `
        <div class="panel-retro">
            <div class="error-state">
                ${message}
            </div>
            <div class="empty-state">
                <div class="empty-state-content">
                    <div class="empty-icon">⚠️</div>
                    <h3>Calculation Error</h3>
                    <p>There was an error calculating your rate. Please check your inputs and try again.</p>
                </div>
            </div>
        </div>
    `;
}

function displayResults(result) {
    const resultsSection = document.querySelector('.calculator-results-section');
    
    // Format currency values
    const formatCurrency = (value) => {
        return '₹' + value.toLocaleString();
    };
    
    // Build results HTML
    resultsSection.innerHTML = `
        <div class="panel-retro" id="results-panel">
            <div class="panel-retro-title-row">
                <h2>💵 Rate Estimation</h2>
                <span class="badge-retro">CALCULATED</span>
            </div>

            <!-- Main Rate Display -->
            <div class="rate-display">
                <div class="rate-range">
                    <div class="rate-item rate-min">
                        <span class="rate-label">Minimum Rate</span>
                        <span class="rate-value">${formatCurrency(result.minRate)}</span>
                    </div>
                    <div class="rate-item rate-recommended">
                        <span class="rate-label">Recommended Rate</span>
                        <span class="rate-value">${formatCurrency(result.recommendedRate)}</span>
                    </div>
                    <div class="rate-item rate-max">
                        <span class="rate-label">Maximum Rate</span>
                        <span class="rate-value">${formatCurrency(result.maxRate)}</span>
                    </div>
                </div>
            </div>

            <!-- Explanation -->
            <div class="explanation-section">
                <h3>📝 Rate Explanation</h3>
                <div class="explanation-content">
                    ${result.explanation}
                </div>
            </div>

            <!-- Pricing Breakdown -->
            <div class="breakdown-section">
                <h3>📊 Pricing Breakdown</h3>
                <div class="breakdown-table">
                    ${result.breakdown.map(item => `
                        <div class="breakdown-row ${item.isTotal ? 'total' : ''}">
                            <span class="breakdown-label">${item.label}</span>
                            <span class="breakdown-value">${formatCurrency(item.value)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="results-actions">
                <button type="button" class="crm-btn-secondary" onclick="exportResults()">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    Export Results
                </button>
                <button type="button" class="crm-btn-primary" onclick="addToCrm()">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                    Add to CRM
                </button>
            </div>
        </div>
    `;
    
    // Store result data for export/CRM functions
    window.currentCalculationResult = result;
}

function resetCalculator() {
    const form = document.getElementById('sponsorship-calculator-form');
    form.reset();
    
    const resultsSection = document.querySelector('.calculator-results-section');
    resultsSection.innerHTML = `
        <div class="panel-retro empty-state" id="empty-state">
            <div class="empty-state-content">
                <div class="empty-icon">🧮</div>
                <h3>Ready to Calculate Your Rate?</h3>
                <p>Fill in your creator metrics and campaign details to get an estimated sponsorship rate range.</p>
                <div class="empty-tips">
                    <p><strong>Tips for accurate results:</strong></p>
                    <ul>
                        <li>Use your average metrics from the last 30 days</li>
                        <li>Be specific about content type and deliverables</li>
                        <li>Consider usage rights impact on pricing</li>
                        <li>Higher engagement rates typically command higher rates</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
}

function exportResults() {
    if (!window.currentCalculationResult) {
        alert('No calculation results to export');
        return;
    }
    
    const result = window.currentCalculationResult;
    const form = document.getElementById('sponsorship-calculator-form');
    const formData = new FormData(form);
    const inputData = Object.fromEntries(formData.entries());
    
    // Create export content
    const exportContent = `
SPONSORSHIP RATE CALCULATION RESULTS
=====================================

CREATOR METRICS:
- Followers: ${inputData.followers}
- Average Views: ${inputData.avgViews}
- Engagement Rate: ${inputData.engagementRate}%
- Niche: ${inputData.niche}

CAMPAIGN DETAILS:
- Content Type: ${inputData.contentType}
- Deliverables: ${inputData.deliverables}
- Campaign Duration: ${inputData.campaignDuration} days
- Usage Rights: ${inputData.usageRights}
- Exclusivity: ${inputData.exclusivity}

RATE ESTIMATION:
- Minimum Rate: ₹${result.minRate.toLocaleString()}
- Recommended Rate: ₹${result.recommendedRate.toLocaleString()}
- Maximum Rate: ₹${result.maxRate.toLocaleString()}

PRICING BREAKDOWN:
${result.breakdown.map(item => `- ${item.label}: ₹${item.value.toLocaleString()}`).join('\n')}

EXPLANATION:
${result.explanation}

Generated by CreatorOS Sponsorship Calculator
Date: ${new Date().toLocaleDateString()}
    `;
    
    // Create and download file
    const blob = new Blob([exportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sponsorship-rate-calculation.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function addToCrm() {
    if (!window.currentCalculationResult) {
        alert('No calculation results to add to CRM');
        return;
    }
    
    const result = window.currentCalculationResult;
    const form = document.getElementById('sponsorship-calculator-form');
    const formData = new FormData(form);
    const inputData = Object.fromEntries(formData.entries());
    
    // Create CRM deal data
    const dealData = {
        companyName: 'Calculated Sponsorship',
        dealName: `${inputData.contentType.charAt(0).toUpperCase() + inputData.contentType.slice(1)} Campaign - ${inputData.deliverables} Deliverables`,
        category: inputData.niche.charAt(0).toUpperCase() + inputData.niche.slice(1),
        stage: 'lead',
        amount: result.recommendedRate,
        deliverables: `${inputData.deliverables} ${inputData.contentType}(s)`,
        notes: `Rate calculated via Sponsorship Calculator. Range: ₹${result.minRate.toLocaleString()} - ₹${result.maxRate.toLocaleString()}. Usage rights: ${inputData.usageRights}, Exclusivity: ${inputData.exclusivity}`
    };
    
    // Send to CRM API
    fetch('/api/crm/deals', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(dealData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Successfully added calculated deal to CRM!');
            // Optionally redirect to CRM
            // window.location.href = '/creator-crm';
        } else {
            alert('Failed to add to CRM: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error adding to CRM:', error);
        alert('Failed to add to CRM. Please try again.');
    });
}