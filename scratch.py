import re

with open('view/dashboard.ejs', 'r') as f:
    content = f.read()

# Add a CSS link for the fonts inside <head>
font_link = '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">'
if font_link not in content:
    content = content.replace('</head>', font_link + '\n</head>')

# Wrap the current <section class="content"> with id="dashboard-view"
content = content.replace('<section class="content">', '<section class="content" id="dashboard-view">')

# Prepare settings view HTML
settings_html = """
            <section class="settings-content" id="settings-view" style="display: none;">
                <style>
                    /* Scoped Settings Styles */
                    #settings-view {
                        --settings-bg: #fcfbf7; 
                        --settings-sidebar: #f3efe6; 
                        --settings-border: #000000;
                        --settings-teal: #1abc9c;
                        --settings-yellow: #f1c40f;
                        --settings-blue: #74b9ff;
                        --settings-blue-badge: #00cec9;
                        --settings-darkgreen: #0b5345;
                        --settings-red-bg: #fadbd8;
                        --settings-red-text: #c0392b;
                        
                        font-family: 'Space Grotesk', sans-serif;
                        color: #000;
                        padding: 3rem;
                        background-color: var(--settings-bg);
                        min-height: 100%;
                    }
                    
                    #settings-view * {
                        box-sizing: border-box;
                    }

                    #settings-view .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 3rem;
                    }

                    #settings-view .header-title {
                        font-family: 'Playfair Display', serif;
                        font-size: 3rem;
                        margin: 0 0 0.5rem 0;
                    }

                    #settings-view .header-desc {
                        font-size: 1rem;
                        color: #333;
                        margin: 0;
                    }

                    #settings-view .user-badge {
                        display: flex;
                        align-items: center;
                        gap: 1rem;
                        background-color: var(--settings-blue);
                        border: 2px solid var(--settings-border);
                        padding: 0.5rem 1rem;
                        box-shadow: 4px 4px 0px var(--settings-border);
                    }

                    #settings-view .user-avatar {
                        width: 32px;
                        height: 32px;
                        background-color: #000;
                        border-radius: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: bold;
                        font-size: 0.8rem;
                    }

                    #settings-view .user-info {
                        display: flex;
                        flex-direction: column;
                    }

                    #settings-view .user-name {
                        font-weight: 700;
                        font-size: 0.9rem;
                    }

                    #settings-view .user-role {
                        font-size: 0.7rem;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }

                    #settings-view .content-layout {
                        display: grid;
                        grid-template-columns: 220px 1fr;
                        gap: 3rem;
                        align-items: start;
                    }

                    #settings-view .sub-nav {
                        display: flex;
                        flex-direction: column;
                        gap: 1rem;
                        position: sticky;
                        top: 2rem;
                    }

                    #settings-view .sub-nav-item {
                        padding: 0.8rem 1rem;
                        border: 2px solid var(--settings-border);
                        background-color: #fff;
                        font-weight: 600;
                        font-size: 0.9rem;
                        cursor: pointer;
                        box-shadow: 3px 3px 0px var(--settings-border);
                        text-decoration: none;
                        color: #000;
                        transition: transform 0.1s;
                    }
                    
                    #settings-view .sub-nav-item:active {
                        transform: translate(3px, 3px);
                        box-shadow: 0px 0px 0px var(--settings-border);
                    }

                    #settings-view .settings-sections {
                        display: flex;
                        flex-direction: column;
                        gap: 3rem;
                        max-width: 700px;
                    }

                    #settings-view .section-card {
                        background-color: #fff;
                        border: 2px solid var(--settings-border);
                        padding: 2.5rem;
                        box-shadow: 8px 8px 0px var(--settings-border);
                        position: relative;
                    }

                    #settings-view .section-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 2rem;
                    }

                    #settings-view .section-title {
                        font-family: 'Playfair Display', serif;
                        font-size: 2rem;
                        margin: 0;
                    }

                    #settings-view .badge-yellow {
                        background-color: var(--settings-yellow);
                        border: 2px solid #000;
                        padding: 0.3rem 0.8rem;
                        font-size: 0.7rem;
                        font-weight: 700;
                        text-transform: uppercase;
                        box-shadow: 2px 2px 0px #000;
                    }

                    #settings-view .badge-blue {
                        background-color: var(--settings-blue-badge);
                        border: 2px solid #000;
                        padding: 0.3rem 0.8rem;
                        font-size: 0.7rem;
                        font-weight: 700;
                        text-transform: uppercase;
                        box-shadow: 2px 2px 0px #000;
                    }

                    #settings-view .form-row {
                        display: flex;
                        gap: 1.5rem;
                        margin-bottom: 1.5rem;
                    }

                    #settings-view .form-group {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        gap: 0.5rem;
                    }

                    #settings-view .form-label {
                        font-size: 0.8rem;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        color: #000;
                    }

                    #settings-view .form-input, #settings-view .form-textarea {
                        padding: 0.8rem;
                        border: 2px solid var(--settings-border);
                        background-color: var(--settings-sidebar);
                        font-family: inherit;
                        font-size: 0.9rem;
                        width: 100%;
                        color: #000;
                    }
                    
                    #settings-view .form-input:focus, #settings-view .form-textarea:focus {
                        outline: none;
                        background-color: #fff;
                    }

                    #settings-view .form-textarea {
                        min-height: 100px;
                        resize: vertical;
                    }
                    
                    #settings-view .divider {
                        height: 2px;
                        background-color: var(--settings-border);
                        margin: 2rem 0;
                    }

                    #settings-view .btn-action {
                        background-color: var(--settings-teal);
                        color: #000;
                        border: 2px solid var(--settings-border);
                        padding: 0.8rem 1.5rem;
                        font-weight: 700;
                        font-family: inherit;
                        cursor: pointer;
                        box-shadow: 3px 3px 0px var(--settings-border);
                        display: inline-block;
                        text-align: center;
                        transition: transform 0.1s;
                    }
                    
                    #settings-view .btn-action:active {
                        transform: translate(3px, 3px);
                        box-shadow: 0px 0px 0px var(--settings-border);
                    }

                    #settings-view .btn-action-right {
                        float: right;
                    }

                    #settings-view .setting-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 1.5rem;
                        border: 2px solid var(--settings-border);
                        background-color: var(--settings-sidebar);
                        margin-bottom: 1rem;
                    }

                    #settings-view .setting-info h4 {
                        font-size: 1rem;
                        margin: 0 0 0.3rem 0;
                        color: #000;
                    }

                    #settings-view .setting-info p {
                        font-size: 0.85rem;
                        color: #555;
                        margin: 0;
                    }

                    #settings-view .toggle-switch {
                        width: 50px;
                        height: 26px;
                        background-color: var(--settings-teal);
                        border: 2px solid var(--settings-border);
                        position: relative;
                        cursor: pointer;
                    }

                    #settings-view .toggle-switch::after {
                        content: '';
                        position: absolute;
                        width: 14px;
                        height: 22px;
                        background-color: #000;
                        top: 0px;
                        right: 0px; 
                    }
                    
                    #settings-view .toggle-switch.off {
                        background-color: #ccc;
                    }
                    #settings-view .toggle-switch.off::after {
                        right: auto;
                        left: 0px;
                    }

                    #settings-view .btn-secondary {
                        background-color: #fff;
                        color: #000;
                        border: 2px solid var(--settings-border);
                        padding: 0.6rem 1.2rem;
                        font-weight: 700;
                        font-family: inherit;
                        cursor: pointer;
                        box-shadow: 2px 2px 0px var(--settings-border);
                        transition: transform 0.1s;
                    }
                    
                    #settings-view .btn-secondary:active {
                        transform: translate(2px, 2px);
                        box-shadow: 0px 0px 0px var(--settings-border);
                    }

                    #settings-view .danger-zone {
                        background-color: var(--settings-red-bg);
                        border: 2px solid var(--settings-border);
                        padding: 1.5rem;
                        margin-top: 1rem;
                    }
                    #settings-view .danger-title {
                        color: var(--settings-red-text);
                        font-size: 1rem;
                        margin: 0 0 0.5rem 0;
                    }
                    #settings-view .danger-text {
                        color: var(--settings-red-text);
                        font-size: 0.85rem;
                        margin: 0 0 1rem 0;
                    }

                    #settings-view .btn-danger {
                        color: var(--settings-red-text);
                        background: transparent;
                        border: none;
                        font-weight: 700;
                        font-size: 0.9rem;
                        cursor: pointer;
                        text-decoration: none;
                        display: inline-block;
                        padding: 0;
                    }
                    
                    #settings-view .btn-danger:hover {
                        text-decoration: underline;
                    }

                    /* Billing */
                    #settings-view .billing-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 1.5rem;
                        margin-bottom: 1.5rem;
                    }

                    #settings-view .billing-card {
                        border: 2px solid var(--settings-border);
                        padding: 1.5rem;
                        box-shadow: 6px 6px 0px var(--settings-border);
                        background-color: #fff;
                    }
                    
                    #settings-view .billing-card.active-plan {
                        background-color: var(--settings-sidebar);
                    }

                    #settings-view .billing-label {
                        font-size: 0.7rem;
                        text-transform: uppercase;
                        font-weight: 700;
                        letter-spacing: 1px;
                        margin-bottom: 1rem;
                        color: #555;
                    }

                    #settings-view .plan-name {
                        font-family: 'Playfair Display', serif;
                        font-size: 1.8rem;
                        margin: 0 0 0.5rem 0;
                    }

                    #settings-view .plan-price {
                        font-size: 1.8rem;
                        font-weight: 700;
                        color: var(--settings-darkgreen);
                        margin: 0 0 1.5rem 0;
                    }

                    #settings-view .plan-price span {
                        font-size: 1rem;
                        color: #333;
                    }

                    #settings-view .btn-black {
                        background-color: #000;
                        color: #fff;
                        border: 2px solid var(--settings-border);
                        padding: 0.8rem;
                        font-weight: 700;
                        cursor: pointer;
                        width: 100%;
                        transition: transform 0.1s;
                    }
                    #settings-view .btn-black:active {
                        transform: translate(2px, 2px);
                    }

                    #settings-view .invoice-date {
                        font-family: 'Playfair Display', serif;
                        font-size: 1.8rem;
                        margin: 0 0 0.5rem 0;
                    }

                    #settings-view .invoice-est {
                        font-size: 0.85rem;
                        color: #555;
                        margin: 0 0 1.5rem 0;
                    }

                    #settings-view .card-info {
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        font-size: 0.85rem;
                        font-weight: 600;
                    }

                    #settings-view .invoices-table {
                        width: 100%;
                        border-collapse: collapse;
                        border: 2px solid var(--settings-border);
                        background-color: #fff;
                        box-shadow: 6px 6px 0px var(--settings-border);
                    }

                    #settings-view .invoices-table th {
                        background-color: #000;
                        color: #fff;
                        text-align: left;
                        padding: 0.8rem 1rem;
                        font-size: 0.8rem;
                        text-transform: uppercase;
                    }

                    #settings-view .invoices-table td {
                        padding: 1rem;
                        border-bottom: 2px solid var(--settings-border);
                        border-right: 2px solid var(--settings-border);
                        font-size: 0.9rem;
                        font-weight: 500;
                        color: #000;
                    }

                    #settings-view .invoices-table td:last-child {
                        border-right: none;
                    }
                    
                    #settings-view .invoices-table tr:last-child td {
                        border-bottom: none;
                    }

                    #settings-view .badge-paid {
                        background-color: var(--settings-teal);
                        border: 2px solid #000;
                        padding: 0.2rem 0.5rem;
                        font-size: 0.7rem;
                        font-weight: 700;
                        text-transform: uppercase;
                    }

                    /* Global Preferences */
                    #settings-view .pref-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 3rem;
                        align-items: start;
                    }

                    #settings-view .pref-group {
                        margin-bottom: 1.5rem;
                    }

                    #settings-view .pref-label {
                        font-size: 0.7rem;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 1rem;
                        color: #000;
                    }

                    #settings-view .radio-group {
                        display: flex;
                        gap: 0.5rem;
                    }

                    #settings-view .radio-btn {
                        border: 2px solid var(--settings-border);
                        padding: 0.6rem 1rem;
                        font-weight: 600;
                        font-size: 0.85rem;
                        cursor: pointer;
                        background-color: #fff;
                        color: #000;
                        flex: 1;
                        text-align: center;
                    }

                    #settings-view .radio-btn.active {
                        background-color: var(--settings-teal);
                    }

                    #settings-view .pref-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 1rem 0;
                        border-bottom: 2px solid var(--settings-border);
                    }
                    
                    #settings-view .pref-row:first-child {
                        padding-top: 0;
                    }
                    
                    #settings-view .pref-row:last-child {
                        border-bottom: none;
                        padding-bottom: 0;
                    }

                    #settings-view .pref-row-label {
                        font-size: 0.9rem;
                        font-weight: 500;
                        color: #000;
                    }
                    
                    #settings-view .toggle-switch-small {
                        width: 40px;
                        height: 20px;
                        background-color: var(--settings-teal);
                        border: 2px solid var(--settings-border);
                        position: relative;
                        cursor: pointer;
                    }

                    #settings-view .toggle-switch-small::after {
                        content: '';
                        position: absolute;
                        width: 10px;
                        height: 16px;
                        background-color: #000;
                        top: 0px;
                        right: 0px; 
                    }
                    
                    #settings-view .toggle-switch-small.off {
                        background-color: #fff;
                    }
                    #settings-view .toggle-switch-small.off::after {
                        right: auto;
                        left: 0px;
                    }
                </style>

                <header class="header">
                    <div>
                        <h1 class="header-title">System Preferences</h1>
                        <p class="header-desc">Manage your workspace identity, security, and billing cycles.</p>
                    </div>
                    
                    <div class="user-badge">
                        <div class="user-avatar">
                            <%= user.initials %>
                        </div>
                        <div class="user-info">
                            <span class="user-name"><%= user.name %></span>
                            <span class="user-role">Pro Member</span>
                        </div>
                    </div>
                </header>

                <div class="content-layout">
                    <div class="sub-nav">
                        <a href="#profile" class="sub-nav-item">Profile Information</a>
                        <a href="#security" class="sub-nav-item">Security & Access</a>
                        <a href="#billing" class="sub-nav-item">Billing & Usage</a>
                        <a href="#global" class="sub-nav-item">Global Preferences</a>
                    </div>

                    <div class="settings-sections">
                        <!-- Profile Information -->
                        <div id="profile" class="section-card">
                            <div class="section-header">
                                <h2 class="section-title">Profile Information</h2>
                                <span class="badge-yellow">IDENTITY_MOD</span>
                            </div>
                            
                            <form id="profile-form">
                                <div class="form-row">
                                    <div class="form-group">
                                        <label class="form-label">Full Name</label>
                                        <input type="text" class="form-input" id="profile-name" value="<%= user.name %>">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Creator Alias</label>
                                        <input type="text" class="form-input" id="profile-alias" value="<%= user.alias %>">
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Bio / Description</label>
                                    <textarea class="form-textarea" id="profile-bio"><%= user.bio %></textarea>
                                </div>
                                
                                <div class="divider"></div>
                                
                                <button type="submit" class="btn-action btn-action-right">Update Profile</button>
                                <div style="clear: both;"></div>
                            </form>
                        </div>

                        <!-- Security & Access -->
                        <div id="security" class="section-card">
                            <div class="section-header">
                                <h2 class="section-title">Security & Access</h2>
                                <span class="badge-blue">ENCRYPTION_V3</span>
                            </div>
                            
                            <div class="setting-row">
                                <div class="setting-info">
                                    <h4>Two-Factor Authentication</h4>
                                    <p>Add an extra layer of security to your account.</p>
                                </div>
                                <div class="toggle-switch <%= user.twoFactorEnabled ? '' : 'off' %>" id="tfa-toggle"></div>
                            </div>
                            
                            <div class="setting-row">
                                <div class="setting-info">
                                    <h4>Password Management</h4>
                                    <p>Change your account password.</p>
                                </div>
                                <button class="btn-secondary" id="change-pwd-btn">Change Key</button>
                            </div>
                            <div id="pwd-form" style="display: none; margin-bottom: 1.5rem; background: #fff; padding: 1rem; border: 2px solid var(--settings-border);">
                                <div class="form-group" style="margin-bottom:1rem;">
                                    <label class="form-label">Old Password</label>
                                    <input type="password" id="old-pwd" class="form-input">
                                </div>
                                <div class="form-group" style="margin-bottom:1rem;">
                                    <label class="form-label">New Password</label>
                                    <input type="password" id="new-pwd" class="form-input">
                                </div>
                                <button class="btn-action" id="save-pwd-btn">Save Password</button>
                            </div>
                            
                            <div class="danger-zone">
                                <h4 class="danger-title">Danger Zone</h4>
                                <p class="danger-text">Deleting your account is permanent and cannot be undone.</p>
                                <button class="btn-danger" id="deactivate-btn">Deactivate Creator Instance</button>
                            </div>
                        </div>

                        <!-- Billing & Usage -->
                        <div id="billing">
                            <div class="billing-grid">
                                <div class="billing-card active-plan">
                                    <div class="billing-label">ACTIVE PLAN</div>
                                    <div class="plan-name">Pro Individual</div>
                                    <div class="plan-price">$29<span>/mo</span></div>
                                    <button class="btn-black">Manage Subscription</button>
                                </div>
                                
                                <div class="billing-card">
                                    <div class="billing-label">NEXT INVOICE</div>
                                    <div class="invoice-date">Oct 24, 2023</div>
                                    <div class="invoice-est">Estimated: $29.00 USD</div>
                                    <div class="card-info">
                                        <svg width="24" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="2" width="22" height="12" rx="2" ry="2"></rect><line x1="1" y1="7" x2="23" y2="7"></line></svg>
                                        VISA ending in 4242
                                    </div>
                                </div>
                            </div>
                            
                            <table class="invoices-table">
                                <thead>
                                    <tr>
                                        <th>DATE</th>
                                        <th>INVOICE ID</th>
                                        <th>AMOUNT</th>
                                        <th>STATUS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Sep 24, 2023</td>
                                        <td>#INV-88219</td>
                                        <td>$29.00</td>
                                        <td><span class="badge-paid">PAID</span></td>
                                    </tr>
                                    <tr>
                                        <td>Aug 24, 2023</td>
                                        <td>#INV-87112</td>
                                        <td>$29.00</td>
                                        <td><span class="badge-paid">PAID</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Global Preferences -->
                        <div id="global" class="section-card">
                            <div class="section-header">
                                <h2 class="section-title">Global Preferences</h2>
                            </div>
                            
                            <div class="pref-grid">
                                <div>
                                    <div class="pref-group">
                                        <div class="pref-label">APPEARANCE MODE</div>
                                        <div class="radio-group" id="appearance-group">
                                            <div class="radio-btn <%= user.preferences.appearanceMode === 'light' ? 'active' : '' %>" data-val="light">Light</div>
                                            <div class="radio-btn <%= user.preferences.appearanceMode === 'dark' ? 'active' : '' %>" data-val="dark">Dark</div>
                                            <div class="radio-btn <%= user.preferences.appearanceMode === 'system' ? 'active' : '' %>" data-val="system">System</div>
                                        </div>
                                    </div>
                                    
                                    <div class="pref-group">
                                        <div class="pref-label">INTERFACE DENSITY</div>
                                        <div class="radio-group" id="density-group">
                                            <div class="radio-btn <%= user.preferences.interfaceDensity === 'compact' ? 'active' : '' %>" data-val="compact">Compact</div>
                                            <div class="radio-btn <%= user.preferences.interfaceDensity === 'tactile' ? 'active' : '' %>" data-val="tactile">Tactile</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div>
                                    <div class="pref-row">
                                        <span class="pref-row-label">Motion Effects</span>
                                        <div class="toggle-switch-small pref-toggle <%= user.preferences.motionEffects ? '' : 'off' %>" data-key="motionEffects"></div>
                                    </div>
                                    <div class="pref-row">
                                        <span class="pref-row-label">Sound Cues</span>
                                        <div class="toggle-switch-small pref-toggle <%= user.preferences.soundCues ? '' : 'off' %>" data-key="soundCues"></div>
                                    </div>
                                    <div class="pref-row">
                                        <span class="pref-row-label">Auto-Save Links</span>
                                        <div class="toggle-switch-small pref-toggle <%= user.preferences.autoSaveLinks ? '' : 'off' %>" data-key="autoSaveLinks"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                    </div>
                </div>
            </section>
"""

