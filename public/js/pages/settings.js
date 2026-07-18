(function () {
    const body = document.body;
    const userData = JSON.parse(body.getAttribute('data-user') || '{}');
    const isGuest = !!userData.isGuestContributor;

    const toastEl = document.getElementById('toast');
    let toastTimer;
    let toastStart;
    let remainingTime = 4000;

    function initTopbar() {
        const layout = document.getElementById('dashboardLayout');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const themeToggle = document.getElementById('theme-toggle');
        const iconLight = themeToggle ? themeToggle.querySelector('.icon-light') : null;
        const iconDark = themeToggle ? themeToggle.querySelector('.icon-dark') : null;

        if (layout && sidebarToggle) {
            const sidebarState = localStorage.getItem('creatorosSidebarCollapsed');
            if (sidebarState === 'true') {
                layout.classList.add('sidebar-collapsed');
                sidebarToggle.setAttribute('aria-expanded', 'false');
            }

            sidebarToggle.addEventListener('click', () => {
                const isCollapsed = layout.classList.toggle('sidebar-collapsed');
                sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
                localStorage.setItem('creatorosSidebarCollapsed', String(isCollapsed));
            });
        }

        if (themeToggle) {
            themeToggle.addEventListener('click', async () => {
                const nextMode = body.classList.contains('appearance-dark') ? 'light' : 'dark';
                document.querySelectorAll('#appearance-group .radio-btn').forEach((btn) => {
                    btn.classList.toggle('active', btn.dataset.val === nextMode);
                });
                try {
                    await updatePreferences({ appearanceMode: nextMode });
                } catch (err) {
                    showToast(err.message, true);
                }
            });
        }

        function syncThemeIcon() {
            const isDark = body.classList.contains('appearance-dark');
            if (iconLight) iconLight.style.display = isDark ? 'none' : 'block';
            if (iconDark) iconDark.style.display = isDark ? 'block' : 'none';
        }

        window.addEventListener('creatorosSettingsAppearanceChanged', syncThemeIcon);
        syncThemeIcon();
    }

    function startToastTimer() {
        toastStart = Date.now();
        toastTimer = setTimeout(() => {
            toastEl.classList.remove('visible');
        }, remainingTime);
    }

    function showToast(message, isError) {
        if (toastEl.classList.contains('visible') && toastEl.textContent === message) {
            return;
        }

        clearTimeout(toastTimer);
        remainingTime = 4000;
        toastEl.textContent = message;
        toastEl.classList.remove('success', 'error');
        toastEl.classList.add(isError ? 'error' : 'success');
        toastEl.classList.add('visible');
        startToastTimer();
    }

    toastEl.addEventListener('mouseenter', () => {
        clearTimeout(toastTimer);
        remainingTime -= Date.now() - toastStart;
    });

    toastEl.addEventListener('mouseleave', () => {
        startToastTimer();
    });


    function playSoundCue() {
        if (!userData.preferences?.soundCues) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 520;
            gain.gain.value = 0.04;
            osc.start();
            osc.stop(ctx.currentTime + 0.06);
        } catch (_) {
            /* optional */
        }
    }

    async function apiRequest(url, options) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
        const res = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
                ...(options && options.headers ? options.headers : {}),
            },
        });
        let payload = null;
        try {
            payload = await res.json();
        } catch (_) {
            payload = null;
        }
        if (!res.ok) {
            const msg = payload?.error || payload?.message || res.statusText || 'Request failed';
            throw new Error(msg);
        }
        return payload;
    }

    async function updatePreferences(prefs) {
        const result = await apiRequest('/api/settings/preferences', {
            method: 'PUT',
            body: JSON.stringify(prefs),
        });
        userData.preferences = { ...userData.preferences, ...result.preferences };
        applyPreferences();
        showToast('Preferences saved');
        playSoundCue();
    }

    function resolveAppearance(mode) {
        if (mode === 'system') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return mode;
    }

    function applyPreferences() {
        const prefs = userData.preferences || {};
        body.classList.remove('density-compact', 'density-tactile', 'appearance-light', 'appearance-dark', 'no-motion');
        body.classList.add(`density-${prefs.interfaceDensity || 'tactile'}`);
        const resolved = resolveAppearance(prefs.appearanceMode || 'light');
        body.classList.add(`appearance-${resolved}`);
        if (!prefs.motionEffects) body.classList.add('no-motion');
        localStorage.setItem('creatorosAppearance', prefs.appearanceMode || 'light');
        localStorage.setItem('creatorosDensity', prefs.interfaceDensity || 'tactile');
        localStorage.setItem('creatorosMotion', String(!!prefs.motionEffects));
        localStorage.setItem('creatorosAutoSaveLinks', String(!!prefs.autoSaveLinks));
        window.dispatchEvent(new Event('creatorosSettingsAppearanceChanged'));
    }

    function updateHeaderProfile(name) {
        const parts = name.split(' ').filter(Boolean).slice(0, 2);
        const initials = parts.map((p) => p[0].toUpperCase()).join('') || 'CR';
        const profileName = document.querySelector('.profile-chip .profile-name');
        const avatar = document.querySelector('.profile-chip .avatar');
        if (profileName) profileName.textContent = name;
        if (avatar) avatar.textContent = initials;
        userData.name = name;
        userData.initials = initials;
    }

    // Sub-nav scroll + active state
    const subNavItems = document.querySelectorAll('.sub-nav-item');
    const sections = ['profile', 'security', 'billing', 'global'].map((id) => document.getElementById(id));

    subNavItems.forEach((anchor) => {
        anchor.addEventListener('click', (e) => {
            e.preventDefault();
            const id = anchor.getAttribute('href').slice(1);
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: userData.preferences?.motionEffects === false ? 'auto' : 'smooth' });
                subNavItems.forEach((a) => a.classList.remove('active'));
                anchor.classList.add('active');
            }
            playSoundCue();
        });
    });

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    subNavItems.forEach((a) => {
                        a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
                    });
                }
            });
        },
        { rootMargin: '-30% 0px -55% 0px', threshold: 0 }
    );
    sections.forEach((s) => s && observer.observe(s));

    // Profile form
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isGuest) return showToast('Contributors cannot update profile', true);
        try {
            const payload = await apiRequest('/api/settings/profile', {
                method: 'PUT',
                body: JSON.stringify({
                    name: document.getElementById('profile-name').value.trim(),
                    alias: document.getElementById('profile-alias').value.trim(),
                    bio: document.getElementById('profile-bio').value.trim(),
                }),
            });
            updateHeaderProfile(payload.user.name);
            showToast('Profile updated successfully');
            playSoundCue();
        } catch (err) {
            showToast(err.message, true);
        }
    });

    // 2FA toggle
    const tfaToggle = document.getElementById('tfa-toggle');
    function bindToggle(el, onChange) {
        const handler = async () => {
            if (isGuest && el.id === 'tfa-toggle') {
                return showToast('Contributors cannot change security settings', true);
            }
            await onChange(el);
        };
        el.addEventListener('click', handler);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handler();
            }
        });
    }

    bindToggle(tfaToggle, async (el) => {
        const enabled = el.classList.contains('off');
        try {
            await apiRequest('/api/settings/security/2fa', {
                method: 'PUT',
                body: JSON.stringify({ enabled }),
            });
            el.classList.toggle('off', !enabled);
            el.setAttribute('aria-checked', String(enabled));
            showToast(enabled ? '2FA enabled' : '2FA disabled');
            playSoundCue();
        } catch (err) {
            showToast(err.message, true);
        }
    });

    // Password
    document.getElementById('change-pwd-btn').addEventListener('click', () => {
        document.getElementById('pwd-form').classList.toggle('open');
    });

    document.getElementById('save-pwd-btn').addEventListener('click', async () => {
        if (isGuest) return showToast('Contributors cannot change password', true);
        try {
            const result = await apiRequest('/api/settings/security/password', {
                method: 'PUT',
                body: JSON.stringify({
                    oldPassword: document.getElementById('old-pwd').value,
                    newPassword: document.getElementById('new-pwd').value,
                }),
            });
            document.getElementById('pwd-form').classList.remove('open');
            document.getElementById('old-pwd').value = '';
            document.getElementById('new-pwd').value = '';
            const days = result.passwordAgeDays ?? 0;
            document.getElementById('pwd-age-text').textContent = `Last updated ${days} day${days === 1 ? '' : 's'} ago`;
            showToast('Password changed successfully');
            playSoundCue();
        } catch (err) {
            showToast(err.message, true);
        }
    });

    // Account deletion
    document.getElementById('deactivate-btn').addEventListener('click', async () => {
        if (isGuest) return showToast('Contributors cannot delete accounts', true);
        showDeletionModal();
    });

    function showDeletionModal() {
        const deletionModal = document.getElementById('deletion-modal');
        deletionModal.classList.add('open');
        deletionModal.setAttribute('aria-hidden', 'false');
        playSoundCue();
    }

    function hideDeletionModal() {
        const deletionModal = document.getElementById('deletion-modal');
        deletionModal.classList.remove('open');
        deletionModal.setAttribute('aria-hidden', 'true');
        document.getElementById('deletion-password').value = '';
    }

    const deletionModal = document.getElementById('deletion-modal');
    document.getElementById('deletion-modal-close').addEventListener('click', hideDeletionModal);
    deletionModal.addEventListener('click', (e) => {
        if (e.target === deletionModal) hideDeletionModal();
    });

    document.getElementById('confirm-deletion-btn').addEventListener('click', async () => {
        const password = document.getElementById('deletion-password').value;
        if (!password) {
            return showToast('Please enter your password', true);
        }

        const confirmText = document.getElementById('deletion-confirm-text').value;
        if (confirmText !== 'DELETE') {
            return showToast('Please type DELETE to confirm', true);
        }

        try {
            const result = await apiRequest('/api/settings/account/request-deletion', {
                method: 'POST',
                body: JSON.stringify({ password }),
            });
            hideDeletionModal();
            showToast(result.message);
            updateDeletionStatusUI(result.scheduledDeletionAt, result.daysUntilDeletion);
        } catch (err) {
            showToast(err.message, true);
        }
    });

    document.getElementById('cancel-deletion-btn').addEventListener('click', async () => {
        try {
            await apiRequest('/api/settings/account/cancel-deletion', { method: 'POST' });
            showToast('Account deletion cancelled');
            updateDeletionStatusUI(null, 0);
        } catch (err) {
            showToast(err.message, true);
        }
    });

    function updateDeletionStatusUI(scheduledDate, daysRemaining) {
        const dangerZone = document.querySelector('.danger-zone');
        const deactivateBtn = document.getElementById('deactivate-btn');
        const existingStatus = document.getElementById('deletion-status');
        
        if (existingStatus) existingStatus.remove();
        
        if (scheduledDate) {
            const statusHtml = `
                <div id="deletion-status" class="deletion-status">
                    <div class="deletion-status-info">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zM7.25 4.5a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0v-3.5zM8 9.75a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
                        </svg>
                        <span>Account deletion scheduled for <strong>${new Date(scheduledDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong> (${daysRemaining} day(s) remaining)</span>
                    </div>
                    <button type="button" class="btn-secondary btn-cancel-deletion" id="cancel-deletion-inline">Cancel Deletion</button>
                </div>
            `;
            dangerZone.insertAdjacentHTML('afterend', statusHtml);
            deactivateBtn.disabled = true;
            deactivateBtn.style.opacity = '0.5';
            
            document.getElementById('cancel-deletion-inline').addEventListener('click', async () => {
                try {
                    await apiRequest('/api/settings/account/cancel-deletion', { method: 'POST' });
                    showToast('Account deletion cancelled');
                    updateDeletionStatusUI(null, 0);
                } catch (err) {
                    showToast(err.message, true);
                }
            });
        } else {
            deactivateBtn.disabled = false;
            deactivateBtn.style.opacity = '1';
        }
    }

    function checkDeletionStatus() {
        const scheduledDate = userData.scheduledDeletionAt;
        if (scheduledDate) {
            const daysRemaining = Math.ceil((new Date(scheduledDate) - new Date()) / (1000 * 60 * 60 * 24));
            updateDeletionStatusUI(scheduledDate, daysRemaining);
        }
    }
    checkDeletionStatus();

    // Preferences radios
    document.querySelectorAll('#appearance-group .radio-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('#appearance-group .radio-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            try {
                await updatePreferences({ appearanceMode: btn.dataset.val });
            } catch (err) {
                showToast(err.message, true);
            }
        });
    });

    document.querySelectorAll('#density-group .radio-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('#density-group .radio-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            try {
                await updatePreferences({ interfaceDensity: btn.dataset.val });
            } catch (err) {
                showToast(err.message, true);
            }
        });
    });

    document.querySelectorAll('.pref-toggle').forEach((toggle) => {
        bindToggle(toggle, async (el) => {
            const key = el.dataset.key;
            const val = el.classList.contains('off');
            try {
                await updatePreferences({ [key]: val });
                el.classList.toggle('off', !val);
                el.setAttribute('aria-checked', String(val));
            } catch (err) {
                showToast(err.message, true);
            }
        });
    });

    // Billing
    async function refreshBilling() {
        try {
            const billing = await apiRequest('/api/settings/billing');
            document.getElementById('plan-name').textContent = billing.planName;
            document.getElementById('plan-price').textContent = billing.priceMonthly;
            document.getElementById('next-invoice-date').textContent = billing.nextInvoiceLabel;
            document.getElementById('invoice-est').textContent = `Estimated: ${billing.estimatedTotal}`;
            document.getElementById('card-info-text').textContent = `${billing.cardBrand} ending in ${billing.cardLast4}`;
            const tbody = document.querySelector('#invoices-table tbody');
            tbody.innerHTML = billing.invoices
                .map(
                    (inv) => `<tr data-invoice-id="${inv.invoiceId}">
                        <td>${inv.date}</td>
                        <td>${inv.invoiceId}</td>
                        <td>${inv.amount}</td>
                        <td><span class="badge-paid">${inv.status}</span></td>
                    </tr>`
                )
                .join('');
            bindInvoiceRows();
        } catch (_) {
            /* server-rendered fallback */
        }
    }

    const billingModal = document.getElementById('billing-modal');
    document.getElementById('manage-subscription-btn').addEventListener('click', () => {
        billingModal.classList.add('open');
        billingModal.setAttribute('aria-hidden', 'false');
        playSoundCue();
    });
    document.getElementById('billing-modal-close').addEventListener('click', () => {
        billingModal.classList.remove('open');
        billingModal.setAttribute('aria-hidden', 'true');
    });
    billingModal.addEventListener('click', (e) => {
        if (e.target === billingModal) {
            billingModal.classList.remove('open');
            billingModal.setAttribute('aria-hidden', 'true');
        }
    });

    const invoiceModal = document.getElementById('invoice-modal');
    function bindInvoiceRows() {
        document.querySelectorAll('#invoices-table tbody tr').forEach((row) => {
            row.onclick = () => {
                const cells = row.querySelectorAll('td');
                document.getElementById('invoice-modal-body').textContent =
                    `Invoice ${cells[1].textContent} for ${cells[2].textContent} on ${cells[0].textContent} — Status: ${cells[3].textContent.trim()}`;
                invoiceModal.classList.add('open');
                invoiceModal.setAttribute('aria-hidden', 'false');
                invoiceModal.dataset.invoiceId = row.dataset.invoiceId || cells[1].textContent;
                playSoundCue();
            };
        });
    }
    bindInvoiceRows();

    document.getElementById('invoice-modal-close').addEventListener('click', () => {
        invoiceModal.classList.remove('open');
        invoiceModal.setAttribute('aria-hidden', 'true');
    });
    document.getElementById('invoice-download-btn').addEventListener('click', () => {
        const id = invoiceModal.dataset.invoiceId || 'invoice';
        const blob = new Blob([`CreatorOS Invoice ${id}\nGenerated: ${new Date().toISOString()}`], {
            type: 'text/plain',
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${id.replace('#', '')}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('Invoice downloaded');
    });

    const upgradePlanBtn = document.getElementById('upgrade-plan-btn');
    if (upgradePlanBtn) {
        upgradePlanBtn.addEventListener('click', (e) => {
            e.preventDefault();
            billingModal.querySelector('#billing-modal-title').textContent = 'Upgrade Plan';
            billingModal.querySelector('#billing-modal-body').textContent =
                'Team and Enterprise tiers are coming soon. Contact support to join the early access list.';
            billingModal.classList.add('open');
        });
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (userData.preferences?.appearanceMode === 'system') applyPreferences();
    });

    applyPreferences();
    initTopbar();
    refreshBilling();

    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get('message');
    if (message === 'deletion_confirmed') {
        showToast('Account deletion confirmed. Your account will be deleted in 30 days.');
        checkDeletionStatus();
    } else if (message === 'deletion_already_confirmed') {
        showToast('Account deletion was already confirmed.');
    }

    window.history.replaceState({}, document.title, window.location.pathname);
})();
