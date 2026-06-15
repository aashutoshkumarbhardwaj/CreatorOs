const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, '..', 'view');
const partialsDir = path.join(viewsDir, 'partials', 'layout');

if (!fs.existsSync(partialsDir)) {
    fs.mkdirSync(partialsDir, { recursive: true });
}

// 1. Create the sidebar partial based on the extracted dashboard layout
const sidebarContent = `<aside class="sidebar" id="sidebar" aria-label="Dashboard navigation">
    <a class="brand" href="/dashboard">
        <span class="brand-mark">CO</span>
        <div>
            <span class="brand-text">CreatorOS</span>
            <span class="brand-version">v2.0 Beta</span>
        </div>
    </a>

    <!-- Workspace section -->
    <nav class="sidebar-section">
        <p class="sidebar-label">Workspace</p>
        <a class="nav-link <%= typeof activeNav !== 'undefined' && activeNav === 'dashboard' ? 'active' : '' %>" href="/dashboard">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            <span class="nav-text">Dashboard</span>
        </a>
        <a class="nav-link <%= typeof activeNav !== 'undefined' && activeNav === 'my-links' ? 'active' : '' %>" href="/services/url-shortener">
            <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4.9"></path><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 19.1"></path></svg>
            <span class="nav-text">My Links</span>
        </a>
        <a class="nav-link <%= typeof activeNav !== 'undefined' && activeNav === 'analytics' ? 'active' : '' %>" href="/services/analytics-dashboard">
            <svg viewBox="0 0 24 24"><path d="M4 19V5"></path><path d="M9 19V9"></path><path d="M14 19V3"></path><path d="M19 19v-7"></path></svg>
            <span class="nav-text">Analytics</span>
        </a>
       
        <a class="nav-link <%= typeof activeNav !== 'undefined' && activeNav === 'settings' ? 'active' : '' %>" href="/settings">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 20.4a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 3.6l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15Z"></path></svg>
            <span class="nav-text">Settings</span>
        </a>
    </nav>

    <!-- Services section -->
    <nav class="sidebar-section" aria-label="Services">
        <p class="sidebar-label">Services</p>
        <% if (typeof services !== 'undefined' && services && services.length) { %>
            <% services.forEach((service) => { %>
                <a class="service-link <%= typeof activeNav !== 'undefined' && activeNav === service.route ? 'active' : '' %> <%= service.status %>" href="<%= service.route %>" title="<%= service.name %>">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><%- service.svgPath || '<path d="M12 3v18"></path><path d="M3 12h18"></path>' %></svg>
                    <span class="service-name"><%= service.name %></span>
                </a>
            <% }) %>
        <% } %>
    </nav>

    <div class="sidebar-footer" style="margin-top: auto;">
        <div class="upgrade-box">
            <h4>Upgrade Plan</h4>
            <p style="font-size: 0.9rem;">Get access to advanced webhooks & APIs.</p>
            <button class="upgrade-btn" type="button">Upgrade</button>
        </div>
        <a class="nav-link" href="/logout">
            <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"></path></svg>
            <span class="nav-text">Logout</span>
        </a>
    </div>
</aside>`;

fs.writeFileSync(path.join(partialsDir, 'sidebar.ejs'), sidebarContent, 'utf8');

// 2. Create the topbar partial
const topbarContent = `<header class="topbar">
    <button class="menu-btn" type="button" aria-label="Toggle sidebar" id="sidebarToggle">
        <svg viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"></path></svg>
    </button>

    <div class="search-container">
        <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
        <input type="text" id="search-links-input" class="search-input" placeholder="Search shortened links..." />
    </div>

    <div class="topbar-actions">
        <button id="theme-toggle" class="action-icon-btn" type="button" aria-label="Toggle Theme">
            <svg class="icon-light" width="20" height="20" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin:auto;"><path d="M7.5 1.5V2.5M7.5 12.5V13.5M1.5 7.5H2.5M12.5 7.5H13.5M3.257 3.257L3.964 3.964M11.035 11.035L11.742 11.742M3.257 11.742L3.964 11.035M11.035 3.964L11.742 3.257" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/><circle cx="7.5" cy="7.5" r="2.75" stroke="currentColor" stroke-width="1.5"/></svg>
            <svg class="icon-dark" width="20" height="20" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin:auto; display:none;"><path d="M1.66 7.452C1.66 10.67 4.268 13.278 7.485 13.278C10.02 13.278 12.18 11.65 12.987 9.388C12.103 10.199 10.899 10.706 9.57 10.706C6.884 10.706 4.706 8.528 4.706 5.842C4.706 4.542 5.193 3.364 5.976 2.493C3.541 3.195 1.66 5.128 1.66 7.453Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </button>
        <button class="action-icon-btn" type="button"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"></path></svg></button>
        <a class="profile-chip" href="/profile">
            <span class="avatar"><%= typeof user !== 'undefined' ? user.initials : 'U' %></span>
            <span class="profile-name"><%= typeof user !== 'undefined' ? user.name : 'User' %></span>
        </a>
        <a class="primary-action-btn" href="/services/url-shortener">
            <svg viewBox="0 0 24 24" style="width:1.25rem; height:1.25rem; stroke:currentColor; stroke-width:2.5; fill:none;"><path d="M12 5v14M5 12h14"></path></svg>
            Create Link
        </a>
    </div>
</header>`;