content = content.replace('</main>', settings_html + '\n        </main>')

# Add JS logic to handle hash routing and settings forms
js_logic = """
<script>
    document.addEventListener('DOMContentLoaded', () => {
        const dashboardView = document.getElementById('dashboard-view');
        const settingsView = document.getElementById('settings-view');
        
        function handleRoute() {
            if (window.location.hash === '#settings') {
                dashboardView.style.display = 'none';
                settingsView.style.display = 'block';
                // Remove active from other nav items
                document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
                // Set settings nav item to active
                document.querySelector('a[href="#settings"]').classList.add('active');
            } else {
                settingsView.style.display = 'none';
                dashboardView.style.display = 'block';
            }
        }

        window.addEventListener('hashchange', handleRoute);
        handleRoute(); // Call on initial load
        
        // Settings sub-nav smooth scroll
        document.querySelectorAll('#settings-view .sub-nav-item').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            });
        });

        // Profile Form Submit
        document.getElementById('profile-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const res = await fetch('/api/settings/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: document.getElementById('profile-name').value,
                    alias: document.getElementById('profile-alias').value,
                    bio: document.getElementById('profile-bio').value,
                })
            });
            if (res.ok) alert('Profile updated successfully!');
            else alert('Error updating profile');
        });

        // 2FA Toggle
        const tfaToggle = document.getElementById('tfa-toggle');
        tfaToggle.addEventListener('click', async () => {
            const isEnabled = !tfaToggle.classList.contains('off');
            const res = await fetch('/api/settings/security/2fa', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !isEnabled })
            });
            if (res.ok) {
                tfaToggle.classList.toggle('off');
            }
        });

        // Password Change
        document.getElementById('change-pwd-btn').addEventListener('click', () => {
            document.getElementById('pwd-form').style.display = 'block';
        });
        document.getElementById('save-pwd-btn').addEventListener('click', async () => {
            const oldPassword = document.getElementById('old-pwd').value;
            const newPassword = document.getElementById('new-pwd').value;
            const res = await fetch('/api/settings/security/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPassword, newPassword })
            });
            if (res.ok) {
                alert('Password changed successfully');
                document.getElementById('pwd-form').style.display = 'none';
                document.getElementById('old-pwd').value = '';
                document.getElementById('new-pwd').value = '';
            } else {
                const text = await res.text();
                alert('Failed to change password: ' + text);
            }
        });

        // Account Deletion
        document.getElementById('deactivate-btn').addEventListener('click', async () => {
            if (confirm("Are you sure you want to deactivate your instance? This is permanent.")) {
                const res = await fetch('/api/settings/account', { method: 'DELETE' });
                if (res.ok) {
                    window.location.href = '/login';
                }
            }
        });

        // Global Preferences
        async function updatePreferences(prefs) {
            await fetch('/api/settings/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prefs)
            });
        }

        document.querySelectorAll('#appearance-group .radio-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#appearance-group .radio-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                updatePreferences({ appearanceMode: btn.getAttribute('data-val') });
            });
        });

        document.querySelectorAll('#density-group .radio-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#density-group .radio-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                updatePreferences({ interfaceDensity: btn.getAttribute('data-val') });
            });
        });

        document.querySelectorAll('.pref-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('off');
                const key = toggle.getAttribute('data-key');
                const val = !toggle.classList.contains('off');
                updatePreferences({ [key]: val });
            });
        });
    });
</script>
"""

content = content.replace('</body>', js_logic + '\n</body>')

with open('view/dashboard.ejs', 'w') as f:
    f.write(content)
