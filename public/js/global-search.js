
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("search-links-input");
  const resultsContainer = document.getElementById("global-search-results");

  if (!searchInput || !resultsContainer) return;

  const CONFIG = {
    endpoint: "/api/urls?limit=100",
    maxResults: 8,
    debounceDelay: 250,
    requestTimeout: 10000,
  };

  let links = [];
  let debounceTimer = null;
  let activeIndex = -1;
  let isLoading = false;
  let loadError = false;

  // Accessibility setup
  searchInput.setAttribute("role", "combobox");
  searchInput.setAttribute("aria-autocomplete", "list");
  searchInput.setAttribute("aria-controls", "global-search-results");
  searchInput.setAttribute("aria-expanded", "false");

  resultsContainer.setAttribute("role", "listbox");
  resultsContainer.hidden = true;

  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)_csrf=([^;]*)/);

    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return "";
      }
    }

    return (
      document.body.getAttribute("data-csrf") ||
      document.querySelector('meta[name="csrf-token"]')?.content ||
      ""
    );
  }

  // Safely validate URLs before using them as link destinations.
  function validateUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    try {
      const url = new URL(value.trim(), window.location.origin);

      if (!["http:", "https:"].includes(url.protocol)) {
        return null;
      }

      return url.href;
    } catch {
      return null;
    }
  }

  function createMessage(message, className) {
    const element = document.createElement("div");

    element.className = className;
    element.textContent = message;

    resultsContainer.replaceChildren(element);
    resultsContainer.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  async function loadLinks() {
    if (isLoading) return;

    isLoading = true;
    loadError = false;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      CONFIG.requestTimeout
    );

    try {
      const csrfToken = getCsrfToken();

      const response = await fetch(CONFIG.endpoint, {
        method: "GET",
        credentials: "same-origin",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = await response.json();

      links = Array.isArray(data.links) ? data.links : [];
    } catch (error) {
      console.error("Global link search failed:", error);

      links = [];
      loadError = true;
    } finally {
      clearTimeout(timeout);
      isLoading = false;

      if (searchInput.value.trim()) {
        renderResults(searchInput.value.trim());
      }
    }
  }

  function getSearchableText(link) {
    return [
      link.title,
      link.shortUrl,
      link.redirectUrl,
    ]
      .filter((value) => typeof value === "string")
      .join(" ")
      .toLowerCase();
  }

  function renderResults(query) {
    resultsContainer.replaceChildren();
    activeIndex = -1;

    if (!query) {
      closeResults();
      return;
    }

    if (isLoading) {
      createMessage("Loading links...", "global-search-loading");
      return;
    }

    if (loadError) {
      createMessage(
        "Unable to load links. Please refresh and try again.",
        "global-search-error"
      );
      return;
    }

    const normalizedQuery = query.toLowerCase();

    const matches = links
      .filter((link) => getSearchableText(link).includes(normalizedQuery))
      .slice(0, CONFIG.maxResults);

    if (!matches.length) {
      createMessage(
        "No shortened links found.",
        "global-search-empty"
      );
      return;
    }

    matches.forEach((link, index) => {
      const destination = validateUrl(link.shortUrl);

      // Do not render links with unsafe or invalid destinations.
      if (!destination) return;

      const result = document.createElement("a");

      result.id = `global-search-option-${index}`;
      result.className = "global-search-result";
      result.href = destination;
      result.setAttribute("role", "option");
      result.setAttribute("aria-selected", "false");
      result.dataset.index = String(index);

      const title = document.createElement("strong");
      title.textContent = link.title || "Untitled Link";

      const shortUrl = document.createElement("span");
      shortUrl.textContent = link.shortUrl;

      const redirectUrl = document.createElement("small");
      redirectUrl.textContent = link.redirectUrl || "No destination available";

      result.append(title, shortUrl, redirectUrl);
      resultsContainer.appendChild(result);
    });

    if (!resultsContainer.children.length) {
      createMessage(
        "No valid shortened links found.",
        "global-search-empty"
      );
      return;
    }

    resultsContainer.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  function closeResults() {
    resultsContainer.hidden = true;
    resultsContainer.replaceChildren();
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  }

  function updateActiveResult(index) {
    const results = resultsContainer.querySelectorAll(
      ".global-search-result"
    );

    if (!results.length) return;

    results.forEach((result) => {
      result.classList.remove("active");
      result.setAttribute("aria-selected", "false");
    });

    activeIndex = Math.max(0, Math.min(index, results.length - 1));

    const activeResult = results[activeIndex];

    activeResult.classList.add("active");
    activeResult.setAttribute("aria-selected", "true");

    searchInput.setAttribute(
      "aria-activedescendant",
      activeResult.id
    );

    activeResult.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }

  // Debounced search
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);

    const query = searchInput.value.trim();

    if (!query) {
      closeResults();
      return;
    }

    debounceTimer = setTimeout(() => {
      renderResults(query);
    }, CONFIG.debounceDelay);
  });

  // Reopen results when the input receives focus.
  searchInput.addEventListener("focus", () => {
    const query = searchInput.value.trim();

    if (query) {
      renderResults(query);
    }
  });

  // Keyboard navigation
  searchInput.addEventListener("keydown", (event) => {
    const results = resultsContainer.querySelectorAll(
      ".global-search-result"
    );

    if (event.key === "ArrowDown") {
      if (!results.length) return;

      event.preventDefault();

      updateActiveResult(
        activeIndex < results.length - 1 ? activeIndex + 1 : 0
      );
    }

    if (event.key === "ArrowUp") {
      if (!results.length) return;

      event.preventDefault();

      updateActiveResult(
        activeIndex > 0 ? activeIndex - 1 : results.length - 1
      );
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      results[activeIndex]?.click();
    }

    if (event.key === "Escape") {
      clearTimeout(debounceTimer);
      searchInput.value = "";
      closeResults();
      searchInput.blur();
    }
  });

  // Close results when clicking outside the search area.
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-container")) {
      closeResults();
    }
  });

  // Highlight results when the pointer moves over them.
  resultsContainer.addEventListener("mouseover", (event) => {
    const result = event.target.closest(".global-search-result");

    if (result) {
      updateActiveResult(Number(result.dataset.index));
    }
  });

  // Load links once when the page is ready.
  loadLinks();
});
