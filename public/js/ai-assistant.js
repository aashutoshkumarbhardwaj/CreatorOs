document.addEventListener("DOMContentLoaded", () => {
    const chatThread = document.getElementById("messages-thread");
    const chatInput = document.getElementById("chat-input");
    const btnSend = document.getElementById("btn-send-chat");
    const platformSelect = document.getElementById("select-platform");
    const toneSelect = document.getElementById("select-tone");
    const historyList = document.getElementById("history-list");
    const btnNewChat = document.getElementById("btn-new-chat");
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

    let currentChatId = null;

    // --- Tab Switching ---
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tabTarget = btn.getAttribute("data-tab");
            tabBtns.forEach((b) => b.classList.remove("active"));
            tabContents.forEach((c) => (c.style.display = "none"));

            btn.classList.add("active");
            const targetEl = document.getElementById(`tab-${tabTarget}`);
            if (targetEl) targetEl.style.display = "block";
        });
    });

    // --- Prompt Chips ---
    const chipBtns = document.querySelectorAll(".chip-btn");
    chipBtns.forEach((chip) => {
        chip.addEventListener("click", () => {
            if (chatInput) {
                chatInput.value = chip.getAttribute("data-prompt") || chip.textContent;
                chatInput.focus();
            }
        });
    });

    // --- Helper: Scroll Chat to Bottom ---
    function scrollToBottom() {
        if (chatThread) {
            chatThread.scrollTop = chatThread.scrollHeight;
        }
    }

    // --- Helper: Escape HTML ---
    function escapeHtml(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // --- Helper: Append Message Bubble ---
    function appendMessage({ role, content, structuredData }) {
        if (!chatThread) return;

        const bubble = document.createElement("div");
        bubble.className = `chat-bubble ${role}`;

        const avatar = document.createElement("div");
        avatar.className = "avatar-badge";
        avatar.textContent = role === "user" ? "YOU" : "AI";

        const bubbleContent = document.createElement("div");
        bubbleContent.className = "bubble-content";
        bubbleContent.innerHTML = escapeHtml(content).replace(/\n/g, "<br>");

        if (role === "assistant" && structuredData) {
            const widget = document.createElement("div");
            widget.className = "structured-widget";

            let metricsHtml = `<div class="widget-metrics-row">`;
            if (structuredData.seoScore !== undefined) {
                metricsHtml += `<span class="metric-pill">🔍 SEO: <strong>${structuredData.seoScore}/100</strong></span>`;
            }
            if (structuredData.viralityScore !== undefined) {
                metricsHtml += `<span class="metric-pill">🚀 Virality: <strong>${structuredData.viralityScore}%</strong></span>`;
            }
            metricsHtml += `</div>`;

            if (structuredData.hashtags && structuredData.hashtags.length > 0) {
                metricsHtml += `<div style="font-size:0.8rem; color:#475569;"><strong>Hashtags:</strong> ${structuredData.hashtags.map(h => `<span style="background:#e0e7ff; color:#3730a3; padding:0.15rem 0.4rem; border-radius:0.25rem; margin-right:0.25rem;">${escapeHtml(h)}</span>`).join(" ")}</div>`;
            }

            metricsHtml += `
                <div class="action-buttons-group">
                    <button type="button" class="btn-action-sm btn-copy-content">📋 Copy Text</button>
                    <button type="button" class="btn-action-sm primary btn-save-content-os">🧠 Save to Content OS</button>
                </div>
            `;

            widget.innerHTML = metricsHtml;

            // Copy handler
            widget.querySelector(".btn-copy-content")?.addEventListener("click", () => {
                navigator.clipboard.writeText(content);
                alert("Text copied to clipboard!");
            });

            // Save to Content OS handler
            widget.querySelector(".btn-save-content-os")?.addEventListener("click", async () => {
                try {
                    const res = await fetch("/services/ai-assistant/api/export-content-os", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-CSRF-Token": csrfToken,
                        },
                        body: JSON.stringify({
                            title: content.slice(0, 50),
                            description: content,
                            platform: platformSelect?.value || "general",
                            type: "idea",
                        }),
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert("Successfully exported item to Content OS! 🧠");
                    } else {
                        alert(data.message || "Export failed.");
                    }
                } catch (err) {
                    alert("Failed to export to Content OS.");
                }
            });

            bubbleContent.appendChild(widget);
        }

        bubble.appendChild(avatar);
        bubble.appendChild(bubbleContent);
        chatThread.appendChild(bubble);
        scrollToBottom();
    }

    // --- Send Message Handler ---
    async function handleSendMessage() {
        const prompt = chatInput.value.trim();
        if (!prompt) return;

        chatInput.value = "";
        appendMessage({ role: "user", content: prompt });

        // Show typing indicator
        const typingIndicator = document.createElement("div");
        typingIndicator.className = "chat-bubble assistant typing-indicator";
        typingIndicator.innerHTML = `
            <div class="avatar-badge">AI</div>
            <div class="bubble-content" style="color: #64748b; font-style: italic;">AI Assistant is thinking... ✨</div>
        `;
        chatThread.appendChild(typingIndicator);
        scrollToBottom();

        try {
            const response = await fetch("/services/ai-assistant/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken,
                },
                body: JSON.stringify({
                    prompt,
                    platform: platformSelect?.value || "general",
                    tone: toneSelect?.value || "energetic",
                    chatId: currentChatId,
                }),
            });

            chatThread.removeChild(typingIndicator);

            const result = await response.json();
            if (result.success && result.data) {
                currentChatId = result.data.chatId;
                const msg = result.data.message;
                appendMessage({
                    role: "assistant",
                    content: msg.content,
                    structuredData: msg.structuredData,
                });
                refreshHistoryList();
            } else {
                appendMessage({
                    role: "assistant",
                    content: `⚠️ Error: ${result.message || "Failed to generate AI response."}`,
                });
            }
        } catch (err) {
            if (typingIndicator.parentNode) chatThread.removeChild(typingIndicator);
            appendMessage({
                role: "assistant",
                content: "⚠️ Network connection error. Please try again.",
            });
        }
    }

    if (btnSend) btnSend.addEventListener("click", handleSendMessage);
    if (chatInput) {
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }

    // --- New Chat Button ---
    if (btnNewChat) {
        btnNewChat.addEventListener("click", () => {
            currentChatId = null;
            if (chatThread) chatThread.innerHTML = "";
            appendMessage({
                role: "assistant",
                content: "Hello! I am your AI Creator Assistant. How can I help you elevate your content strategy today?",
            });
        });
    }

    // --- Refresh History List ---
    async function refreshHistoryList() {
        if (!historyList) return;
        try {
            const res = await fetch("/services/ai-assistant/api/chats");
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                historyList.innerHTML = "";
                data.data.forEach((chat) => {
                    const item = document.createElement("div");
                    item.className = `history-item ${chat._id === currentChatId ? "active" : ""}`;
                    item.innerHTML = `
                        <span class="history-item-title">${escapeHtml(chat.title)}</span>
                        <button type="button" class="btn-delete-chat" data-id="${chat._id}">🗑️</button>
                    `;

                    item.addEventListener("click", (e) => {
                        if (e.target.classList.contains("btn-delete-chat")) return;
                        loadChatThread(chat._id);
                    });

                    item.querySelector(".btn-delete-chat")?.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        if (confirm("Delete this conversation?")) {
                            await fetch(`/services/ai-assistant/api/chats/${chat._id}`, {
                                method: "DELETE",
                                headers: { "X-CSRF-Token": csrfToken },
                            });
                            if (currentChatId === chat._id) {
                                currentChatId = null;
                                if (chatThread) chatThread.innerHTML = "";
                            }
                            refreshHistoryList();
                        }
                    });

                    historyList.appendChild(item);
                });
            }
        } catch (e) {
            console.error("Failed to load history list:", e);
        }
    }

    // --- Load Specific Chat Thread ---
    async function loadChatThread(chatId) {
        try {
            const res = await fetch(`/services/ai-assistant/api/chats/${chatId}`);
            const data = await res.json();
            if (data.success && data.data) {
                currentChatId = chatId;
                if (chatThread) chatThread.innerHTML = "";
                data.data.messages.forEach((msg) => {
                    appendMessage({
                        role: msg.role,
                        content: msg.content,
                        structuredData: msg.structuredData,
                    });
                });
                refreshHistoryList();
            }
        } catch (err) {
            console.error("Failed to load chat thread:", err);
        }
    }

    // --- Power Tools Execution Handlers ---
    const btnRunSeo = document.getElementById("btn-run-seo");
    if (btnRunSeo) {
        btnRunSeo.addEventListener("click", async () => {
            const text = document.getElementById("seo-input-text")?.value;
            const output = document.getElementById("seo-output");
            if (!text || !output) return;

            output.innerHTML = "Analyzing SEO alignment...";
            try {
                const res = await fetch("/services/ai-assistant/api/tools/seo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
                    body: JSON.stringify({ text, platform: platformSelect?.value || "general" }),
                });
                const data = await res.json();
                if (data.success && data.data) {
                    const r = data.data;
                    output.innerHTML = `
                        <strong>SEO Discoverability Score:</strong> ${r.seoScore}/100<br>
                        <strong>Keywords:</strong> ${r.keywords.join(", ")}<br>
                        <strong>Suggested Title:</strong> "${r.titleSuggestions[0]}"<br>
                        <strong>Tips:</strong> ${r.optimizationTips.join(" ")}
                    `;
                }
            } catch (err) {
                output.innerHTML = "Failed to run SEO analysis.";
            }
        });
    }

    const btnRunPredictor = document.getElementById("btn-run-predictor");
    if (btnRunPredictor) {
        btnRunPredictor.addEventListener("click", async () => {
            const text = document.getElementById("predictor-input-text")?.value;
            const output = document.getElementById("predictor-output");
            if (!text || !output) return;

            output.innerHTML = "Calculating virality heuristics...";
            try {
                const res = await fetch("/services/ai-assistant/api/tools/predict", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
                    body: JSON.stringify({ text, platform: platformSelect?.value || "general" }),
                });
                const data = await res.json();
                if (data.success && data.data) {
                    const r = data.data;
                    output.innerHTML = `
                        <strong>Virality Potential:</strong> ${r.viralityScore}% (${r.engagementLevel})<br>
                        <strong>Readability Grade:</strong> ${r.readabilityGrade}<br>
                        <strong>Estimated Reach:</strong> ${r.estimatedReachBand}<br>
                        <strong>Peak Posting Window:</strong> ${r.recommendedPostingTime}
                    `;
                }
            } catch (err) {
                output.innerHTML = "Failed to run performance prediction.";
            }
        });
    }
});
