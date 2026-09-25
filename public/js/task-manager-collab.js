/**
 * Task Manager - team workspaces, task details and templates.
 * Additive to task-manager.js. User-supplied text is always rendered with
 * textContent, never innerHTML.
 */
document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const drawer = $('tmx-drawer');
    if (!drawer) return;

    const STATUSES = [
        ['todo', '📌 TODO'],
        ['in_progress', '⚡ IN PROGRESS'],
        ['review', '🔍 REVIEW'],
        ['completed', '✅ COMPLETED'],
    ];

    const state = {
        workspaceId: '',
        projectId: '',
        workspace: null,
        view: 'board',
        month: new Date(),
        taskId: null,
        details: null,
        editing: null,
    };

    const csrf = () => document.querySelector('input[name="_csrf"]')?.value || '';

    async function api(url, method = 'GET', body) {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
            body: body ? JSON.stringify({ ...body, _csrf: csrf() }) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
        return data;
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
    }

    function button(label, onClick, className = 'neo-btn secondary sm') {
        const b = el('button', className, label);
        b.type = 'button';
        b.addEventListener('click', onClick);
        return b;
    }

    const empty = (container, message) => container.replaceChildren(el('p', 'tmx-empty', message));
    const report = (err) => window.alert(err.message || String(err));
    const personName = (u) => (u && (u.name || u.email)) || 'Someone';
    const when = (d) => (d ? new Date(d).toLocaleString() : '');
    const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
    const assigneeNames = (task) => (task.assignedTo || []).map((a) => a.name || a.email).filter(Boolean).join(', ');
    // 🔁 marks both the repeating original and the copies generated from it.
    const titleOf = (task) => ((task.recurring && task.recurring.isRecurring) || task.seriesId ? `🔁 ${task.title}` : task.title);

    function taskCard(task) {
        const card = el('div', 'tmx-card');
        card.appendChild(el('strong', null, titleOf(task)));
        card.appendChild(el('span', 'tmx-muted', [task.priority, task.dueDate && new Date(task.dueDate).toLocaleDateString()].filter(Boolean).join(' · ')));
        if (assigneeNames(task)) card.appendChild(el('span', 'tmx-muted', `👤 ${assigneeNames(task)}`));
        card.addEventListener('click', () => openDrawer(task._id));
        return card;
    }

    // --- Workspaces ------------------------------------------------------

    async function loadWorkspaces(selectId) {
        const { workspaces } = await api('/api/workspaces');
        const select = $('tmx-workspace');
        select.replaceChildren(...workspaces.map((w) => new Option(`${w.icon || '🗂️'} ${w.name} (${w.role})`, w._id)));

        $('tmx-team-empty').hidden = workspaces.length > 0;
        state.workspaceId = selectId || (workspaces[0] && workspaces[0]._id) || '';
        select.value = state.workspaceId;
        await loadWorkspace();
    }

    async function loadWorkspace() {
        state.workspace = null;
        const projectSelect = $('tmx-project');
        projectSelect.replaceChildren(new Option('All projects', ''));

        if (!state.workspaceId) {
            $('tmx-view').replaceChildren();
            return;
        }

        const { workspace } = await api(`/api/workspaces/${state.workspaceId}`);
        state.workspace = workspace;
        workspace.projects.forEach((p) => projectSelect.appendChild(new Option(`${p.name} (${p.taskCount})`, p._id)));
        projectSelect.value = state.projectId;
        await refreshTeam();
    }

    function scope(extra = {}) {
        const params = new URLSearchParams({ workspaceId: state.workspaceId, ...extra });
        if (state.projectId) params.set('projectId', state.projectId);
        return params.toString();
    }

    async function refreshTeam() {
        if (!state.workspaceId) return;
        document.querySelectorAll('.tmx-view-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
        await VIEWS[state.view]();
    }

    // --- Team views ------------------------------------------------------

    async function renderBoard() {
        const { columns, totals } = await api(`/api/tasks/views/board?${scope()}`);
        const board = el('div', 'tmx-board');

        STATUSES.forEach(([status, label]) => {
            const column = el('div', 'tmx-column');
            column.appendChild(el('div', 'tmx-column-head', `${label} · ${totals[status] || 0}`));

            (columns[status] || []).forEach((task) => {
                const card = taskCard(task);
                card.draggable = true;
                card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', task._id));
                column.appendChild(card);
            });

            column.addEventListener('dragover', (e) => e.preventDefault());
            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                try {
                    await api(`/api/tasks/${e.dataTransfer.getData('text/plain')}/team`, 'PATCH', { status });
                    await refreshTeam();
                } catch (err) {
                    report(err);
                }
            });
            board.appendChild(column);
        });

        $('tmx-view').replaceChildren(board);
    }

    async function renderList() {
        const table = el('table', 'tm-list-table');
        const head = el('tr');
        ['Title', 'Status', 'Priority', 'Due', 'Assignees'].forEach((h) => head.appendChild(el('th', null, h)));
        table.appendChild(el('thead')).appendChild(head);
        const body = table.appendChild(el('tbody'));
        const more = button('LOAD MORE', () => load(more.dataset.cursor));
        more.hidden = true;

        async function load(cursor) {
            const { tasks, nextCursor } = await api(`/api/tasks/views/list?${scope(cursor ? { cursor } : {})}`);
            tasks.forEach((task) => {
                const row = el('tr', 'tmx-clickable');
                [titleOf(task), task.status.replace('_', ' '), task.priority, task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—', assigneeNames(task) || '—']
                    .forEach((value) => row.appendChild(el('td', null, value)));
                row.addEventListener('click', () => openDrawer(task._id));
                body.appendChild(row);
            });
            if (!body.children.length) body.appendChild(el('tr')).appendChild(el('td', 'tmx-empty', 'No tasks yet.'));
            more.hidden = !nextCursor;
            more.dataset.cursor = nextCursor || '';
        }

        const wrap = el('div', 'tm-list-container');
        wrap.append(table, more);
        $('tmx-view').replaceChildren(wrap);
        await load();
    }

    async function renderCalendar() {
        const first = new Date(Date.UTC(state.month.getUTCFullYear(), state.month.getUTCMonth(), 1));
        const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 23, 59, 59));
        const { tasks } = await api(`/api/tasks/views/calendar?${scope({ start: first.toISOString(), end: last.toISOString() })}`);

        const nav = el('div', 'tmx-row');
        const shift = (n) => () => {
            state.month = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + n, 1));
            renderCalendar().catch(report);
        };
        nav.append(
            button('◀', shift(-1)),
            el('strong', null, first.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })),
            button('▶', shift(1))
        );

        const grid = el('div', 'tmx-calendar');
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d) => grid.appendChild(el('div', 'tmx-column-head', d)));
        for (let i = 0; i < first.getUTCDay(); i += 1) grid.appendChild(el('div'));

        for (let date = 1; date <= last.getUTCDate(); date += 1) {
            const cell = el('div', 'tmx-day');
            cell.appendChild(el('span', 'tmx-muted', date));
            tasks
                .filter((t) => new Date(t.dueDate).getUTCDate() === date)
                .forEach((t) => {
                    const chip = el('button', `tmx-chip ${t.status === 'completed' ? 'done' : ''}`, titleOf(t));
                    chip.type = 'button';
                    chip.addEventListener('click', () => openDrawer(t._id));
                    cell.appendChild(chip);
                });
            grid.appendChild(cell);
        }

        $('tmx-view').replaceChildren(nav, grid);
    }

    async function renderWorkload() {
        const { workload, unassigned } = await api(`/api/tasks/views/workload?${scope()}`);
        const container = el('div');
        const rows = workload.map((w) => [personName(w.user), w]);
        if (unassigned) rows.push(['Unassigned', unassigned]);
        if (!rows.length) empty(container, 'No open work.');

        const peak = Math.max(1, ...rows.map(([, r]) => r.estimatedHours));
        rows.forEach(([name, r]) => {
            const row = el('div', 'tmx-load');
            row.appendChild(el('span', null, `${name} — ${r.taskCount} tasks, ${r.estimatedHours}h${r.overdue ? `, ⚠️ ${r.overdue} overdue` : ''}`));
            const bar = el('div', 'tmx-load-bar');
            bar.style.width = `${Math.round((r.estimatedHours / peak) * 100)}%`;
            row.appendChild(bar);
            container.appendChild(row);
        });

        $('tmx-view').replaceChildren(container);
    }

    const VIEWS = { board: renderBoard, list: renderList, calendar: renderCalendar, workload: renderWorkload };

    document.querySelectorAll('.tmx-view-btn').forEach((b) =>
        b.addEventListener('click', () => {
            state.view = b.dataset.view;
            refreshTeam().catch(report);
        })
    );

    $('tmx-workspace').addEventListener('change', (e) => {
        state.workspaceId = e.target.value;
        state.projectId = '';
        loadWorkspace().catch(report);
    });

    $('tmx-project').addEventListener('change', (e) => {
        state.projectId = e.target.value;
        refreshTeam().catch(report);
    });

    $('tmx-new-workspace').addEventListener('click', async () => {
        const name = window.prompt('Workspace name');
        if (!name) return;
        try {
            const { workspace } = await api('/api/workspaces', 'POST', { name });
            await loadWorkspaces(workspace._id);
        } catch (err) {
            report(err);
        }
    });

    $('tmx-new-project').addEventListener('click', async () => {
        if (!state.workspaceId) return report(new Error('Create a workspace first.'));
        const name = window.prompt('Project name');
        if (!name) return;
        try {
            const { project } = await api(`/api/workspaces/${state.workspaceId}/projects`, 'POST', { name });
            state.projectId = project._id;
            await loadWorkspace();
        } catch (err) {
            report(err);
        }
    });

    $('tmx-add-member').addEventListener('click', async () => {
        if (!state.workspaceId) return report(new Error('Create a workspace first.'));
        const email = window.prompt('Teammate email (they need a CreatorOS account)');
        if (!email) return;
        const role = window.prompt('Role: admin, member or guest', 'member');
        if (!role) return;
        try {
            await api(`/api/workspaces/${state.workspaceId}/members`, 'POST', { email, role: role.trim() });
            await loadWorkspace();
        } catch (err) {
            report(err);
        }
    });

    // The personal filter bar does not apply to team views, so hide it there.
    const filterBar = document.querySelector('.tm-filter-bar');
    document.querySelectorAll('.tm-tab-btn').forEach((tab) =>
        tab.addEventListener('click', () => {
            const isTeam = tab.dataset.tab === 'team';
            // Inline style, because the bar's own display rule would beat [hidden].
            if (filterBar) filterBar.style.display = isTeam ? 'none' : '';
            if (isTeam) loadWorkspaces(state.workspaceId).catch(report);
        })
    );

    // --- Create / edit form ----------------------------------------------

    const taskModal = $('tmx-task-modal');
    const form = $('tmx-task-form');
    // Read inputs through .elements so names like "title" never clash with form properties.
    const fields = form.elements;

    /**
     * Open the shared form. `task` is null when creating a team task; when
     * editing, `details` carries the members, projects and permissions.
     */
    function openForm(task, details) {
        state.editing = task;
        form.reset();

        const members = task ? details.members : (state.workspace?.members || []).map((m) => m.userId).filter(Boolean);
        const projects = task ? details.projects : state.workspace?.projects || [];
        const isTeam = task ? Boolean(task.workspaceId) : true;
        const canModerate = task ? details.canModerate : true;

        fields.projectId.replaceChildren(new Option('No project', ''), ...projects.map((p) => new Option(p.name, p._id)));
        fields.assigneeIds.replaceChildren(...members.map((m) => new Option(personName(m), m._id)));
        form.querySelectorAll('[data-team-only]').forEach((n) => { n.hidden = !isTeam; });

        $('tmx-f-title').textContent = task ? '✏️ Edit task' : '⚡ Team task';
        const note = [];

        if (task) {
            fields.title.value = task.title;
            fields.description.value = task.description || '';
            fields.status.value = task.status;
            fields.priority.value = task.priority;
            fields.dueDate.value = day(task.dueDate);
            fields.projectId.value = task.projectId || '';
            fields.visibility.value = task.visibility || 'workspace';
            [...fields.assigneeIds.options].forEach((o) => { o.selected = (task.assigneeIds || []).includes(o.value); });
            if (task.recurring?.isRecurring) {
                fields.frequency.value = task.recurring.frequency;
                fields.interval.value = task.recurring.interval || 1;
                fields.endDate.value = day(task.recurring.endDate);
            }
        } else {
            fields.projectId.value = state.projectId;
        }

        const repeatLocked = Boolean(task && task.seriesId);
        if (repeatLocked) note.push('This task was generated by a repeating task; change the repeat on the original.');
        if (!canModerate) note.push('Only admins or the task author can change assignees, project, visibility or repeat.');

        [fields.projectId, fields.visibility, fields.assigneeIds].forEach((f) => { f.disabled = !canModerate; });
        [fields.frequency, fields.interval, fields.endDate].forEach((f) => { f.disabled = !canModerate || repeatLocked; });
        $('tmx-f-note').textContent = note.join(' ');

        taskModal.hidden = false;
        fields.title.focus();
    }

    function readForm() {
        const payload = {
            title: fields.title.value.trim(),
            description: fields.description.value.trim(),
            status: fields.status.value,
            priority: fields.priority.value,
            dueDate: fields.dueDate.value || null,
        };
        const team = !fields.projectId.closest('[data-team-only]').hidden;

        // Disabled fields are ones this user may not change, so they are not sent.
        if (team && !fields.projectId.disabled) {
            payload.projectId = fields.projectId.value || null;
            payload.visibility = fields.visibility.value;
            payload.assigneeIds = [...fields.assigneeIds.selectedOptions].map((o) => o.value);
        }
        if (!fields.frequency.disabled) {
            payload.recurring = fields.frequency.value
                ? { frequency: fields.frequency.value, interval: fields.interval.value, endDate: fields.endDate.value || undefined, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
                : null;
        }
        return payload;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = readForm();
        const task = state.editing;

        try {
            if (task) await api(`/api/tasks/${task._id}/team`, 'PATCH', payload);
            else await api(`/api/workspaces/${state.workspaceId}/tasks`, 'POST', payload);
            taskModal.hidden = true;

            // Personal tasks live in the existing views, which own their own state.
            if (task && !task.workspaceId) return window.location.reload();
            if (task) await openDrawer(task._id);
            await loadWorkspace();
        } catch (err) {
            report(err);
        }
    });

    $('tmx-new-task').addEventListener('click', () => {
        if (!state.workspaceId) return report(new Error('Create a workspace first.'));
        openForm(null);
    });
    $('tmx-edit').addEventListener('click', () => state.details && openForm(state.details.task, state.details));
    $('tmx-f-close').addEventListener('click', () => { taskModal.hidden = true; });

    // --- Templates -------------------------------------------------------

    const templateModal = $('tmx-template-modal');

    $('tmx-templates').addEventListener('click', async () => {
        $('tmx-template-start').value = new Date().toISOString().slice(0, 10);
        templateModal.hidden = false;
        try {
            const { templates } = await api('/api/task-templates');
            $('tmx-template-list').replaceChildren(
                ...templates.map((t) => {
                    const card = el('div', 'tmx-card');
                    card.appendChild(el('strong', null, `${t.icon} ${t.name}`));
                    card.appendChild(el('span', 'tmx-muted', `${t.steps.length} steps: ${t.steps.join(' → ')}`));
                    card.appendChild(button('USE', () => applyTemplate(t.key), 'neo-btn primary sm'));
                    return card;
                })
            );
        } catch (err) {
            report(err);
        }
    });

    async function applyTemplate(key) {
        try {
            await api(`/api/task-templates/${key}/apply`, 'POST', {
                startDate: $('tmx-template-start').value || undefined,
                workspaceId: state.workspaceId || undefined,
                projectId: state.projectId || undefined,
            });
            templateModal.hidden = true;
            if (state.workspaceId) await loadWorkspace();
            else window.location.reload();
        } catch (err) {
            report(err);
        }
    }

    $('tmx-t-close').addEventListener('click', () => { templateModal.hidden = true; });

    // --- Task details drawer ---------------------------------------------

    async function openDrawer(taskId) {
        state.taskId = taskId;
        drawer.hidden = false;
        try {
            state.details = await api(`/api/tasks/${taskId}/details`);
            renderDetails(state.details);
            loadLinkOptions();
        } catch (err) {
            drawer.hidden = true;
            report(err);
        }
    }

    function closeDrawer() {
        drawer.hidden = true;
        state.taskId = null;
        state.details = null;
    }

    function fillList(container, items, message, render) {
        if (!items.length) empty(container, message);
        else container.replaceChildren(...items.map(render));
    }

    function renderDetails({ task, members }) {
        $('tmx-d-title').textContent = task.title;
        const rule = task.recurring?.isRecurring
            ? `🔁 repeats ${task.recurring.interval > 1 ? `every ${task.recurring.interval} ` : ''}${task.recurring.frequency}`
            : task.seriesId ? '🔁 copy of a repeating task' : '';
        $('tmx-d-summary').textContent = [
            task.status.replace('_', ' '),
            task.priority,
            task.dueDate && `due ${new Date(task.dueDate).toLocaleDateString()}`,
            assigneeNames(task) && `👤 ${assigneeNames(task)}`,
            rule,
        ].filter(Boolean).join(' · ');
        $('tmx-watch').textContent = state.details.watching ? '👁️ WATCHING' : '👁️ WATCH';

        $('tmx-mentions-label').hidden = !members.length;
        $('tmx-mentions').replaceChildren(...members.map((m) => new Option(`@${personName(m)}`, m._id)));

        fillList($('tmx-comments'), task.comments.slice().reverse(), 'No comments yet.', (c) => {
            const item = el('div', 'tmx-comment');
            item.appendChild(el('span', 'tmx-muted', `${personName(c.authorId)} · ${when(c.createdAt)}`));
            item.appendChild(el('p', 'tmx-body', c.body));
            if (c.mentions.length) item.appendChild(el('span', 'tmx-muted', c.mentions.map((m) => `@${personName(m)}`).join(' ')));
            c.attachments.forEach((a) => {
                const link = el('a', null, `📎 ${a.name}`);
                link.href = a.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                item.appendChild(link);
            });
            item.appendChild(button('Delete', () => mutate(`/api/tasks/${task._id}/comments/${c._id}`, 'DELETE')));
            return item;
        });

        fillList($('tmx-deps'), task.dependencies, 'Not blocked by anything.', (d) => {
            const row = el('div', 'tmx-row');
            row.appendChild(el('span', null, `${d.status === 'completed' ? '✅' : '⛔'} ${d.title}`));
            row.appendChild(button('✕', () => mutate(`/api/tasks/${task._id}/dependencies/${d._id}`, 'DELETE')));
            return row;
        });
        loadDependencyOptions(task);

        fillList($('tmx-links'), task.links, 'No linked records.', (l) => {
            const row = el('div', 'tmx-row');
            row.appendChild(el('span', null, `${l.module.replace(/_/g, ' ')}: ${l.label}`));
            row.appendChild(button('✕', () => mutate(`/api/tasks/${task._id}/links/${l._id}`, 'DELETE')));
            return row;
        });

        fillList($('tmx-activity'), task.activity.slice().reverse(), 'No activity yet.', (a) => {
            let change = '';
            if (a.from && a.to) change = ` (${a.from} → ${a.to})`;
            else if (a.to || a.from) change = `: ${a.to || a.from}`;
            return el('div', 'tmx-muted', `${when(a.at)} · ${personName(a.actorId)} ${a.type.replace(/_/g, ' ')}${change}`);
        });
    }

    async function loadDependencyOptions(task) {
        const select = $('tmx-dep-select');
        select.replaceChildren(new Option('Select a prerequisite…', ''));
        const params = task.workspaceId ? `?workspaceId=${task.workspaceId}&limit=200` : '?limit=200';
        try {
            const { tasks } = await api(`/api/tasks/views/list${params}`);
            tasks
                .filter((t) => t._id !== task._id && !task.dependencies.some((d) => d._id === t._id))
                .forEach((t) => select.appendChild(new Option(t.title, t._id)));
        } catch (err) {
            // The picker is a convenience; the drawer still works without it.
        }
    }

    let linkSearchTimer;
    async function loadLinkOptions() {
        const select = $('tmx-link-ref');
        const params = new URLSearchParams({ module: $('tmx-link-module').value, search: $('tmx-link-search').value });
        try {
            const { options } = await api(`/api/tasks/link-options?${params}`);
            select.replaceChildren(
                new Option(options.length ? 'Choose a record…' : 'No matching records', ''),
                ...options.map((o) => new Option(o.label, o._id))
            );
        } catch (err) {
            select.replaceChildren(new Option('Could not load records', ''));
        }
    }

    $('tmx-link-module').addEventListener('change', loadLinkOptions);
    $('tmx-link-search').addEventListener('input', () => {
        clearTimeout(linkSearchTimer);
        linkSearchTimer = setTimeout(loadLinkOptions, 300);
    });

    async function mutate(url, method, body) {
        try {
            await api(url, method, body);
            await openDrawer(state.taskId);
            if (state.workspaceId) refreshTeam().catch(() => {});
        } catch (err) {
            report(err);
        }
    }

    /** Upload through the existing file-upload route, which accepts images. */
    async function uploadAttachments(files) {
        const uploaded = [];
        for (const file of files) {
            const data = new FormData();
            data.append('file', file);
            const res = await fetch('/services/file-upload/upload', {
                method: 'POST',
                headers: { 'x-csrf-token': csrf() },
                body: data,
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.url) {
                throw new Error(`Could not upload ${file.name}: ${json.error || json.message || `server responded ${res.status}`}`);
            }
            uploaded.push({ name: json.filename || file.name, url: json.url });
        }
        return uploaded;
    }

    $('tmx-comment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = $('tmx-comment-body').value.trim();
        if (!body) return;
        const submit = e.submitter;
        if (submit) submit.disabled = true;

        try {
            const attachments = await uploadAttachments([...$('tmx-attach').files]);
            const mentions = [...$('tmx-mentions').selectedOptions].map((o) => o.value);
            await api(`/api/tasks/${state.taskId}/comments`, 'POST', { body, mentions, attachments });
            $('tmx-comment-body').value = '';
            $('tmx-attach').value = '';
            await openDrawer(state.taskId);
        } catch (err) {
            report(err);
        } finally {
            if (submit) submit.disabled = false;
        }
    });

    $('tmx-dep-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const dependsOnId = $('tmx-dep-select').value;
        if (dependsOnId) mutate(`/api/tasks/${state.taskId}/dependencies`, 'POST', { dependsOnId });
    });

    $('tmx-link-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const refId = $('tmx-link-ref').value;
        if (refId) mutate(`/api/tasks/${state.taskId}/links`, 'POST', { module: $('tmx-link-module').value, refId });
    });

    $('tmx-watch').addEventListener('click', async () => {
        try {
            const { watching } = await api(`/api/tasks/${state.taskId}/watch`, 'POST', {});
            $('tmx-watch').textContent = watching ? '👁️ WATCHING' : '👁️ WATCH';
        } catch (err) {
            report(err);
        }
    });

    $('tmx-d-close').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!taskModal.hidden) taskModal.hidden = true;
        else if (!templateModal.hidden) templateModal.hidden = true;
        else closeDrawer();
    });

    // Personal Kanban cards open the same drawer; their own buttons keep working.
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.tm-task-card');
        if (card && !e.target.closest('button') && card.dataset.taskId) openDrawer(card.dataset.taskId);
    });
});
