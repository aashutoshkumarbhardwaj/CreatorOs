document.addEventListener("DOMContentLoaded", () => {

    const searchInput = document.getElementById("messageSearch");
    const cards = document.querySelectorAll(".message-card");
    const filterButtons = document.querySelectorAll(".filter-btn");

    const title = document.getElementById("conversationTitle");
    const sender = document.getElementById("conversationSender");
    const time = document.getElementById("conversationTime");
    const body = document.getElementById("conversationBody");

    const replyBtn = document.getElementById("replyBtn");
    const archiveBtn = document.getElementById("archiveBtn");
    const importantBtn = document.getElementById("importantBtn");
    const readBtn = document.getElementById("readBtn");
    const replyBox = document.getElementById("replyBox");

    let selectedCard = null;

    // ===========================
    // SEARCH
    // ===========================

    if (searchInput) {
        searchInput.addEventListener("input", function () {

            const value = this.value.toLowerCase();

            cards.forEach(card => {

                const senderText = (card.dataset.sender || "").toLowerCase();
                const titleText = (card.dataset.title || "").toLowerCase();
                const channel = (card.dataset.channel || "").toLowerCase();

                const visible =
                    senderText.includes(value) ||
                    titleText.includes(value) ||
                    channel.includes(value);

                card.style.display = visible ? "block" : "none";

            });

        });
    }

    // ===========================
    // FILTERS
    // ===========================

    filterButtons.forEach(button => {

        button.addEventListener("click", () => {

            filterButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");

            const filter = button.dataset.filter;

            cards.forEach(card => {

                let show = false;

                switch (filter) {

                    case "all":
                        show = true;
                        break;

                    case "email":
                    case "instagram":
                    case "sms":
                    case "x":
                        show = (card.dataset.channel || "").toLowerCase() === filter;
                        break;

                    case "unread":
                        show = card.dataset.read === "false";
                        break;

                    case "important":
                        show = card.dataset.important === "true";
                        break;

                    case "archived":
                        show = card.dataset.archived === "true";
                        break;
                }

                card.style.display = show ? "block" : "none";

            });

        });

    });

    // ===========================
    // OPEN MESSAGE
    // ===========================

    function openMessage(card) {

        selectedCard = card;

        cards.forEach(c => c.classList.remove("active"));
        card.classList.add("active");

        if (title) title.textContent = card.dataset.title || "";
        if (sender) sender.textContent = card.dataset.sender || "";
        if (time) time.textContent = card.dataset.time || "";
        if (body) body.textContent = card.dataset.body || "";

        if (replyBox) replyBox.value = "";

        if (readBtn) {
            readBtn.textContent =
                card.dataset.read === "true"
                    ? "Mark Unread"
                    : "Mark Read";
        }

    }

    cards.forEach(card => {
        card.addEventListener("click", () => openMessage(card));
    });

    // Automatically select first message
    if (cards.length > 0) {
        openMessage(cards[0]);
    }

    // ===========================
    // REPLY
    // ===========================

    if (replyBtn) {

        replyBtn.addEventListener("click", () => {

            if (!selectedCard) {
                alert("Select a message first.");
                return;
            }

            const reply = replyBox.value.trim();

            if (reply === "") {
                alert("Please write a reply.");
                return;
            }

            alert("Reply sent successfully! (Mock)");

            replyBox.value = "";

        });

    }

    // ===========================
    // MARK READ / UNREAD
    // ===========================

    if (readBtn) {

        readBtn.addEventListener("click", () => {

            if (!selectedCard) return;

            const current = selectedCard.dataset.read === "true";

            selectedCard.dataset.read = (!current).toString();

            readBtn.textContent =
                current
                    ? "Mark Read"
                    : "Mark Unread";

        });

    }

    // ===========================
    // IMPORTANT
    // ===========================

    if (importantBtn) {

        importantBtn.addEventListener("click", () => {

            if (!selectedCard) return;

            const current = selectedCard.dataset.important === "true";

            selectedCard.dataset.important = (!current).toString();

            alert(
                current
                    ? "Removed from Important"
                    : "Marked as Important"
            );

        });

    }

    // ===========================
    // ARCHIVE
    // ===========================

    if (archiveBtn) {

        archiveBtn.addEventListener("click", () => {

            if (!selectedCard) return;

            selectedCard.dataset.archived = "true";
            selectedCard.style.display = "none";

            alert("Message archived.");

        });

    }

});