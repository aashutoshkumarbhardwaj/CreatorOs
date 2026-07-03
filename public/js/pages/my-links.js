(async function () {
    const body = document.body;
    const userData = JSON.parse(body.getAttribute('data-user') || '{}');
    const isGuest = !!userData.isGuestContributor;

    const toastEl = document.getElementById('toast');
    const feedEl = document.getElementById('links-feed');
    const emptyEl = document.getElementById('empty-state');
    const searchInput = document.getElementById('link-search');
    const shortenForm = document.getElementById('shorten-form');
    const resultBanner = document.getElementById('result-banner');
    const resultText = document.getElementById('result-text');

    let allLinks = [];
    let sortMode = 'date';
    let lastCreatedUrl = '';

    function showToast(message, isError) {
        toastEl.textContent = message;
        toastEl.classList.toggle('error', !!isError);
        toastEl.classList.add('visible');
        setTimeout(() => toastEl.classList.remove('visible'), 3200);
    }

    async function apiRequest(url, options) {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            ...options,
        });
        let payload = null;
        try {
            payload = await res.json();
        } catch (_) {
            payload = null;
        }
        if (!res.ok) {
            throw new Error(payload?.error || payload?.message || 'Request failed');
        }
        return payload;
    }

    function tagLabel(tag) {
        return (tag || 'active').toUpperCase();
    }

    function filterAndSortLinks() {
        const query = searchInput.value.trim().toLowerCase();
        let links = [...allLinks];

        if (query) {
            links = links.filter(
                (l) =>
                    l.title.toLowerCase().includes(query) ||
                    l.shortUrl.toLowerCase().includes(query) ||
                    l.redirectUrl.toLowerCase().includes(query) ||
                    l.shortId.toLowerCase().includes(query)
            );
        }

        if (sortMode === 'clicks') {
            links.sort((a, b) => b.totalClicks - a.totalClicks);
        } else {
            links.sort((a, b) => new Date(b.linkedAt) - new Date(a.linkedAt));
        }

        return links;
    }

   function renderLinks() {
    const skeleton = document.getElementById('links-skeleton');

    if (skeleton) {
        skeleton.style.display = 'none';
    }

    const links = filterAndSortLinks();
        feedEl.querySelectorAll('.link-card').forEach((el) => el.remove());

        if (links.length === 0) {
            emptyEl.style.display = 'block';
            if (searchInput.value.trim()) {
                emptyEl.querySelector('h4').textContent = 'No matches';
                emptyEl.querySelector('p').textContent = 'Try a different search term.';
            } else {
                emptyEl.querySelector('h4').textContent = 'No links yet';
                emptyEl.querySelector('p').textContent =
                    'Paste a URL above and hit SHORTEN NOW to create your first link.';
            }
            return;
        }

        emptyEl.style.display = 'none';

        links.forEach((link) => {
            const card = document.createElement('article');
            card.className = 'link-card';
            card.innerHTML = `
                <div>
                    <div class="link-card-top">
                        <span class="link-tag ${link.tag}">${tagLabel(link.tag)}</span>
                        <span style="font-size:0.72rem;color:#888;">${link.linkedAtLabel}</span>
                    </div>
                    <h4 class="link-title">${escapeHtml(link.title)}</h4>
                    <p class="link-short">${escapeHtml(link.shortUrl)}</p>
                    <p class="link-dest">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
                        ${escapeHtml(truncateUrl(link.redirectUrl))}
                    </p>
                    <div class="link-actions">
                        <button type="button" class="link-action-btn copy-btn" data-url="${escapeAttr(link.shortUrl)}">Copy</button>
                        <a href="${escapeAttr(link.shortUrl)}" target="_blank" rel="noopener" class="link-action-btn">Open</a>
                        <button type="button" class="link-action-btn analytics-btn" data-id="${escapeAttr(link.shortId)}">Analytics</button>
                    </div>
                </div>
                <div class="link-clicks">
                    <strong>${escapeHtml(link.clicksLabel)}</strong>
                    <span>Clicks</span>
                </div>
            `;
            feedEl.appendChild(card);
        });

        feedEl.querySelectorAll('.copy-btn').forEach((btn) => {
            btn.addEventListener('click', () => copyText(btn.dataset.url, 'Link copied!'));
        });

        feedEl.querySelectorAll('.analytics-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                try {
                    const data = await apiRequest(`/api/urls/analytics/${btn.dataset.id}`);
                    showToast(`${data.totalClicks} total clicks recorded`);
                } catch (err) {
                    showToast(err.message, true);
                }
            });
        });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        return escapeHtml(str).replace(/'/g, '&#39;');
    }

    function truncateUrl(url, max = 48) {
        if (url.length <= max) return url;
        return url.slice(0, max) + '…';
    }

    async function copyText(text, msg) {
        try {
            await navigator.clipboard.writeText(text);
            showToast(msg || 'Copied!');
        } catch (_) {
            showToast('Could not copy', true);
        }
    }

    function updateStats(stats) {
        document.getElementById('stat-total-links').textContent = stats.totalLinks;
        document.getElementById('stat-total-clicks').textContent = stats.totalClicksLabel;
        document.getElementById('stat-top-link').textContent =
            stats.topLinkTitle !== '—'
                ? `${stats.topLinkTitle} (${stats.topLinkClicks} clicks)`
                : '—';
    }

    async function loadLinks() {
        try {
            const data = await apiRequest('/api/urls');
            allLinks = data.links || [];
            updateStats(data.stats || { totalLinks: 0, totalClicksLabel: '0', topLinkTitle: '—' });
            if (data.domain) {
                document.getElementById('domain-label').textContent = data.domain + '/';
            }
            renderLinks();
        } catch (err) {
            showToast(err.message, true);
        }
    }

    emptyEl.style.display = 'none';
    loadLinks();

    document.getElementById('copy-result-btn').addEventListener('click', () => {
        if (lastCreatedUrl) copyText(lastCreatedUrl, 'Short link copied!');
    });

    document.getElementById('slug-toggle').addEventListener('click', () => {
        document.getElementById('slug-panel').classList.toggle('open');
    });

    searchInput.addEventListener('input', renderLinks);

    document.getElementById('sort-date').addEventListener('click', () => {
        sortMode = 'date';
        document.getElementById('sort-date').classList.add('active');
        document.getElementById('sort-clicks').classList.remove('active');
        renderLinks();
    });

    document.getElementById('sort-clicks').addEventListener('click', () => {
        sortMode = 'clicks';
        document.getElementById('sort-clicks').classList.add('active');
        document.getElementById('sort-date').classList.remove('active');
        renderLinks();
    });

    document.getElementById('scroll-shorten-btn').addEventListener('click', () => {
        document.getElementById('shorten-section').scrollIntoView({ behavior: 'smooth' });
        document.getElementById('redirect-url').focus();
    });

    document.getElementById('widget-new-btn').addEventListener('click', () => {
        document.getElementById('scroll-shorten-btn').click();
    });

    const emptyCTA = document.getElementById('empty-state-cta');

if (emptyCTA) {
    emptyCTA.addEventListener('click', () => {
        document.getElementById('shorten-section')
            ?.scrollIntoView({ behavior: 'smooth' });

        document.getElementById('redirect-url')
            ?.focus();
    });
}
})();
