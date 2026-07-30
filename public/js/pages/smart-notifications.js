document.addEventListener("DOMContentLoaded", () => {
    // ── Tab Management ──
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            tabBtns.forEach((b) => b.classList.remove("active"));
            tabContents.forEach((c) => c.classList.remove("active"));

            btn.classList.add("active");
            const target = btn.getAttribute("data-tab");
            document.getElementById(`${target}-tab`)?.classList.add("active");

            if (target === "analytics") {
                loadAnalytics();
            }
        });
    });

    // ── Toast Notification Helper ──
    function showToast(message, type = "success") {
        let toast = document.getElementById("smart-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "smart-toast";
            toast.style.position = "fixed";
            toast.style.bottom = "24px";
            toast.style.right = "24px";
            toast.style.zIndex = "9999";
            toast.style.padding = "12px 20px";
            toast.style.borderRadius = "8px";
            toast.style.fontWeight = "600";
            toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
            toast.style.transition = "all 0.3s ease";
            document.body.appendChild(toast);
        }
        toast.style.background = type === "error" ? "#ef4444" : "#10b981";
        toast.style.color = "#ffffff";
        toast.textContent = message;
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";
        }, 3000);
    }

    // ── Update Topbar Unread Badge ──
    function updateTopbarBadge(count) {
        const badge = document.getElementById("topbar-unread-badge");
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = "inline-block";
            } else {
                badge.textContent = "0";
                badge.style.display = "none";
            }
        }
    }

    // ── Filters & Search ──
    let activeFilterStatus = "all";
    let activeFilterCategory = "all";
    let searchQuery = "";

    const statusFilterChips = document.querySelectorAll(".filter-chip[data-status]");
    const categoryFilterChips = document.querySelectorAll(".filter-chip[data-category]");
    const searchInput = document.getElementById("notification-search");

    statusFilterChips.forEach((chip) => {
        chip.addEventListener("click", () => {
            statusFilterChips.forEach((c) => c.classList.remove("active"));
            chip.classList.add("active");
            activeFilterStatus = chip.getAttribute("data-status");
            fetchAndRenderNotifications();
        });
    });

    categoryFilterChips.forEach((chip) => {
        chip.addEventListener("click", () => {
            categoryFilterChips.forEach((c) => c.classList.remove("active"));
            chip.classList.add("active");
            activeFilterCategory = chip.getAttribute("data-category");
            fetchAndRenderNotifications();
        });
    });

    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener("input", (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                searchQuery = e.target.value.trim();
                fetchAndRenderNotifications();
            }, 300);
        });
    }

    // ── Fetch & Render Notification History ──
    async function fetchAndRenderNotifications() {
        const listContainer = document.getElementById("notifications-list-container");
        if (!listContainer) return;

        try {
            const params = new URLSearchParams({
                status: activeFilterStatus,
                category: activeFilterCategory,
                search: searchQuery,
            });

            const res = await fetch(`/api/notifications?${params.toString()}`);
            const data = await res.json();

            if (!data.success) {
                showToast("Failed to load notifications", "error");
                return;
            }

            updateTopbarBadge(data.unreadCount);

            if (data.notifications.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                        <h3>No Notifications Found</h3>
                        <p style="color: #64748b; font-size: 0.9rem;">No notifications match your current filters.</p>
                    </div>
                `;
                return;
            }

            listContainer.innerHTML = data.notifications
                .map((item) => renderNotificationCard(item))
                .join("");

            attachCardEventListeners();
        } catch (err) {
            console.error(err);
            showToast("Network error fetching notifications", "error");
        }
    }

    function renderNotificationCard(item) {
        const isUnread = !item.readAt && item.status !== "archived";
        const catClass = `cat-${item.category || "system"}`;

        const categoryIcons = {
            system: "⚙️",
            engagement: "💬",
            content: "📝",
            analytics: "📊",
            marketing: "📣",
        };

        const channelLabels = (item.channels || ["in_app"])
            .map((ch) => `<span class="channel-pill">${ch.toUpperCase()}</span>`)
            .join(" ");

        const dateFormatted = new Date(item.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        return `
            <div class="notification-card ${isUnread ? "unread" : ""} ${item.status}" data-id="${item._id}">
                <div class="category-icon-wrapper ${catClass}">
                    ${categoryIcons[item.category] || "🔔"}
                </div>
                <div class="notification-main">
                    <div class="notification-top-row">
                        <span class="notification-title-text">${escapeHtml(item.title)}</span>
                        <div class="notification-meta">
                            <span class="badge-tag priority-${item.priority || "normal"}">${item.priority}</span>
                            <span>${dateFormatted}</span>
                        </div>
                    </div>
                    <div class="notification-body">
                        ${escapeHtml(item.message)}
                    </div>
                    <div class="notification-channels-row">
                        <span>Channels:</span> ${channelLabels}
                        ${item.status === "scheduled" ? `<span style="color: #d97706; font-weight:600; margin-left: 8px;">⏰ Scheduled for ${new Date(item.scheduledFor).toLocaleTimeString()}</span>` : ""}
                        ${item.status === "suppressed" ? `<span style="color: #64748b; margin-left: 8px;">🚫 Suppressed (${item.metadata?.suppressionReason || "Preference"})</span>` : ""}
                    </div>
                </div>
                <div class="notification-actions">
                    ${isUnread ? `<button class="btn-icon-action btn-mark-read" data-id="${item._id}" title="Mark as Read">✓</button>` : ""}
                    ${item.status !== "archived" ? `<button class="btn-icon-action btn-archive" data-id="${item._id}" title="Archive">📥</button>` : ""}
                    <button class="btn-icon-action btn-delete" data-id="${item._id}" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    }

    function escapeHtml(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function attachCardEventListeners() {
        document.querySelectorAll(".btn-mark-read").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
                showToast("Marked as read");
                fetchAndRenderNotifications();
            });
        });

        document.querySelectorAll(".btn-archive").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                await fetch(`/api/notifications/${id}/archive`, { method: "PATCH" });
                showToast("Notification archived");
                fetchAndRenderNotifications();
            });
        });

        document.querySelectorAll(".btn-delete").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                if (confirm("Delete this notification?")) {
                    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
                    showToast("Notification deleted");
                    fetchAndRenderNotifications();
                }
            });
        });
    }

    // ── Global Actions ──
    const markAllReadBtn = document.getElementById("mark-all-read-btn");
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener("click", async () => {
            const res = await fetch("/api/notifications/read-all", { method: "PATCH" });
            const data = await res.json();
            if (data.success) {
                showToast("All notifications marked as read");
                fetchAndRenderNotifications();
            }
        });
    }

    const sendTestNotificationBtn = document.getElementById("send-test-notification-btn");
    if (sendTestNotificationBtn) {
        sendTestNotificationBtn.addEventListener("click", async () => {
            const res = await fetch("/api/notifications/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channel: "all", category: "system" }),
            });
            const data = await res.json();
            if (data.success) {
                showToast("Test notification sent!");
                fetchAndRenderNotifications();
            } else {
                showToast(data.message || "Failed to send test notification", "error");
            }
        });
    }

    // ── Preferences Form Handler ──
    const prefsForm = document.getElementById("prefs-form");
    if (prefsForm) {
        prefsForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const payload = {
                channels: {
                    inApp: document.getElementById("chk-inapp")?.checked ?? true,
                    email: document.getElementById("chk-email")?.checked ?? true,
                    push: document.getElementById("chk-push")?.checked ?? false,
                    sms: document.getElementById("chk-sms")?.checked ?? false,
                },
                categories: {
                    system: document.getElementById("chk-cat-system")?.checked ?? true,
                    engagement: document.getElementById("chk-cat-engagement")?.checked ?? true,
                    content: document.getElementById("chk-cat-content")?.checked ?? true,
                    analytics: document.getElementById("chk-cat-analytics")?.checked ?? true,
                    marketing: document.getElementById("chk-cat-marketing")?.checked ?? false,
                },
                quietHours: {
                    enabled: document.getElementById("chk-qh-enabled")?.checked ?? false,
                    startTime: document.getElementById("qh-start-time")?.value || "22:00",
                    endTime: document.getElementById("qh-end-time")?.value || "08:00",
                    timezone: document.getElementById("qh-timezone")?.value || "UTC",
                },
                intelligentScheduling: {
                    enabled: document.getElementById("chk-intel-enabled")?.checked ?? true,
                    preferredWindow: document.getElementById("intel-window")?.value || "optimal",
                },
                deduplication: {
                    enabled: document.getElementById("chk-dedup-enabled")?.checked ?? true,
                    windowMinutes: parseInt(document.getElementById("dedup-window")?.value || "15"),
                },
            };

            try {
                const res = await fetch("/api/notifications/preferences", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (data.success) {
                    showToast("Notification preferences saved successfully!");
                } else {
                    showToast(data.message || "Failed to save preferences", "error");
                }
            } catch (err) {
                showToast("Network error saving preferences", "error");
            }
        });
    }

    // ── Load Analytics ──
    async function loadAnalytics() {
        try {
            const res = await fetch("/api/notifications/analytics");
            const data = await res.json();
            if (data.success) {
                const stats = data.data;
                document.getElementById("stat-total-sent").textContent = stats.totalNotifications;
                document.getElementById("stat-delivery-rate").textContent = `${stats.deliveryRate}%`;
                document.getElementById("stat-open-rate").textContent = `${stats.openRate}%`;
                document.getElementById("stat-click-rate").textContent = `${stats.clickRate}%`;

                // Render category breakdown
                const catTrack = document.getElementById("cat-breakdown-bars");
                if (catTrack) {
                    const totalCat = Object.values(stats.categoryStats).reduce((a, b) => a + b, 0) || 1;
                    catTrack.innerHTML = Object.entries(stats.categoryStats)
                        .map(([cat, count]) => {
                            const pct = Math.round((count / totalCat) * 100);
                            return `
                                <div class="bar-row">
                                    <div class="bar-label">
                                        <span style="text-transform: capitalize;">${cat}</span>
                                        <span>${count} (${pct}%)</span>
                                    </div>
                                    <div class="bar-track">
                                        <div class="bar-fill" style="width: ${pct}%;"></div>
                                    </div>
                                </div>
                            `;
                        })
                        .join("");
                }
            }
        } catch (err) {
            console.error("Error loading analytics:", err);
        }
    }

    // Attach initial event handlers for pre-rendered elements
    attachCardEventListeners();
});
