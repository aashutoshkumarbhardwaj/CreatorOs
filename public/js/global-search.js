document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("search-links-input");
  const resultsContainer = document.getElementById("global-search-results");

  if (!searchInput || !resultsContainer) return;

  let links = [];

  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)_csrf=([^;]*)/);

    return match
      ? decodeURIComponent(match[1])
      : document.body.getAttribute("data-csrf") ||
          document.querySelector('meta[name="csrf-token"]')?.content ||
          "";
  }

  async function loadLinks() {
    try {
      const csrfToken = getCsrfToken();

      const response = await fetch("/api/urls?limit=100", {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Search request failed: ${response.status}`);
      }

      const data = await response.json();
      links = Array.isArray(data.links) ? data.links : [];
    } catch (error) {
      console.error("Global search failed:", error);
      links = [];
    }
  }

  function renderResults(query) {
    resultsContainer.innerHTML = "";

    if (!query) {
      resultsContainer.hidden = true;
      return;
    }

    const normalizedQuery = query.toLowerCase();

   const matches = links
  .filter((link) =>
    link.title?.toLowerCase().includes(normalizedQuery),
  )
  .slice(0, 8);

    if (!matches.length) {
      resultsContainer.innerHTML =
        '<div class="global-search-empty">No shortened links found.</div>';
      resultsContainer.hidden = false;
      return;
    }

    matches.forEach((link) => {
      const result = document.createElement("a");

      result.className = "global-search-result";
      result.href = link.shortUrl;
      result.setAttribute("role", "option");

      result.innerHTML = `
        <strong>${escapeHtml(link.title || "Untitled Link")}</strong>
        <span>${escapeHtml(link.shortUrl)}</span>
        <small>${escapeHtml(link.redirectUrl)}</small>
      `;

      resultsContainer.appendChild(result);
    });

    resultsContainer.hidden = false;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  searchInput.addEventListener("input", () => {
    renderResults(searchInput.value.trim());
  });

  searchInput.addEventListener("focus", () => {
    const query = searchInput.value.trim();

    if (query) {
      renderResults(query);
    }
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchInput.value = "";
      resultsContainer.innerHTML = "";
      resultsContainer.hidden = true;
      searchInput.blur();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-container")) {
      resultsContainer.hidden = true;
    }
  });

  loadLinks();
});