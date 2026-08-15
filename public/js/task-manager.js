/**
 * CreatorOS - Task Manager Client-Side Script
 */

document.addEventListener('DOMContentLoaded', () => {
    let tasks = [];
    let currentTab = 'kanban';
    let editingTaskId = null;
    let timerState = {
        taskId: null,
        taskTitle: '',
        startTime: null,
        elapsedSeconds: 0,
        intervalId: null,
    };
    let currentCalDate = new Date();

    // DOM Elements
    const tabBtns = document.querySelectorAll('.tm-tab-btn');
    const viewSections = document.querySelectorAll('.tm-view-section');
    const searchInput = document.getElementById('tm-search-input');
    const filterStatus = document.getElementById('tm-filter-status');
    const filterCategory = document.getElementById('tm-filter-category');
    const filterPriority = document.getElementById('tm-filter-priority');

    // Modals & Drawers
    const modalBackdrop = document.getElementById('tm-modal-backdrop');
    const taskForm = document.getElementById('tm-task-form');
    const btnOpenNewTask = document.getElementById('btn-open-new-task');
    const modalCancelBtn = document.getElementById('tm-modal-cancel');
    const modalCloseBtn = document.getElementById('tm-modal-close');

    // Subtasks & Dependencies in Form
    const subtaskInput = document.getElementById('tm-input-subtask');
    const btnAddSubtask = document.getElementById('btn-add-subtask');
    const subtaskList = document.getElementById('tm-subtask-list');

    // Timer Widget Elements
    const timerContainer = document.getElementById('tm-active-timer-widget');
    const timerTitleEl = document.getElementById('tm-timer-title');
    const timerDisplayEl = document.getElementById('tm-timer-display');
    const btnStopTimer = document.getElementById('btn-stop-timer');

    // Init
    init();

    async function init() {
        setupTabs();
        setupEventListeners();
        await loadTasks();
    }

    function getCsrfToken() {
        return document.querySelector('input[name="_csrf"]')?.value || '';
    }

    function setupTabs() {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                currentTab = targetTab;

                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                viewSections.forEach(sec => {
                    if (sec.id === `view-${targetTab}`) {
                        sec.classList.add('active');
                    } else {
                        sec.classList.remove('active');
                    }
                });

                if (targetTab === 'gantt') renderGanttView();
                if (targetTab === 'calendar') renderCalendarView();
                if (targetTab === 'archive') renderArchiveView();
            });
        });
    }

    function setupEventListeners() {
        if (searchInput) searchInput.addEventListener('input', renderAllViews);
        if (filterStatus) filterStatus.addEventListener('change', renderAllViews);
        if (filterCategory) filterCategory.addEventListener('change', renderAllViews);
        if (filterPriority) filterPriority.addEventListener('change', renderAllViews);

        if (btnOpenNewTask) {
            btnOpenNewTask.addEventListener('click', () => openTaskModal());
        }

        if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);
        if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);

        if (btnAddSubtask) {
            btnAddSubtask.addEventListener('click', addSubtaskItem);
        }

        if (taskForm) {
            taskForm.addEventListener('submit', handleTaskFormSubmit);
        }

        if (btnStopTimer) {
            btnStopTimer.addEventListener('click', stopActiveTimer);
        }

        setupDragAndDrop();
    }

    async function loadTasks() {
        try {
            const res = await fetch('/api/tasks?isArchived=false');
            const data = await res.json();
            if (data.success) {
                tasks = data.tasks;
                renderAllViews();
                updateDependencyOptions();
            }
        } catch (err) {
            console.error('Failed to load tasks:', err);
        }
    }

    function renderAllViews() {
        const filtered = getFilteredTasks();
        renderKanbanView(filtered);
        renderListView(filtered);
        if (currentTab === 'gantt') renderGanttView();
        if (currentTab === 'calendar') renderCalendarView();
        updateStats();
    }

    function getFilteredTasks() {
        const q = (searchInput?.value || '').toLowerCase().trim();
        const status = filterStatus?.value || '';
        const category = filterCategory?.value || '';
        const priority = filterPriority?.value || '';

        return tasks.filter(t => {
            if (t.isArchived) return false;
            if (status && t.status !== status) return false;
            if (category && t.category !== category) return false;
            if (priority && t.priority !== priority) return false;
            if (q) {
                const matchTitle = (t.title || '').toLowerCase().includes(q);
                const matchDesc = (t.description || '').toLowerCase().includes(q);
                const matchTags = (t.tags || []).some(tag => tag.toLowerCase().includes(q));
                if (!matchTitle && !matchDesc && !matchTags) return false;
            }
            return true;
        });
    }

    function updateStats() {
        const total = tasks.filter(t => !t.isArchived).length;
        const active = tasks.filter(t => !t.isArchived && t.status !== 'completed' && t.status !== 'cancelled').length;
        const completed = tasks.filter(t => !t.isArchived && t.status === 'completed').length;
        const now = new Date();
        const overdue = tasks.filter(t => !t.isArchived && t.status !== 'completed' && t.status !== 'cancelled' && t.dueDate && new Date(t.dueDate) < now).length;
        const totalHours = tasks.reduce((sum, t) => sum + (t.spentHours || 0), 0);

        const elTotal = document.getElementById('stat-total-tasks');
        const elActive = document.getElementById('stat-active-tasks');
        const elCompleted = document.getElementById('stat-completed-tasks');
        const elOverdue = document.getElementById('stat-overdue-tasks');
        const elHours = document.getElementById('stat-spent-hours');

        if (elTotal) elTotal.textContent = total;
        if (elActive) elActive.textContent = active;
        if (elCompleted) elCompleted.textContent = completed;
        if (elOverdue) elOverdue.textContent = overdue;
        if (elHours) elHours.textContent = `${Math.round(totalHours * 10) / 10}h`;
    }

    /* KANBAN BOARD */
    function renderKanbanView(filteredTasks) {
        const cols = {
            todo: document.getElementById('col-cards-todo'),
            in_progress: document.getElementById('col-cards-in_progress'),
            review: document.getElementById('col-cards-review'),
            completed: document.getElementById('col-cards-completed'),
        };

        const counts = { todo: 0, in_progress: 0, review: 0, completed: 0 };

        Object.values(cols).forEach(c => { if (c) c.innerHTML = ''; });

        filteredTasks.forEach(task => {
            const statusKey = task.status || 'todo';
            if (cols[statusKey]) {
                counts[statusKey]++;
                const cardEl = createTaskCardEl(task);
                cols[statusKey].appendChild(cardEl);
            }
        });

        document.getElementById('col-count-todo')?.replaceChildren(document.createTextNode(counts.todo));
        document.getElementById('col-count-in_progress')?.replaceChildren(document.createTextNode(counts.in_progress));
        document.getElementById('col-count-review')?.replaceChildren(document.createTextNode(counts.review));
        document.getElementById('col-count-completed')?.replaceChildren(document.createTextNode(counts.completed));
    }

    function createTaskCardEl(task) {
        const card = document.createElement('div');
        card.className = 'tm-task-card';
        card.draggable = true;
        card.dataset.taskId = task._id;

        const totalSub = (task.subtasks || []).length;
        const doneSub = (task.subtasks || []).filter(s => s.completed).length;
        const subPercent = totalSub > 0 ? Math.round((doneSub / totalSub) * 100) : 0;

        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
        const formattedDueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

        const tagsHtml = (task.tags || []).map(t => `<span class="tag-badge">#${t}</span>`).join(' ');

        card.innerHTML = `
            <div class="tm-card-header">
                <div class="tm-card-badges">
                    <span class="priority-badge ${task.priority}">${task.priority}</span>
                    <span class="category-badge">${task.category}</span>
                    ${tagsHtml}
                </div>
                <button type="button" class="btn-card-edit neo-btn sm secondary" title="Edit Task">✏️</button>
            </div>
            <h3 class="tm-card-title">${escapeHtml(task.title)}</h3>
            ${task.description ? `<p class="tm-card-desc">${escapeHtml(task.description)}</p>` : ''}
            ${totalSub > 0 ? `
                <div class="tm-subtask-progress">
                    <div class="tm-progress-info">
                        <span>Checklist</span>
                        <span>${doneSub}/${totalSub} (${subPercent}%)</span>
                    </div>
                    <div class="tm-progress-track">
                        <div class="tm-progress-fill" style="width: ${subPercent}%"></div>
                    </div>
                </div>
            ` : ''}
            <div class="tm-card-footer">
                <span class="tm-due-date ${isOverdue ? 'overdue' : ''}">
                    📅 ${formattedDueDate ? formattedDueDate : 'No deadline'} ${isOverdue ? '⚠️ OVERDUE' : ''}
                </span>
                <div class="tm-card-actions">
                    <button type="button" class="btn-card-timer neo-btn sm ${timerState.taskId === task._id ? 'warning' : 'secondary'}" title="Start Timer">
                        ${timerState.taskId === task._id ? '⏸️' : '⏱️'}
                    </button>
                    <button type="button" class="btn-card-archive neo-btn sm secondary" title="Archive">📦</button>
                </div>
            </div>
        `;

        card.addEventListener('dragstart', (e) => {
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', task._id);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });

        card.querySelector('.btn-card-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openTaskModal(task);
        });

        card.querySelector('.btn-card-archive').addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleArchive(task._id);
        });

        card.querySelector('.btn-card-timer').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTaskTimer(task);
        });

        return card;
    }

    function setupDragAndDrop() {
        const columns = document.querySelectorAll('.tm-column-cards');
        columns.forEach(col => {
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                col.classList.add('drag-over');
            });

            col.addEventListener('dragleave', () => {
                col.classList.remove('drag-over');
            });

            col.addEventListener('drop', async (e) => {
                e.preventDefault();
                col.classList.remove('drag-over');
                const taskId = e.dataTransfer.getData('text/plain');
                const targetStatus = col.dataset.status;

                if (taskId && targetStatus) {
                    await updateTaskStatusApi(taskId, targetStatus);
                }
            });
        });
    }

    async function updateTaskStatusApi(taskId, newStatus) {
        try {
            const res = await fetch(`/api/tasks/${taskId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken(),
                },
                body: JSON.stringify({ status: newStatus, _csrf: getCsrfToken() }),
            });
            const data = await res.json();
            if (data.success) {
                const idx = tasks.findIndex(t => t._id === taskId);
                if (idx !== -1) {
                    tasks[idx] = data.task;
                }
                if (data.nextRecurringTask) {
                    tasks.unshift(data.nextRecurringTask);
                }
                renderAllViews();
            }
        } catch (err) {
            console.error('Failed to update task status:', err);
        }
    }

    /* LIST VIEW */
    function renderListView(filteredTasks) {
        const tbody = document.getElementById('tm-list-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (filteredTasks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">No tasks found. Click "⚡ New Task" to create one!</td></tr>`;
            return;
        }

        filteredTasks.forEach(task => {
            const tr = document.createElement('tr');
            const totalSub = (task.subtasks || []).length;
            const doneSub = (task.subtasks || []).filter(s => s.completed).length;

            tr.innerHTML = `
                <td>
                    <input type="checkbox" class="task-checkbox" ${task.status === 'completed' ? 'checked' : ''} />
                </td>
                <td>
                    <strong>${escapeHtml(task.title)}</strong>
                    ${task.description ? `<br><small style="color: #666;">${escapeHtml(task.description)}</small>` : ''}
                </td>
                <td><span class="priority-badge ${task.priority}">${task.priority}</span></td>
                <td><span class="category-badge">${task.category}</span></td>
                <td>
                    <select class="neo-select select-inline-status" style="padding: 0.2rem 0.4rem; font-size: 0.8rem;">
                        <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>Todo</option>
                        <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                        <option value="review" ${task.status === 'review' ? 'selected' : ''}>Review</option>
                        <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </td>
                <td>${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}</td>
                <td>
                    <button type="button" class="neo-btn sm secondary btn-list-edit">✏️ Edit</button>
                    <button type="button" class="neo-btn sm danger btn-list-delete">🗑️ Delete</button>
                </td>
            `;

            tr.querySelector('.task-checkbox').addEventListener('change', async (e) => {
                const newStatus = e.target.checked ? 'completed' : 'todo';
                await updateTaskStatusApi(task._id, newStatus);
            });

            tr.querySelector('.select-inline-status').addEventListener('change', async (e) => {
                await updateTaskStatusApi(task._id, e.target.value);
            });

            tr.querySelector('.btn-list-edit').addEventListener('click', () => openTaskModal(task));
            tr.querySelector('.btn-list-delete').addEventListener('click', () => deleteTaskApi(task._id));

            tbody.appendChild(tr);
        });
    }

    /* GANTT TIMELINE VIEW */
    function renderGanttView() {
        const container = document.getElementById('tm-gantt-chart-body');
        if (!container) return;
        container.innerHTML = '';

        const activeTasks = tasks.filter(t => !t.isArchived);

        if (activeTasks.length === 0) {
            container.innerHTML = `<div style="padding: 2rem; text-align: center;">No tasks to display in Gantt Timeline.</div>`;
            return;
        }

        activeTasks.forEach(task => {
            const row = document.createElement('div');
            row.className = 'gantt-row';

            const startDate = task.startDate ? new Date(task.startDate) : new Date(task.createdAt);
            const dueDate = task.dueDate ? new Date(task.dueDate) : new Date(startDate.getTime() + 86400000 * 3);

            row.innerHTML = `
                <div class="gantt-label" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</div>
                <div class="gantt-track">
                    <div class="gantt-bar ${task.status} ${task.priority}" style="left: 10%; width: 40%;">
                        <span>${escapeHtml(task.title)} (${task.status})</span>
                    </div>
                </div>
            `;

            row.querySelector('.gantt-bar').addEventListener('click', () => openTaskModal(task));
            container.appendChild(row);
        });
    }

    /* CALENDAR VIEW */
    function renderCalendarView() {
        const grid = document.getElementById('tm-calendar-grid');
        const monthTitle = document.getElementById('tm-cal-month-title');
        if (!grid) return;

        grid.innerHTML = `
            <div class="cal-day-header">SUN</div>
            <div class="cal-day-header">MON</div>
            <div class="cal-day-header">TUE</div>
            <div class="cal-day-header">WED</div>
            <div class="cal-day-header">THU</div>
            <div class="cal-day-header">FRI</div>
            <div class="cal-day-header">SAT</div>
        `;

        const year = currentCalDate.getFullYear();
        const month = currentCalDate.getMonth();

        if (monthTitle) {
            monthTitle.textContent = currentCalDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        }

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'cal-day-cell other-month';
            grid.appendChild(emptyCell);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'cal-day-cell';
            cell.innerHTML = `<span class="cal-day-num">${day}</span>`;

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayTasks = tasks.filter(t => {
                if (!t.dueDate) return false;
                const d = new Date(t.dueDate);
                return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
            });

            dayTasks.forEach(t => {
                const pill = document.createElement('div');
                pill.className = 'cal-event-pill';
                pill.textContent = t.title;
                pill.addEventListener('click', () => openTaskModal(t));
                cell.appendChild(pill);
            });

            grid.appendChild(cell);
        }
    }

    /* ARCHIVE VIEW */
    async function renderArchiveView() {
        const tbody = document.getElementById('tm-archive-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        try {
            const res = await fetch('/api/tasks?isArchived=true');
            const data = await res.json();

            if (data.success && data.tasks.length > 0) {
                data.tasks.forEach(task => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${escapeHtml(task.title)}</strong></td>
                        <td>${task.category}</td>
                        <td>${task.status}</td>
                        <td>${task.archivedAt ? new Date(task.archivedAt).toLocaleDateString() : '-'}</td>
                        <td>
                            <button type="button" class="neo-btn sm success btn-restore">🔄 Restore</button>
                            <button type="button" class="neo-btn sm danger btn-delete-archived">🗑️ Delete</button>
                        </td>
                    `;
                    tr.querySelector('.btn-restore').addEventListener('click', () => toggleArchive(task._id));
                    tr.querySelector('.btn-delete-archived').addEventListener('click', () => deleteTaskApi(task._id));
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;">No archived tasks found.</td></tr>`;
            }
        } catch (err) {
            console.error('Failed to load archive:', err);
        }
    }

    /* TASK MODAL & FORM */
    function openTaskModal(task = null) {
        editingTaskId = task ? task._id : null;
        const modalTitle = document.getElementById('tm-modal-title');
        if (modalTitle) modalTitle.textContent = task ? '✏️ EDIT TASK' : '⚡ CREATE TASK';

        document.getElementById('tm-input-title').value = task ? task.title : '';
        document.getElementById('tm-input-desc').value = task ? (task.description || '') : '';
        document.getElementById('tm-input-priority').value = task ? task.priority : 'medium';
        document.getElementById('tm-input-category').value = task ? task.category : 'content';
        document.getElementById('tm-input-status').value = task ? task.status : 'todo';
        document.getElementById('tm-input-start-date').value = task && task.startDate ? formatDateForInput(task.startDate) : '';
        document.getElementById('tm-input-due-date').value = task && task.dueDate ? formatDateForInput(task.dueDate) : '';
        document.getElementById('tm-input-estimated-hours').value = task ? (task.estimatedHours || 0) : 0;
        document.getElementById('tm-input-tags').value = task ? (task.tags || []).join(', ') : '';

        // Subtasks render
        renderSubtasksForm(task ? (task.subtasks || []) : []);

        modalBackdrop.classList.add('active');
    }

    function closeModal() {
        modalBackdrop.classList.remove('active');
        editingTaskId = null;
    }

    function renderSubtasksForm(subtasksList) {
        if (!subtaskList) return;
        subtaskList.innerHTML = '';
        subtasksList.forEach(st => {
            const item = document.createElement('div');
            item.className = 'subtask-item';
            item.style.cssText = 'display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem;';
            item.innerHTML = `
                <input type="checkbox" ${st.completed ? 'checked' : ''} class="st-check" />
                <input type="text" value="${escapeHtml(st.title)}" class="neo-input st-title-input" style="flex: 1; padding: 0.3rem 0.5rem;" />
                <button type="button" class="neo-btn sm danger btn-remove-st">✕</button>
            `;
            item.querySelector('.btn-remove-st').addEventListener('click', () => item.remove());
            subtaskList.appendChild(item);
        });
    }

    function addSubtaskItem() {
        const val = subtaskInput.value.trim();
        if (!val) return;
        const item = document.createElement('div');
        item.className = 'subtask-item';
        item.style.cssText = 'display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem;';
        item.innerHTML = `
            <input type="checkbox" class="st-check" />
            <input type="text" value="${escapeHtml(val)}" class="neo-input st-title-input" style="flex: 1; padding: 0.3rem 0.5rem;" />
            <button type="button" class="neo-btn sm danger btn-remove-st">✕</button>
        `;
        item.querySelector('.btn-remove-st').addEventListener('click', () => item.remove());
        subtaskList.appendChild(item);
        subtaskInput.value = '';
    }

    async function handleTaskFormSubmit(e) {
        e.preventDefault();

        const title = document.getElementById('tm-input-title').value.trim();
        const description = document.getElementById('tm-input-desc').value.trim();
        const priority = document.getElementById('tm-input-priority').value;
        const category = document.getElementById('tm-input-category').value;
        const status = document.getElementById('tm-input-status').value;
        const startDate = document.getElementById('tm-input-start-date').value;
        const dueDate = document.getElementById('tm-input-due-date').value;
        const estimatedHours = document.getElementById('tm-input-estimated-hours').value;
        const tags = document.getElementById('tm-input-tags').value;

        // Subtasks gathering
        const subtasks = [];
        subtaskList.querySelectorAll('.subtask-item').forEach(item => {
            const stTitle = item.querySelector('.st-title-input').value.trim();
            const stCheck = item.querySelector('.st-check').checked;
            if (stTitle) {
                subtasks.push({ title: stTitle, completed: stCheck });
            }
        });

        const payload = {
            title,
            description,
            priority,
            category,
            status,
            startDate: startDate ? new Date(startDate).toISOString() : null,
            dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            estimatedHours: Number(estimatedHours) || 0,
            tags,
            subtasks,
            _csrf: getCsrfToken(),
        };

        try {
            const url = editingTaskId ? `/api/tasks/${editingTaskId}` : '/api/tasks';
            const method = editingTaskId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken(),
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.success) {
                closeModal();
                await loadTasks();
            } else {
                alert(data.error || 'Failed to save task.');
            }
        } catch (err) {
            console.error('Task save error:', err);
        }
    }

    /* TIME TRACKER TIMER */
    function toggleTaskTimer(task) {
        if (timerState.taskId === task._id) {
            stopActiveTimer();
        } else {
            if (timerState.taskId) stopActiveTimer();
            startTimerForTask(task);
        }
    }

    function startTimerForTask(task) {
        timerState = {
            taskId: task._id,
            taskTitle: task.title,
            startTime: Date.now(),
            elapsedSeconds: 0,
            intervalId: setInterval(updateTimerDisplay, 1000),
        };

        if (timerContainer) timerContainer.style.display = 'flex';
        if (timerTitleEl) timerTitleEl.textContent = `Tracking: ${task.title}`;
        updateTimerDisplay();
    }

    function updateTimerDisplay() {
        timerState.elapsedSeconds = Math.floor((Date.now() - timerState.startTime) / 1000);
        const mins = Math.floor(timerState.elapsedSeconds / 60);
        const secs = timerState.elapsedSeconds % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        if (timerDisplayEl) timerDisplayEl.textContent = formatted;
    }

    async function stopActiveTimer() {
        if (!timerState.taskId) return;
        clearInterval(timerState.intervalId);

        const durationMinutes = Math.max(1, Math.round(timerState.elapsedSeconds / 60));
        const taskId = timerState.taskId;

        try {
            await fetch(`/api/tasks/${taskId}/time-log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken(),
                },
                body: JSON.stringify({ durationMinutes, note: 'Tracked via live timer', _csrf: getCsrfToken() }),
            });
            await loadTasks();
        } catch (err) {
            console.error('Time log save error:', err);
        }

        timerState = { taskId: null, taskTitle: '', startTime: null, elapsedSeconds: 0, intervalId: null };
        if (timerContainer) timerContainer.style.display = 'none';
        renderAllViews();
    }

    /* ACTIONS */
    async function toggleArchive(taskId) {
        try {
            const res = await fetch(`/api/tasks/${taskId}/archive`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken(),
                },
                body: JSON.stringify({ _csrf: getCsrfToken() }),
            });
            const data = await res.json();
            if (data.success) {
                await loadTasks();
                if (currentTab === 'archive') renderArchiveView();
            }
        } catch (err) {
            console.error('Archive error:', err);
        }
    }

    async function deleteTaskApi(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            const res = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'x-csrf-token': getCsrfToken(),
                },
            });
            const data = await res.json();
            if (data.success) {
                await loadTasks();
                if (currentTab === 'archive') renderArchiveView();
            }
        } catch (err) {
            console.error('Delete error:', err);
        }
    }

    function updateDependencyOptions() {
        const select = document.getElementById('tm-input-dependencies');
        if (!select) return;
        select.innerHTML = '<option value="">None (No prerequisite tasks)</option>';
        tasks.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t._id;
            opt.textContent = t.title;
            select.appendChild(opt);
        });
    }

    function formatDateForInput(dateVal) {
        if (!dateVal) return '';
        const d = new Date(dateVal);
        return d.toISOString().slice(0, 16);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