fs.writeFileSync(path.join(partialsDir, 'topbar.ejs'), topbarContent, 'utf8');

// 3. Create scripts partial
const scriptsContent = `<script>
    document.addEventListener('DOMContentLoaded', () => {
        // Theme Toggle Logic
        const themeBtn = document.getElementById('theme-toggle');
        const root = document.documentElement;
        const iconLight = themeBtn ? themeBtn.querySelector('.icon-light') : null;
        const iconDark = themeBtn ? themeBtn.querySelector('.icon-dark') : null;
        
        function applyTheme(isDark) {
            if (isDark) {
                root.setAttribute('data-theme', 'dark');
                if (iconLight) iconLight.style.display = 'none';
                if (iconDark) iconDark.style.display = 'block';
            } else {
                root.removeAttribute('data-theme');
                if (iconLight) iconLight.style.display = 'block';
                if (iconDark) iconDark.style.display = 'none';
            }
        }

        if (themeBtn) {
            if (localStorage.getItem('theme') === 'dark') {
                applyTheme(true);
            } else {
                applyTheme(false);
            }

            themeBtn.addEventListener('click', () => {
                const isDark = root.getAttribute('data-theme') === 'dark';
                applyTheme(!isDark);
                localStorage.setItem('theme', !isDark ? 'dark' : 'light');
                window.dispatchEvent(new Event('themeChanged'));
            });
        }

        // Sidebar Mobile Toggle
        const sidebarBtn = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        if(sidebarBtn) {
            sidebarBtn.addEventListener('click', () => {
                sidebar.classList.toggle('show');
            });
        }
    });
</script>`;

fs.writeFileSync(path.join(partialsDir, 'scripts.ejs'), scriptsContent, 'utf8');

console.log('Created layout partials successfully.');

// 4. Update the files
function getActiveNav(file) {
    if (file.includes('dashboard')) return 'dashboard';
    if (file.includes('analytics-dashboard') || file.includes('analytics')) return 'analytics';
    if (file.includes('creator-crm')) return 'crm';
    if (file.includes('dm-automation')) return 'dm-automation';
    if (file.includes('settings')) return 'settings';
    if (file.includes('my-links')) return 'my-links';
    if (file.includes('suggestions')) return 'suggestions';
    if (file.includes('vault')) return 'vault';
    if (file.includes('home')) return 'home';
    return '';
}

const filesToProcess = fs.readdirSync(viewsDir)
    .filter(f => f.endsWith('.ejs') || f.endsWith('.html'))
    .map(f => path.join(viewsDir, f));

filesToProcess.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Replace Sidebar
    // Match either <aside class="sidebar"...>...</aside> or <!-- Sidebar --> ... </aside>
    content = content.replace(/(?:<!-- Sidebar -->\s*)?<aside class="sidebar"[\s\S]*?<\/aside>/i, 
        `<%- include('partials/layout/sidebar', { activeNav: '${getActiveNav(file)}' }) %>`);

    // Replace Topbar
    content = content.replace(/(?:<!-- Topbar -->\s*)?<header class="topbar"[\s\S]*?<\/header>/i, 
        `<%- include('partials/layout/topbar', { user: typeof user !== 'undefined' ? user : { initials: 'U', name: 'User' } }) %>`);

    // Replace Scripts block if present (Theme Toggle & Sidebar Mobile Toggle)
    // Some files have it wrapped in DOMContentLoaded, some don't.
    // The easiest way is to match from "// Theme Toggle Logic" up to "// Sidebar Mobile Toggle" block
    
    // We can't safely strip it out via simple regex because of nested braces, so let's match the exact string chunks.
    const scriptBlockRegex = /\s*\/\/\s*Theme Toggle Logic[\s\S]*?\/\/\s*Sidebar Mobile Toggle[\s\S]*?\}\);\s*\}\n/i;
    content = content.replace(scriptBlockRegex, '');
    
    // In files like dashboard.ejs, after removing the script, we should inject the partial right before </body>
    // Actually, better to inject `<%- include('partials/layout/scripts') %>` at the bottom of the body.
    if (original.match(scriptBlockRegex) || original.includes('Theme Toggle Logic')) {
        // If the file had it, add the partial before closing body if it's not already there
        if (!content.includes('partials/layout/scripts')) {
            content = content.replace(/<\/body>/i, `    <%- include('partials/layout/scripts') %>\n</body>`);
        }
    } else {
         // Even if it didn't have it explicitly, it might need it if it uses the layout
         if (content.includes('partials/layout/sidebar') && !content.includes('partials/layout/scripts')) {
             content = content.replace(/<\/body>/i, `    <%- include('partials/layout/scripts') %>\n</body>`);
         }
    }

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${path.basename(file)}`);
    }
});
