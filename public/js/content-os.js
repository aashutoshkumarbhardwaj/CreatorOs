/**
 * CreatorOS - Content OS Client-Side Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    let contentItems = [];
    let contentFolders = [];
    let activeScriptItem = null;
    let selectedTagFilter = '';
    let currentCalDate = new Date();
    let currentCalView = 'month'; // 'month' | 'week' | 'day'

    // DOM Elements
    const tabBtns = document.querySelectorAll('.os-tab-btn');
    const viewSections = document.querySelectorAll('.os-view-section');
    const searchInput = document.getElementById('os-search-input');
    const filterPlatform = document.getElementById('os-filter-platform');
    const filterFolder = document.getElementById('os-filter-folder');

    // Modals
    const modalItemBackdrop = document.getElementById('modal-item-backdrop');
    const modalTemplatesBackdrop = document.getElementById('modal-templates-backdrop');
    const modalFolderBackdrop = document.getElementById('modal-folder-backdrop');

    // Initialize Workspace
    init();

    async function init() {
        setupTabListeners();
        setupEventListeners();

        // Check if tab parameter is in URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tab') === 'calendar') {
            switchTab('calendar');
        }

        await loadWorkspaceData();
    }

    function setupTabListeners() {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                viewSections.forEach(sec => {
                    if (sec.id === `view-${targetTab}`) {
                        sec.classList.add('active');
                    } else {
                        sec.classList.remove('active');
                    }
                });

                if (targetTab === 'calendar') renderCalendar();
            });
        });
    }

    function setupEventListeners() {
        // Filters & Search
        if (searchInput) searchInput.addEventListener('input', renderAllViews);
        if (filterPlatform) filterPlatform.addEventListener('change', renderAllViews);
        if (filterFolder) filterFolder.addEventListener('change', renderAllViews);

        // Modals Open/Close
        document.getElementById('btn-open-new-item')?.addEventListener('click', () => openItemModal());
        document.getElementById('btn-open-ai-modal')?.addEventListener('click', () => switchTab('ai'));
        document.getElementById('btn-create-folder-modal')?.addEventListener('click', () => openFolderModal());
        document.getElementById('btn-cal-quick-create')?.addEventListener('click', () => {
            openItemModal({ status: 'scheduled', scheduledAt: new Date() });
        });

        document.getElementById('modal-item-close')?.addEventListener('click', closeItemModal);
        document.getElementById('modal-item-cancel')?.addEventListener('click', closeItemModal);
        document.getElementById('modal-templates-close')?.addEventListener('click', () => toggleModal(modalTemplatesBackdrop, false));
        document.getElementById('modal-folder-close')?.addEventListener('click', () => toggleModal(modalFolderBackdrop, false));
        document.getElementById('modal-folder-cancel')?.addEventListener('click', () => toggleModal(modalFolderBackdrop, false));

        // Form Submissions
        document.getElementById('form-item-save')?.addEventListener('submit', handleSaveItem);
        document.getElementById('form-folder-save')?.addEventListener('submit', handleSaveFolder);
        document.getElementById('ai-generate-form')?.addEventListener('submit', handleGenerateAi);

        // Multi-Platform & Formatting advice listeners
        document.querySelectorAll('.platform-checkbox').forEach(chk => {
            chk.addEventListener('change', updatePlatformTips);
        });
        document.getElementById('modal-input-description')?.addEventListener('input', updateCaptionCharCounter);

        // Team Comment submission
        document.getElementById('btn-post-comment')?.addEventListener('click', handlePostComment);

        // Script Studio
        document.getElementById('btn-new-script')?.addEventListener('click', () => {
            openItemModal({ type: 'script', status: 'scripting' });
        });
        document.getElementById('btn-save-script')?.addEventListener('click', handleSaveCurrentScript);
        document.getElementById('btn-load-templates')?.addEventListener('click', () => toggleModal(modalTemplatesBackdrop, true));

        // Live Script Counters
        ['script-hook-input', 'script-body-input', 'script-cta-input'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', updateScriptMetrics);
        });

        // Template Application
        document.querySelectorAll('.btn-apply-tpl').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tplCard = e.target.closest('.template-item');
                const tplType = tplCard?.getAttribute('data-tpl');
                applyScriptTemplate(tplType);
                toggleModal(modalTemplatesBackdrop, false);
            });
        });

        // Integration Exports
        document.querySelectorAll('.btn-export-int').forEach(btn => {
            btn.addEventListener('click', () => {
                const intName = btn.getAttribute('data-int');
                exportIntegration(intName);
            });
        });

        // Calendar View Switcher
        document.querySelectorAll('.cal-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cal-view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCalView = btn.getAttribute('data-cal-view') || 'month';
                renderCalendar();
            });
        });

        // Calendar Navigation
        document.getElementById('cal-prev-month')?.addEventListener('click', () => {
            if (currentCalView === 'month') {
                currentCalDate.setMonth(currentCalDate.getMonth() - 1);
            } else if (currentCalView === 'week') {
                currentCalDate.setDate(currentCalDate.getDate() - 7);
            } else {
                currentCalDate.setDate(currentCalDate.getDate() - 1);
            }
            renderCalendar();
        });
        document.getElementById('cal-next-month')?.addEventListener('click', () => {
            if (currentCalView === 'month') {
                currentCalDate.setMonth(currentCalDate.getMonth() + 1);
            } else if (currentCalView === 'week') {
                currentCalDate.setDate(currentCalDate.getDate() + 7);
            } else {
                currentCalDate.setDate(currentCalDate.getDate() + 1);
            }
            renderCalendar();
        });
        document.getElementById('cal-today')?.addEventListener('click', () => {
            currentCalDate = new Date();
            renderCalendar();
        });
    }

    function switchTab(tabName) {
        const btn = document.querySelector(`.os-tab-btn[data-tab="${tabName}"]`);
        if (btn) btn.click();
    }

    function toggleModal(modalEl, show) {
        if (modalEl) modalEl.style.display = show ? 'flex' : 'none';
    }

    async function loadWorkspaceData() {
        try {
            const [itemsRes, foldersRes] = await Promise.all([
                fetch('/services/content-os/api/items').then(r => r.json()),
                fetch('/services/content-os/api/folders').then(r => r.json())
            ]);

            if (itemsRes.success) contentItems = itemsRes.items || [];
            if (foldersRes.success) contentFolders = foldersRes.folders || [];

            renderAllViews();
        } catch (err) {
            console.error('Failed loading Content OS data:', err);
        }
    }

    function getFilteredItems() {
        const query = (searchInput?.value || '').toLowerCase();
        const platform = filterPlatform?.value || '';
        const folderId = filterFolder?.value || '';

        return contentItems.filter(item => {
            if (platform && item.platform !== platform) return false;
            if (folderId && item.folderId?.toString() !== folderId) return false;
            if (selectedTagFilter && (!item.tags || !item.tags.includes(selectedTagFilter))) return false;
            if (query) {
                const matchTitle = item.title.toLowerCase().includes(query);
                const matchDesc = item.description.toLowerCase().includes(query);
                const matchTags = item.tags && item.tags.some(t => t.toLowerCase().includes(query));
                if (!matchTitle && !matchDesc && !matchTags) return false;
            }
            return true;
        });
    }

    function renderAllViews() {
        updateStatsRibbon();
        renderKanban();
        renderCalendar();
        renderIdeaVault();
        renderScriptStudio();
        renderFolders();
    }

    function updateStatsRibbon() {
        document.getElementById('stat-ideas').textContent = contentItems.filter(i => i.status === 'idea').length;
        document.getElementById('stat-scripts').textContent = contentItems.filter(i => i.status === 'scripting').length;
        document.getElementById('stat-ready').textContent = contentItems.filter(i => i.status === 'ready').length;
        document.getElementById('stat-scheduled').textContent = contentItems.filter(i => i.status === 'scheduled').length;
    }

    // -------------------------------------------------------------
    // RENDER: KANBAN BOARD
    // -------------------------------------------------------------
    function renderKanban() {
        const filtered = getFilteredItems();
        const columns = ['idea', 'scripting', 'filming', 'editing', 'ready', 'scheduled'];

        columns.forEach(col => {
            const container = document.getElementById(`col-${col}`);
            if (!container) return;

            const colItems = filtered.filter(i => i.status === col);
            const countEl = container.closest('.kanban-col')?.querySelector('.col-count');
            if (countEl) countEl.textContent = colItems.length;

            if (colItems.length === 0) {
                container.innerHTML = `<div style="font-size:0.75rem; color:#9ca3af; text-align:center; padding:1rem;">Empty</div>`;
                return;
            }

            container.innerHTML = colItems.map(item => `
                <div class="kanban-card" data-id="${item._id}">
                    <div class="card-title">${escapeHtml(item.title)}</div>
                    <div style="font-size:0.8rem; color:#4b5563;">${escapeHtml(item.description || '')}</div>
                    <div class="card-meta">
                        <span class="platform-pill">${item.platform || 'General'}</span>
                        <button type="button" class="neo-btn sm btn-quick-convert" data-id="${item._id}">➔</button>
                    </div>
                </div>
            `).join('');
        });

        // Quick Convert Button Listener
        document.querySelectorAll('.btn-quick-convert').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                quickConvertItem(id);
            });
        });

        // Click Card to Edit
        document.querySelectorAll('.kanban-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.getAttribute('data-id');
                const item = contentItems.find(i => i._id === id);
                if (item) openItemModal(item);
            });
        });
    }

    async function quickConvertItem(id) {
        try {
            const res = await fetch(`/services/content-os/api/items/${id}/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            }).then(r => r.json());

            if (res.success) {
                await loadWorkspaceData();
            }
        } catch (err) {
            console.error('Error converting item:', err);
        }
    }

    // -------------------------------------------------------------
    // RENDER: CONTENT CALENDAR (MONTH, WEEK, DAY VIEWS)
    // -------------------------------------------------------------
    function renderCalendar() {
        const container = document.getElementById('calendar-days-container');
        const monthTitle = document.getElementById('cal-month-title');
        const subtitle = document.getElementById('cal-view-subtitle');
        const gridHeader = document.getElementById('cal-grid-header');
        if (!container || !monthTitle) return;

        const filteredItems = getFilteredItems();
        const scheduledItems = filteredItems.filter(i => i.scheduledAt || i.deadlineAt);

        if (currentCalView === 'month') {
            renderMonthView(container, monthTitle, subtitle, gridHeader, scheduledItems);
        } else if (currentCalView === 'week') {
            renderWeekView(container, monthTitle, subtitle, gridHeader, scheduledItems);
        } else if (currentCalView === 'day') {
            renderDayView(container, monthTitle, subtitle, gridHeader, scheduledItems);
        }

        attachCalendarEvents();
    }

    // --- MONTH VIEW ---
    function renderMonthView(container, monthTitle, subtitle, gridHeader, scheduledItems) {
        gridHeader.style.display = 'grid';
        gridHeader.innerHTML = '<div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>';

        const year = currentCalDate.getFullYear();
        const month = currentCalDate.getMonth();

        monthTitle.textContent = currentCalDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (subtitle) subtitle.textContent = 'Month View Schedule';

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = new Date().toDateString();

        let daysHtml = '';

        // Padding previous month days
        for (let i = 0; i < firstDay; i++) {
            daysHtml += `<div class="cal-day-cell other-month"></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const cellDate = new Date(year, month, day);
            const dateISO = cellDate.toISOString().split('T')[0];
            const isToday = cellDate.toDateString() === todayStr;

            const dayEvents = scheduledItems.filter(i => {
                const d = i.scheduledAt ? new Date(i.scheduledAt) : (i.deadlineAt ? new Date(i.deadlineAt) : null);
                return d && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
            });

            const eventsHtml = dayEvents.slice(0, 3).map(e => renderEventChipHtml(e)).join('');
            const overflow = dayEvents.length > 3 ? `<div style="font-size:0.65rem; color:#4338ca; font-weight:bold; margin-top:2px;">+${dayEvents.length - 3} more</div>` : '';

            daysHtml += `
                <div class="cal-day-cell ${isToday ? 'today' : ''}" data-date="${dateISO}">
                    <div class="day-num font-label">
                        <span>${day}</span>
                        ${dayEvents.some(e => e.deadlineAt) ? `<span title="Has Deadline">⏰</span>` : ''}
                    </div>
                    ${eventsHtml}
                    ${overflow}
                </div>
            `;
        }

        container.className = 'calendar-grid-body';
        container.innerHTML = daysHtml;
    }

    // --- WEEK VIEW ---
    function renderWeekView(container, monthTitle, subtitle, gridHeader, scheduledItems) {
        gridHeader.style.display = 'none';

        // Calculate Sunday of current week
        const startOfWeek = new Date(currentCalDate);
        startOfWeek.setDate(currentCalDate.getDate() - currentCalDate.getDay());

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const startStr = startOfWeek.toLocaleString('default', { month: 'short', day: 'numeric' });
        const endStr = endOfWeek.toLocaleString('default', { month: 'short', day: 'numeric', year: 'numeric' });
        monthTitle.textContent = `${startStr} - ${endStr}`;
        if (subtitle) subtitle.textContent = 'Weekly Breakdown Schedule';

        const todayStr = new Date().toDateString();
        let weekColsHtml = '';

        for (let i = 0; i < 7; i++) {
            const colDate = new Date(startOfWeek);
            colDate.setDate(startOfWeek.getDate() + i);
            const dateISO = colDate.toISOString().split('T')[0];
            const isToday = colDate.toDateString() === todayStr;
            const dayName = colDate.toLocaleString('default', { weekday: 'short' });
            const dayNum = colDate.getDate();

            const colEvents = scheduledItems.filter(e => {
                const d = e.scheduledAt ? new Date(e.scheduledAt) : (e.deadlineAt ? new Date(e.deadlineAt) : null);
                return d && d.toDateString() === colDate.toDateString();
            });

            const eventsHtml = colEvents.map(e => renderEventChipHtml(e, true)).join('');

            weekColsHtml += `
                <div class="cal-week-col ${isToday ? 'today' : ''}" data-date="${dateISO}">
                    <div class="week-col-header font-label">
                        ${dayName} ${dayNum}
                    </div>
                    <div class="week-col-events" style="display:flex; flex-direction:column; gap:4px;">
                        ${eventsHtml.length > 0 ? eventsHtml : '<div style="font-size:0.7rem; color:#9ca3af; text-align:center; padding:1rem;">No items</div>'}
                    </div>
                </div>
            `;
        }

        container.className = 'cal-week-body';
        container.innerHTML = weekColsHtml;
    }

    // --- DAY VIEW ---
    function renderDayView(container, monthTitle, subtitle, gridHeader, scheduledItems) {
        gridHeader.style.display = 'none';

        const dateStr = currentCalDate.toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        monthTitle.textContent = dateStr;
        if (subtitle) subtitle.textContent = 'Hourly Daily Timeline Schedule';

        const todayISO = currentCalDate.toISOString().split('T')[0];
        const dayEvents = scheduledItems.filter(e => {
            const d = e.scheduledAt ? new Date(e.scheduledAt) : (e.deadlineAt ? new Date(e.deadlineAt) : null);
            return d && d.toDateString() === currentCalDate.toDateString();
        });

        let timelineHtml = '<div class="cal-day-timeline">';

        for (let hour = 0; hour < 24; hour++) {
            const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
            const hourEvents = dayEvents.filter(e => {
                const d = e.scheduledAt ? new Date(e.scheduledAt) : (e.deadlineAt ? new Date(e.deadlineAt) : null);
                return d && d.getHours() === hour;
            });

            const eventsHtml = hourEvents.map(e => renderEventChipHtml(e, true)).join('');

            timelineHtml += `
                <div class="timeline-hour-row" data-date="${todayISO}T${hourLabel}">
                    <div class="hour-label">${hourLabel}</div>
                    <div class="hour-events-slot">
                        ${eventsHtml.length > 0 ? eventsHtml : '<span style="font-size:0.75rem; color:#d1d5db;">+ Click to schedule at this hour</span>'}
                    </div>
                </div>
            `;
        }

        timelineHtml += '</div>';
        container.className = '';
        container.innerHTML = timelineHtml;
    }

    function renderEventChipHtml(item, showDetails = false) {
        const platforms = item.platforms && item.platforms.length > 0 ? item.platforms : (item.platform ? [item.platform] : ['general']);
        const platBadges = platforms.map(p => `<span class="plat-badge ${p}">${p.slice(0, 2).toUpperCase()}</span>`).join('');
        const statusClass = `status-${item.status || 'idea'}`;

        const isOverdue = item.deadlineAt && new Date(item.deadlineAt) < new Date() && item.status !== 'published';
        const deadlinePill = item.deadlineAt ? `<span class="deadline-indicator" title="Deadline">${isOverdue ? '⚠️ Overdue' : '⏰ Deadline'}</span>` : '';

        const perfViews = item.performance?.views ? `<span class="perf-pill">📊 ${item.performance.views} v</span>` : '';

        return `
            <div class="cal-event-chip ${statusClass} ${item.deadlineAt ? 'has-deadline' : ''}" draggable="true" data-id="${item._id}" title="${escapeHtml(item.title)}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>${platBadges} <strong>${escapeHtml(item.title)}</strong></span>
                    ${deadlinePill}
                </div>
                ${showDetails && item.description ? `<div style="font-size:0.65rem; color:#4b5563;">${escapeHtml(item.description.slice(0, 60))}</div>` : ''}
                ${perfViews ? `<div style="margin-top:2px;">${perfViews}</div>` : ''}
            </div>
        `;
    }

    function attachCalendarEvents() {
        // Event click to edit
        document.querySelectorAll('.cal-event-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = chip.getAttribute('data-id');
                const item = contentItems.find(i => i._id === id);
                if (item) openItemModal(item);
            });

            // Drag Start
            chip.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', chip.getAttribute('data-id'));
            });
        });

        // Day cell click to schedule
        document.querySelectorAll('.cal-day-cell, .cal-week-col, .timeline-hour-row').forEach(cell => {
            const dateStr = cell.getAttribute('data-date');
            if (!dateStr) return;

            cell.addEventListener('click', (e) => {
                if (e.target.closest('.cal-event-chip')) return;
                const scheduledDate = new Date(dateStr);
                if (isNaN(scheduledDate.getTime())) return;
                openItemModal({ status: 'scheduled', scheduledAt: scheduledDate });
            });

            // Drag Over & Drop Rescheduling
            cell.addEventListener('dragover', (e) => {
                e.preventDefault();
                cell.classList.add('drag-over');
            });

            cell.addEventListener('dragleave', () => {
                cell.classList.remove('drag-over');
            });

            cell.addEventListener('drop', async (e) => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                const itemId = e.dataTransfer.getData('text/plain');
                if (!itemId) return;

                const targetDate = new Date(dateStr);
                targetDate.setHours(12, 0, 0, 0);

                try {
                    const res = await fetch(`/services/content-os/api/items/${itemId}/reschedule`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ scheduledAt: targetDate.toISOString() })
                    }).then(r => r.json());

                    if (res.success) {
                        await loadWorkspaceData();
                    }
                } catch (err) {
                    console.error('Reschedule error:', err);
                }
            });
        });
    }

    // -------------------------------------------------------------
    // RENDER: IDEA VAULT
    // -------------------------------------------------------------
    function renderIdeaVault() {
        const container = document.getElementById('ideas-grid-container');
        if (!container) return;

        const ideas = getFilteredItems().filter(i => i.status === 'idea' || i.type === 'idea');

        if (ideas.length === 0) {
            container.innerHTML = `<div class="neo-box" style="padding:2rem; text-align:center; grid-column: 1/-1;">No ideas captured yet. Click <strong>⚡ NEW ITEM</strong> or use the <strong>🤖 AI ASSISTANT</strong> to brainstorm!</div>`;
            return;
        }

        container.innerHTML = ideas.map(item => `
            <div class="idea-card">
                <div>
                    <span class="platform-pill">${item.platform || 'General'}</span>
                    <h3 class="font-display idea-title" style="margin-top:0.4rem;">${escapeHtml(item.title)}</h3>
                    <p class="idea-desc">${escapeHtml(item.description || 'No description.')}</p>
                </div>
                <div class="idea-footer">
                    <span class="font-label" style="font-size:0.7rem;">${(item.tags || []).map(t => `#${t}`).join(' ')}</span>
                    <button type="button" class="neo-btn sm warning btn-convert-script" data-id="${item._id}">✍️ Script This</button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.btn-convert-script').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const item = contentItems.find(i => i._id === id);
                if (item) {
                    item.status = 'scripting';
                    item.type = 'script';
                    openScriptEditor(item);
                    switchTab('script');
                }
            });
        });
    }

    // -------------------------------------------------------------
    // RENDER: SCRIPT STUDIO
    // -------------------------------------------------------------
    function renderScriptStudio() {
        const listContainer = document.getElementById('script-items-list');
        if (!listContainer) return;

        const scripts = contentItems.filter(i => i.status === 'scripting' || i.type === 'script');

        listContainer.innerHTML = scripts.map(s => `
            <li class="${activeScriptItem && activeScriptItem._id === s._id ? 'active' : ''}" data-id="${s._id}">
                ${escapeHtml(s.title)}
            </li>
        `).join('');

        document.querySelectorAll('#script-items-list li').forEach(li => {
            li.addEventListener('click', () => {
                const id = li.getAttribute('data-id');
                const item = scripts.find(i => i._id === id);
                if (item) openScriptEditor(item);
            });
        });

        if (!activeScriptItem && scripts.length > 0) {
            openScriptEditor(scripts[0]);
        }
    }

    function openScriptEditor(item) {
        activeScriptItem = item;

        document.getElementById('script-title-input').value = item.title || '';
        document.getElementById('script-hook-input').value = item.scriptDetails?.hook || '';
        document.getElementById('script-body-input').value = item.scriptDetails?.body || '';
        document.getElementById('script-cta-input').value = item.scriptDetails?.cta || '';
        document.getElementById('script-teleprompter-input').value = item.scriptDetails?.teleprompterNotes || '';

        updateScriptMetrics();
        renderScriptStudio();
    }

    function updateScriptMetrics() {
        const hook = document.getElementById('script-hook-input')?.value || '';
        const body = document.getElementById('script-body-input')?.value || '';
        const cta = document.getElementById('script-cta-input')?.value || '';

        const fullText = [hook, body, cta].join(' ').trim();
        const words = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
        const seconds = Math.ceil((words / 150) * 60);

        document.getElementById('script-word-count').textContent = `${words} words`;
        document.getElementById('script-read-time').textContent = `~${seconds}s speech duration`;
    }

    async function handleSaveCurrentScript() {
        if (!activeScriptItem) return;

        const title = document.getElementById('script-title-input').value.trim() || activeScriptItem.title;
        const hook = document.getElementById('script-hook-input').value;
        const body = document.getElementById('script-body-input').value;
        const cta = document.getElementById('script-cta-input').value;
        const teleprompterNotes = document.getElementById('script-teleprompter-input').value;

        try {
            const res = await fetch(`/services/content-os/api/items/${activeScriptItem._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    status: 'scripting',
                    type: 'script',
                    scriptDetails: { hook, body, cta, teleprompterNotes }
                })
            }).then(r => r.json());

            if (res.success) {
                alert('Script saved successfully!');
                await loadWorkspaceData();
            }
        } catch (err) {
            console.error('Error saving script:', err);
        }
    }

    function applyScriptTemplate(tplType) {
        if (tplType === 'viral_reel') {
            document.getElementById('script-hook-input').value = "🔥 STOP SCROLLING! If you are doing X, you're missing out on Y!";
            document.getElementById('script-body-input').value = "Point 1: Here is the exact problem.\nPoint 2: Here is the simple 2-step fix.\nPoint 3: Proof of result.";
            document.getElementById('script-cta-input').value = "Save this reel for later and follow for daily tips!";
        } else if (tplType === 'tutorial') {
            document.getElementById('script-hook-input').value = "How to X in under 5 minutes without Y!";
            document.getElementById('script-body-input').value = "Step 1: Open CreatorOS.\nStep 2: Click on Content OS.\nStep 3: Generate script with AI.";
            document.getElementById('script-cta-input').value = "Drop a comment below if you want the template link!";
        } else if (tplType === 'thread') {
            document.getElementById('script-hook-input').value = "🧵 I spent 100 hours researching X so you don't have to. Here are 7 lessons:";
            document.getElementById('script-body-input').value = "1/ Key insight one.\n2/ Key insight two.\n3/ Key insight three.";
            document.getElementById('script-cta-input').value = "If you enjoyed this thread, RT the first tweet!";
        }
        updateScriptMetrics();
    }

    // -------------------------------------------------------------
    // RENDER: FOLDERS
    // -------------------------------------------------------------
    function renderFolders() {
        const container = document.getElementById('folders-grid-container');
        if (!container) return;

        if (contentFolders.length === 0) {
            container.innerHTML = `<div class="neo-box" style="padding:1.5rem; grid-column:1/-1;">No folders created yet. Click <strong>+ New Folder</strong> above to organize campaigns!</div>`;
            return;
        }

        container.innerHTML = contentFolders.map(f => {
            const count = contentItems.filter(i => i.folderId?.toString() === f._id.toString()).length;
            return `
                <div class="folder-card">
                    <div class="folder-color-strip" style="background: ${f.color || '#4338CA'};"></div>
                    <h3 class="font-display" style="margin:0.25rem 0;">📁 ${escapeHtml(f.name)}</h3>
                    <p class="font-sans" style="font-size:0.85rem; color:#4b5563;">${escapeHtml(f.description || '')}</p>
                    <div class="font-label" style="font-size:0.75rem; margin-top:0.5rem;">${count} items</div>
                </div>
            `;
        }).join('');
    }

    // -------------------------------------------------------------
    // AI GENERATION ASSISTANT
    // -------------------------------------------------------------
    async function handleGenerateAi(e) {
        e.preventDefault();

        const prompt = document.getElementById('ai-prompt-input').value.trim();
        const mode = document.getElementById('ai-mode-select').value;
        const platform = document.getElementById('ai-platform-select').value;
        const submitBtn = document.getElementById('btn-submit-ai');

        if (!prompt) return;

        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ GENERATING...';

        try {
            const res = await fetch('/services/content-os/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, mode, platform })
            }).then(r => r.json());

            if (res.success) {
                const outputBox = document.getElementById('ai-output-result');
                const outputContent = document.getElementById('ai-output-content');
                outputBox.style.display = 'block';

                if (mode === 'idea') {
                    outputContent.textContent = `${res.result.title}\n\n${res.result.description}\n\nSuggested Video Hooks:\n- ${res.result.ideas.join('\n- ')}`;
                } else if (mode === 'hook') {
                    outputContent.textContent = `Generated Hooks:\n\n${res.result.hooks.join('\n\n')}`;
                } else if (mode === 'script') {
                    outputContent.textContent = `HOOK:\n${res.result.scriptDetails.hook}\n\nBODY:\n${res.result.scriptDetails.body}\n\nCTA:\n${res.result.scriptDetails.cta}`;
                } else {
                    outputContent.textContent = `CAPTION:\n${res.result.caption}\n\nHASHTAGS:\n${res.result.hashtags.join(' ')}`;
                }

                document.getElementById('btn-ai-create-item').onclick = () => {
                    openItemModal({
                        title: prompt,
                        description: outputContent.textContent.slice(0, 300),
                        platform: platform,
                        aiGenerated: true
                    });
                };
            }
        } catch (err) {
            console.error('Error generating AI:', err);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '⚡ GENERATE WITH AI';
        }
    }

    // -------------------------------------------------------------
    // MODAL & ITEM SAVE HANDLERS
    // -------------------------------------------------------------
    let currentModalItem = null;

    function openItemModal(presetData = {}) {
        currentModalItem = presetData;

        document.getElementById('modal-item-id').value = presetData._id || '';
        document.getElementById('modal-input-title').value = presetData.title || '';
        document.getElementById('modal-input-type').value = presetData.type || 'idea';
        document.getElementById('modal-input-status').value = presetData.status || 'idea';
        document.getElementById('modal-input-platform').value = presetData.platform || 'general';
        document.getElementById('modal-input-description').value = presetData.description || '';
        document.getElementById('modal-input-tags').value = (presetData.tags || []).join(', ');

        // Format ISO dates for datetime-local picker
        document.getElementById('modal-input-scheduled').value = presetData.scheduledAt ? new Date(presetData.scheduledAt).toISOString().slice(0, 16) : '';
        document.getElementById('modal-input-deadline').value = presetData.deadlineAt ? new Date(presetData.deadlineAt).toISOString().slice(0, 16) : '';

        // Multi-Platform checkboxes
        const selectedPlatforms = presetData.platforms || (presetData.platform ? [presetData.platform] : ['general']);
        document.querySelectorAll('.platform-checkbox').forEach(chk => {
            chk.checked = selectedPlatforms.includes(chk.value);
        });

        // Performance metrics
        document.getElementById('modal-input-views').value = presetData.performance?.views || 0;
        document.getElementById('modal-input-er').value = presetData.performance?.engagementRate || 0;
        document.getElementById('modal-input-clicks').value = presetData.performance?.clicks || 0;
        document.getElementById('modal-input-likes').value = presetData.performance?.likes || 0;

        // Platform Formatting Advice & Character Counter
        updatePlatformTips();
        updateCaptionCharCounter();

        // Collaboration & Comments Section
        const commentsSec = document.getElementById('modal-comments-section');
        if (presetData._id) {
            commentsSec.style.display = 'block';
            renderCommentsThread(presetData.comments || []);
        } else {
            commentsSec.style.display = 'none';
        }

        document.getElementById('modal-item-title').textContent = presetData._id ? '⚡ Edit Content Item' : '⚡ Create Content Item';
        toggleModal(modalItemBackdrop, true);
    }

    function updatePlatformTips() {
        const checkedPlatforms = Array.from(document.querySelectorAll('.platform-checkbox:checked')).map(c => c.value);
        const hintText = document.getElementById('platform-format-text');
        if (!hintText) return;

        if (checkedPlatforms.length === 0) {
            hintText.textContent = 'Select target platforms above to view character limits and video format recommendations.';
            return;
        }

        const tips = [];
        if (checkedPlatforms.includes('twitter')) tips.push('🐦 Twitter/X: Limit posts to 280 chars. Use 1-2 trending hashtags max.');
        if (checkedPlatforms.includes('instagram')) tips.push('📸 Instagram: Ideal caption 125-150 chars. Max 30 hashtags. 9:16 Reel aspect ratio.');
        if (checkedPlatforms.includes('youtube')) tips.push('📺 YouTube: Keep title under 70 chars. First 3 lines of description are visible above fold.');
        if (checkedPlatforms.includes('tiktok')) tips.push('🎵 TikTok: High energy first 3s hook required. Optimal duration 15-60 seconds.');
        if (checkedPlatforms.includes('linkedin')) tips.push('💼 LinkedIn: Use line breaks for readability. 1000-1500 characters perform best.');

        hintText.innerHTML = tips.join('<br/>');
    }

    function updateCaptionCharCounter() {
        const text = document.getElementById('modal-input-description')?.value || '';
        const counter = document.getElementById('caption-char-count');
        if (counter) counter.textContent = `${text.length} characters`;
    }

    function renderCommentsThread(comments) {
        const container = document.getElementById('comments-thread-list');
        if (!container) return;

        if (!comments || comments.length === 0) {
            container.innerHTML = `<div style="font-size:0.8rem; color:#9ca3af; text-align:center; padding:0.5rem;">No team comments yet. Be the first to leave a feedback note below!</div>`;
            return;
        }

        container.innerHTML = comments.map(c => `
            <div class="comment-bubble" data-comment-id="${c._id}">
                <div class="comment-meta">
                    <strong>👤 ${escapeHtml(c.userName || 'Creator')}</strong>
                    <span>${c.createdAt ? new Date(c.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>${escapeHtml(c.text)}</div>
                    <button type="button" class="btn-del-comment" data-comment-id="${c._id}" title="Delete Comment">&times;</button>
                </div>
            </div>
        `).join('');

        // Attach delete comment event listeners
        container.querySelectorAll('.btn-del-comment').forEach(btn => {
            btn.addEventListener('click', () => {
                const commentId = btn.getAttribute('data-comment-id');
                handleDeleteComment(commentId);
            });
        });
    }

    async function handlePostComment() {
        if (!currentModalItem || !currentModalItem._id) return;
        const textInput = document.getElementById('modal-comment-text');
        const text = (textInput?.value || '').trim();
        if (!text) return;

        try {
            const res = await fetch(`/services/content-os/api/items/${currentModalItem._id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            }).then(r => r.json());

            if (res.success) {
                textInput.value = '';
                currentModalItem.comments = res.item.comments || [];
                renderCommentsThread(currentModalItem.comments);
                await loadWorkspaceData();
            }
        } catch (err) {
            console.error('Error posting comment:', err);
        }
    }

    async function handleDeleteComment(commentId) {
        if (!currentModalItem || !currentModalItem._id || !commentId) return;

        try {
            const res = await fetch(`/services/content-os/api/items/${currentModalItem._id}/comments/${commentId}`, {
                method: 'DELETE'
            }).then(r => r.json());

            if (res.success) {
                currentModalItem.comments = res.item.comments || [];
                renderCommentsThread(currentModalItem.comments);
                await loadWorkspaceData();
            }
        } catch (err) {
            console.error('Error deleting comment:', err);
        }
    }

    function closeItemModal() {
        toggleModal(modalItemBackdrop, false);
    }

    async function handleSaveItem(e) {
        e.preventDefault();
        const id = document.getElementById('modal-item-id').value;
        const title = document.getElementById('modal-input-title').value.trim();
        const type = document.getElementById('modal-input-type').value;
        const status = document.getElementById('modal-input-status').value;
        const platform = document.getElementById('modal-input-platform').value;
        const description = document.getElementById('modal-input-description').value;
        const tags = document.getElementById('modal-input-tags').value;
        const scheduledAt = document.getElementById('modal-input-scheduled').value;
        const deadlineAt = document.getElementById('modal-input-deadline').value;
        const platforms = Array.from(document.querySelectorAll('.platform-checkbox:checked')).map(c => c.value);

        const performance = {
            views: Number(document.getElementById('modal-input-views').value || 0),
            engagementRate: Number(document.getElementById('modal-input-er').value || 0),
            clicks: Number(document.getElementById('modal-input-clicks').value || 0),
            likes: Number(document.getElementById('modal-input-likes').value || 0)
        };

        const payload = {
            title,
            type,
            status,
            platform,
            platforms: platforms.length > 0 ? platforms : [platform],
            description,
            tags,
            scheduledAt,
            deadlineAt,
            performance
        };

        const url = id ? `/services/content-os/api/items/${id}` : '/services/content-os/api/items';
        const method = id ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(r => r.json());

            if (res.success) {
                closeItemModal();
                await loadWorkspaceData();
            }
        } catch (err) {
            console.error('Error saving item:', err);
        }
    }

    function openFolderModal() {
        document.getElementById('folder-input-name').value = '';
        document.getElementById('folder-input-desc').value = '';
        toggleModal(modalFolderBackdrop, true);
    }

    async function handleSaveFolder(e) {
        e.preventDefault();
        const name = document.getElementById('folder-input-name').value.trim();
        const color = document.getElementById('folder-input-color').value;
        const description = document.getElementById('folder-input-desc').value;

        try {
            const res = await fetch('/services/content-os/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color, description })
            }).then(r => r.json());

            if (res.success) {
                toggleModal(modalFolderBackdrop, false);
                await loadWorkspaceData();
            }
        } catch (err) {
            console.error('Error creating folder:', err);
        }
    }

    async function exportIntegration(integration) {
        if (contentItems.length === 0) {
            alert('Please create at least one content item before exporting.');
            return;
        }

        const item = contentItems[0];
        try {
            const res = await fetch('/services/content-os/api/integrations/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: item._id, integration })
            }).then(r => r.json());

            if (res.success) {
                alert(`Successfully generated export payload for ${integration.toUpperCase()}!\n\nPayload:\n${JSON.stringify(res.exportPayload, null, 2)}`);
            }
        } catch (err) {
            console.error('Export error:', err);
        }
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
});
