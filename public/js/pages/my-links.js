(async function () {
  const body = document.body;
  const userData = JSON.parse(body.getAttribute("data-user") || "{}");
  const isGuest = !!userData.isGuestContributor;

  const toastEl = document.getElementById("toast");
  const feedEl = document.getElementById("links-feed");
  const emptyEl = document.getElementById("empty-state");
  const searchInput = document.getElementById("link-search");
  const shortenForm = document.getElementById("shorten-form");
  const resultBanner = document.getElementById("result-banner");
  const resultText = document.getElementById("result-text");
  const duplicateBanner = document.getElementById("duplicate-banner");
  const duplicateText = document.getElementById("duplicate-text");

  // Initialize Zustag store
  const useStore = window.zustag.createStore((set, get) => ({
    allLinks: [],
    sortMode: "date",
    viewMode: "active", // 'active' | 'favorites' | 'archived'
    lastCreatedUrl: "",
  }));

  let pendingDuplicateLink = null; // set when the create form gets a duplicate response

  // Subscribe to store changes to trigger UI updates
  useStore.subscribe((state, prevState) => {
    if (
      state.allLinks !== prevState.allLinks ||
      state.sortMode !== prevState.sortMode
    ) {
      renderLinks();
    }
    if (state.lastCreatedUrl !== prevState.lastCreatedUrl) {
      if (state.lastCreatedUrl) {
        resultText.textContent = state.lastCreatedUrl;
        resultBanner.style.display = "flex";
      } else {
        resultBanner.style.display = "none";
      }
    }
  });

  function showToast(message, isError) {
    toastEl.textContent = message;
    toastEl.classList.toggle("error", !!isError);
    toastEl.classList.add("visible");
    setTimeout(() => toastEl.classList.remove("visible"), 3200);
  }

  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)_csrf=([^;]*)/);
    return match
      ? decodeURIComponent(match[1])
      : document.body.getAttribute("data-csrf") ||
          document.querySelector('meta[name="csrf-token"]')?.content ||
          "";
  }

  async function apiRequest(url, options = {}) {
    const csrfToken = getCsrfToken();
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(url, {
      ...options,
      headers,
    });
    let payload = null;
    try {
      payload = await res.json();
    } catch (_) {
      payload = null;
    }
    if (!res.ok) {
      throw new Error(payload?.error || payload?.message || "Request failed");
    }
    return payload;
  }

  // Bulk import needs multipart/form-data, so it can't go through apiRequest's JSON headers.
  async function apiRequestForm(url, formData) {
    const csrfToken = getCsrfToken();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body: formData,
    });
    let payload = null;
    try {
      payload = await res.json();
    } catch (_) {
      payload = null;
    }
    if (!res.ok) {
      throw new Error(payload?.error || payload?.message || "Request failed");
    }
    return payload;
  }

  function tagLabel(tag) {
    return (tag || "active").toUpperCase();
  }

  function parseTagsInput(value) {
    return (value || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function filterAndSortLinks() {
    const query = (searchInput ? searchInput.value : "").trim().toLowerCase();
    const { allLinks, sortMode } = useStore.getState();
    let links = [...allLinks];

    if (query) {
      links = links.filter(
        (l) =>
          l.title.toLowerCase().includes(query) ||
          l.shortUrl.toLowerCase().includes(query) ||
          l.redirectUrl.toLowerCase().includes(query) ||
          l.shortId.toLowerCase().includes(query) ||
          (l.tags || []).some((t) => t.toLowerCase().includes(query)),
      );
    }

    if (sortMode === "clicks") {
      links.sort((a, b) => b.totalClicks - a.totalClicks);
    } else {
      links.sort((a, b) => new Date(b.linkedAt) - new Date(a.linkedAt));
    }

    return links;
  }

  function renderLinks() {
    const skeleton = document.getElementById("links-skeleton");

    if (skeleton) {
      skeleton.style.display = "none";
    }

    const links = filterAndSortLinks();
    feedEl.querySelectorAll(".link-card").forEach((el) => el.remove());

    if (links.length === 0) {
      emptyEl.style.display = "block";
      if (searchInput.value.trim()) {
        emptyEl.querySelector("h4").textContent = "No matches";
        emptyEl.querySelector("p").textContent = "Try a different search term.";
      } else {
        const mode = useStore.getState().viewMode;
        emptyEl.querySelector("h4").textContent =
          mode === "favorites"
            ? "No favorites yet"
            : mode === "archived"
              ? "Nothing archived"
              : "No links yet";
        emptyEl.querySelector("p").textContent =
          mode === "active"
            ? "Paste a URL above and hit SHORTEN NOW to create your first link."
            : mode === "favorites"
              ? "Star a link to pin it here."
              : "Links you archive will show up here.";
      }
      return;
    }

    emptyEl.style.display = "none";

    links.forEach((link) => {
      const card = document.createElement("article");
      card.className = "link-card";

      const badges = [];
      if (link.hasPassword)
        badges.push(
          '<span class="badge-retro" title="Password protected">🔒</span>',
        );
      if (link.expiresAt) {
        badges.push(
          `<span class="badge-retro" style="${link.isExpired ? "background:#F8D7DA;" : ""}" title="Expires">${link.isExpired ? "Expired" : "Expires " + new Date(link.expiresAt).toLocaleDateString()}</span>`,
        );
      }
      const tagChips = (link.tags || [])
        .map(
          (t) =>
            `<span class="badge-retro" style="background:var(--bg-secondary);">${escapeHtml(t)}</span>`,
        )
        .join("");

      card.innerHTML = `
                <div>
                    <div class="link-card-top">
                        <span class="link-tag ${link.tag}">${tagLabel(link.tag)}</span>
                        ${badges.join("")}
                        ${tagChips}
                        <span style="font-size:0.72rem;color:#888;">${link.linkedAtLabel}</span>
                    </div>
                    <h4 class="link-title">
                        <button type="button" class="fav-btn" data-id="${escapeAttr(link.shortId)}" title="${link.favorite ? "Unfavorite" : "Favorite"}" style="background:none;border:none;cursor:pointer;font-size:1rem;vertical-align:middle;">${link.favorite ? "★" : "☆"}</button>
                        ${escapeHtml(link.title)}
                    </h4>
                    <p class="link-short">${escapeHtml(link.shortUrl)}</p>
                    <p class="link-dest">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
                        ${escapeHtml(truncateUrl(link.redirectUrl))}
                    </p>
                    <div class="link-actions">
                        <button type="button" class="link-action-btn copy-btn" data-url="${escapeAttr(link.shortUrl)}">Copy</button>
                        <a href="${escapeAttr(link.shortUrl)}" target="_blank" rel="noopener" class="link-action-btn open-btn" data-id="${escapeAttr(link.shortId)}">Open</a>
                        <button type="button" class="link-action-btn analytics-btn" data-id="${escapeAttr(link.shortId)}">Analytics</button>
                        <button type="button" class="link-action-btn edit-btn" data-id="${escapeAttr(link.shortId)}">Edit</button>
                        <button type="button" class="link-action-btn archive-btn" data-id="${escapeAttr(link.shortId)}">${link.archived ? "Unarchive" : "Archive"}</button>
                        <button type="button" class="link-action-btn delete-btn" data-id="${escapeAttr(link.shortId)}" style="color:var(--accent-red, #E13B3B);border-color:var(--accent-red, #E13B3B);">Delete</button>
                    </div>
                </div>
                <div class="link-clicks">
                    <strong>${escapeHtml(link.clicksLabel)}</strong>
                    <span>Clicks</span>
                </div>
            `;
      feedEl.appendChild(card);
    });

    feedEl.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        copyText(btn.dataset.url, "Link copied!"),
      );
    });

    feedEl.querySelectorAll(".open-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const currentLinks = useStore.getState().allLinks;
        const nextLinks = currentLinks.map((l) => {
          if (l.shortId === id || l._id === id) {
            const newClicks = (l.totalClicks || 0) + 1;
            return {
              ...l,
              totalClicks: newClicks,
              clicksLabel: newClicks.toString(),
            };
          }
          return l;
        });
        useStore.setState({ allLinks: nextLinks });
        setTimeout(async () => {
          try {
            const res = await apiRequest("/api/urls?limit=100");
            if (res && res.stats) updateStats(res.stats);
          } catch (e) {}
        }, 1000);
      });
    });

    feedEl.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete this shortlink?")) return;
        try {
          await apiRequest(`/api/urls/${btn.dataset.id}`, { method: "DELETE" });
          showToast("Link deleted successfully!");
          const currentLinks = useStore.getState().allLinks;
          const nextLinks = currentLinks.filter(
            (l) => l.shortId !== btn.dataset.id && l._id !== btn.dataset.id,
          );
          useStore.setState({ allLinks: nextLinks });
          const res = await apiRequest("/api/urls?limit=100");
          if (res && res.stats) updateStats(res.stats);
        } catch (err) {
          showToast(err.message || "Failed to delete link", true);
        }
      });
    });

    feedEl.querySelectorAll(".analytics-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.location.href = `/services/analytics-dashboard?link=${btn.dataset.id}`;
      });
    });

    feedEl.querySelectorAll(".fav-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        try {
          const res = await apiRequest(`/api/urls/${id}/favorite`, {
            method: "PATCH",
          });
          const currentLinks = useStore.getState().allLinks;
          useStore.setState({
            allLinks: currentLinks.map((l) =>
              l.shortId === id ? { ...l, favorite: res.favorite } : l,
            ),
          });
        } catch (err) {
          showToast(err.message || "Failed to update favorite", true);
        }
      });
    });

    feedEl.querySelectorAll(".archive-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        try {
          const res = await apiRequest(`/api/urls/${id}/archive`, {
            method: "PATCH",
          });
          showToast(res.archived ? "Link archived" : "Link restored");
          const mode = useStore.getState().viewMode;
          // A toggle in the "active" or "archived" tab means the link
          // no longer belongs in the currently visible list — drop it
          // rather than just flipping the flag in place.
          if (mode === "active" || mode === "archived") {
            const currentLinks = useStore.getState().allLinks;
            useStore.setState({
              allLinks: currentLinks.filter((l) => l.shortId !== id),
            });
          } else {
            const currentLinks = useStore.getState().allLinks;
            useStore.setState({
              allLinks: currentLinks.map((l) =>
                l.shortId === id ? { ...l, archived: res.archived } : l,
              ),
            });
          }
        } catch (err) {
          showToast(err.message || "Failed to update archive state", true);
        }
      });
    });

    feedEl.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const link = useStore.getState().allLinks.find((l) => l.shortId === id);
        if (link) openEditModal(link);
      });
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  function truncateUrl(url, max = 48) {
    if (url.length <= max) return url;
    return url.slice(0, max) + "…";
  }

  async function copyText(text, msg) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(msg || "Copied!");
    } catch (_) {
      showToast("Could not copy", true);
    }
  }

  function updateStats(stats) {
    document.getElementById("stat-total-links").textContent = stats.totalLinks;
    document.getElementById("stat-total-clicks").textContent =
      stats.totalClicksLabel;
    document.getElementById("stat-top-link").textContent =
      stats.topLinkTitle !== "—"
        ? `${stats.topLinkTitle} (${stats.topLinkClicks} clicks)`
        : "—";
  }

  function queryForViewMode(mode) {
    if (mode === "archived") return "/api/urls?archived=only&limit=100";
    if (mode === "favorites") return "/api/urls?favorite=true&limit=100";
    return "/api/urls";
  }

  async function loadLinks() {
    const mode = useStore.getState().viewMode;
    try {
      const data = await apiRequest(queryForViewMode(mode));
      useStore.setState({ allLinks: data.links || [] });
      updateStats(
        data.stats || {
          totalLinks: 0,
          totalClicksLabel: "0",
          topLinkTitle: "—",
        },
      );
      if (data.domain) {
        document.getElementById("domain-label").textContent = data.domain + "/";
      }
    } catch (err) {
      showToast(err.message, true);
    }
  }

  function setViewMode(mode) {
    useStore.setState({ viewMode: mode });
    ["active", "favorites", "archived"].forEach((m) => {
      const tabBtn = document.getElementById(`tab-${m}`);
      if (!tabBtn) return;
      tabBtn.classList.toggle("active", m === mode);
      tabBtn.style.background = m === mode ? "" : "var(--bg-secondary)";
    });
    loadLinks();
  }

  // ── Edit Modal ──────────────────────────────────────────────────────────
  const editModalOverlay = document.getElementById("edit-modal-overlay");
  const editForm = document.getElementById("edit-form");

  function toDatetimeLocalValue(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openEditModal(link) {
    document.getElementById("edit-shortId").value = link.shortId;
    document.getElementById("edit-redirect-url").value = link.redirectUrl;
    document.getElementById("edit-title").value = link.title || "";
    document.getElementById("edit-tag").value = link.tag || "active";
    document.getElementById("edit-tags").value = (link.tags || []).join(", ");
    document.getElementById("edit-expiry").value = toDatetimeLocalValue(
      link.expiresAt,
    );
    document.getElementById("edit-password").value = "";
    document.getElementById("edit-remove-password").checked = false;
    editModalOverlay.style.display = "flex";
  }

  function closeEditModal() {
    editModalOverlay.style.display = "none";
  }

  document
    .getElementById("edit-modal-close")
    ?.addEventListener("click", closeEditModal);
  editModalOverlay?.addEventListener("click", (e) => {
    if (e.target === editModalOverlay) closeEditModal();
  });

  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const shortId = document.getElementById("edit-shortId").value;
    const expiryVal = document.getElementById("edit-expiry").value;
    const passwordVal = document.getElementById("edit-password").value;
    const removePassword = document.getElementById(
      "edit-remove-password",
    ).checked;

    const body = {
      redirectUrl: document.getElementById("edit-redirect-url").value.trim(),
      title: document.getElementById("edit-title").value.trim(),
      tag: document.getElementById("edit-tag").value,
      tags: parseTagsInput(document.getElementById("edit-tags").value),
      expiresAt: expiryVal ? new Date(expiryVal).toISOString() : null,
    };
    if (removePassword) {
      body.removePassword = true;
    } else if (passwordVal) {
      body.password = passwordVal;
    }

    try {
      const res = await apiRequest(`/api/urls/${shortId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const currentLinks = useStore.getState().allLinks;
      useStore.setState({
        allLinks: currentLinks.map((l) =>
          l.shortId === shortId ? res.link : l,
        ),
      });
      showToast("Link updated!");
      closeEditModal();
    } catch (err) {
      showToast(err.message || "Failed to update link", true);
    }
  });

  emptyEl.style.display = "none";
  loadLinks();

  // ── Create Form ─────────────────────────────────────────────────────────
  function resetDuplicateBanner() {
    pendingDuplicateLink = null;
    duplicateBanner.style.display = "none";
  }

  async function submitShortenForm(force) {
    const redirectUrl = document.getElementById("redirect-url").value.trim();
    const customSlug = document.getElementById("custom-slug").value.trim();
    const linkTitle = document.getElementById("link-title").value.trim();
    const linkTag = document.getElementById("link-tag").value;
    const tags = parseTagsInput(document.getElementById("link-tags").value);
    const expiryVal = document.getElementById("link-expiry").value;
    const passwordVal = document.getElementById("link-password").value;

    const data = await apiRequest("/api/urls", {
      method: "POST",
      body: JSON.stringify({
        redirectUrl,
        customSlug: customSlug || undefined,
        title: linkTitle || undefined,
        tag: linkTag,
        tags,
        expiresAt: expiryVal ? new Date(expiryVal).toISOString() : undefined,
        password: passwordVal || undefined,
        force: !!force,
      }),
    });

    if (data.duplicate) {
      pendingDuplicateLink = data.link;
      duplicateText.textContent = `You already have "${data.link.title}" pointing to this URL.`;
      duplicateBanner.style.display = "flex";
      return;
    }

    resetDuplicateBanner();

    const { allLinks, viewMode } = useStore.getState();
    if (viewMode === "active") {
      useStore.setState({
        allLinks: [data.link, ...allLinks],
        lastCreatedUrl: data.link.shortUrl,
      });
    } else {
      useStore.setState({ lastCreatedUrl: data.link.shortUrl });
    }

    const totalLinksEl = document.getElementById("stat-total-links");
    if (totalLinksEl) {
      const currentTotal = parseInt(totalLinksEl.textContent || "0", 10);
      totalLinksEl.textContent = isNaN(currentTotal)
        ? "1"
        : String(currentTotal + 1);
    }

    document.getElementById("redirect-url").value = "";
    document.getElementById("custom-slug").value = "";
    document.getElementById("link-title").value = "";
    document.getElementById("link-tag").value = "active";
    document.getElementById("link-tags").value = "";
    document.getElementById("link-expiry").value = "";
    document.getElementById("link-password").value = "";

    showToast("Short link created successfully!");
  }

  if (shortenForm) {
    shortenForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      resetDuplicateBanner();
      try {
        await submitShortenForm(false);
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  document
    .getElementById("duplicate-use-btn")
    ?.addEventListener("click", () => {
      if (!pendingDuplicateLink) return;
      resultText.textContent = pendingDuplicateLink.shortUrl;
      resultBanner.style.display = "flex";
      useStore.setState({ lastCreatedUrl: pendingDuplicateLink.shortUrl });
      resetDuplicateBanner();
    });

  document
    .getElementById("duplicate-force-btn")
    ?.addEventListener("click", async () => {
      try {
        await submitShortenForm(true);
      } catch (err) {
        showToast(err.message, true);
      }
    });

  document.getElementById("copy-result-btn")?.addEventListener("click", () => {
    const { lastCreatedUrl } = useStore.getState();
    if (lastCreatedUrl) copyText(lastCreatedUrl, "Short link copied!");
  });

  document.getElementById("slug-toggle")?.addEventListener("click", () => {
    document.getElementById("slug-panel")?.classList.toggle("open");
  });

  if (searchInput) searchInput.addEventListener("input", renderLinks);

  document.getElementById("sort-date")?.addEventListener("click", () => {
    useStore.setState({ sortMode: "date" });
    document.getElementById("sort-date")?.classList.add("active");
    document.getElementById("sort-clicks")?.classList.remove("active");
  });

  document.getElementById("sort-clicks")?.addEventListener("click", () => {
    useStore.setState({ sortMode: "clicks" });
    document.getElementById("sort-clicks")?.classList.add("active");
    document.getElementById("sort-date")?.classList.remove("active");
  });

  document
    .getElementById("tab-active")
    ?.addEventListener("click", () => setViewMode("active"));
  document
    .getElementById("tab-favorites")
    ?.addEventListener("click", () => setViewMode("favorites"));
  document
    .getElementById("tab-archived")
    ?.addEventListener("click", () => setViewMode("archived"));

  document
    .getElementById("scroll-shorten-btn")
    ?.addEventListener("click", () => {
      document
        .getElementById("shorten-section")
        ?.scrollIntoView({ behavior: "smooth" });
      document.getElementById("redirect-url")?.focus();
    });

  document.getElementById("widget-new-btn")?.addEventListener("click", () => {
    document.getElementById("scroll-shorten-btn")?.click();
  });

  // ── Bulk Import ─────────────────────────────────────────────────────────
  document
    .getElementById("bulk-import-toggle")
    ?.addEventListener("click", (e) => {
      const panel = document.getElementById("bulk-import-panel");
      const isOpen = panel.style.display === "flex";
      panel.style.display = isOpen ? "none" : "flex";
      e.target.textContent = isOpen ? "Show" : "Hide";
    });

  document
    .getElementById("bulk-import-submit")
    ?.addEventListener("click", async (btn) => {
      const resultEl = document.getElementById("bulk-import-result");
      const urlsText = document.getElementById("bulk-urls").value;
      const fileInput = document.getElementById("bulk-file");
      const file = fileInput.files && fileInput.files[0];

      if (!urlsText.trim() && !file) {
        showToast("Paste URLs or choose a .csv file first", true);
        return;
      }

      const formData = new FormData();
      if (urlsText.trim()) formData.append("urls", urlsText);
      if (file) formData.append("file", file);

      try {
        const data = await apiRequestForm("/api/urls/bulk", formData);
        resultEl.style.display = "block";
        resultEl.innerHTML =
          `<strong>${data.createdCount} imported</strong>${data.skippedCount ? `, ${data.skippedCount} skipped` : ""}.` +
          (data.skipped && data.skipped.length
            ? '<ul style="margin:0.5rem 0 0 1.1rem;">' +
              data.skipped
                .map(
                  (s) =>
                    `<li>${escapeHtml(s.input)} — ${escapeHtml(s.reason)}</li>`,
                )
                .join("") +
              "</ul>"
            : "");

        if (data.createdCount > 0) {
          document.getElementById("bulk-urls").value = "";
          fileInput.value = "";
          if (useStore.getState().viewMode === "active") {
            await loadLinks();
          } else {
            const res = await apiRequest("/api/urls?limit=100");
            if (res && res.stats) updateStats(res.stats);
          }
          showToast(
            `Imported ${data.createdCount} link${data.createdCount === 1 ? "" : "s"}!`,
          );
        }
      } catch (err) {
        showToast(err.message || "Bulk import failed", true);
      }
    });

  const emptyCTA = document.getElementById("empty-state-cta");

  if (emptyCTA) {
    emptyCTA.addEventListener("click", () => {
      document
        .getElementById("shorten-section")
        ?.scrollIntoView({ behavior: "smooth" });

      document.getElementById("redirect-url")?.focus();
    });
  }
})();
