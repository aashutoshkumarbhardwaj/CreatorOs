document.addEventListener("DOMContentLoaded", () => {
  initCrmTabs();
  initCrmSearchAndFilter();
  initCrmModals();
  initCrmForms();
});

function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute("content") : "";
}

function getHeaders() {
  const headers = { "Content-Type": "application/json" };
  const csrf = getCsrfToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  return headers;
}

// ── TABS SWITCHER ──
function initCrmTabs() {
  const tabBtns = document.querySelectorAll(".crm-tab-btn");
  const tabPanes = document.querySelectorAll(".crm-tab-pane");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const activePane = document.getElementById(`tab-${target}`);
      if (activePane) activePane.classList.add("active");
    });
  });
}

// ── LIVE SEARCH & FILTER ──
function initCrmSearchAndFilter() {
  const searchInput = document.getElementById("crm-search-input");
  const categoryFilter = document.getElementById("crm-category-filter");

  if (searchInput) {
    searchInput.addEventListener("input", filterCrmContent);
  }
  if (categoryFilter) {
    categoryFilter.addEventListener("change", filterCrmContent);
  }
}

function filterCrmContent() {
  const query = (document.getElementById("crm-search-input")?.value || "").toLowerCase();
  const category = (document.getElementById("crm-category-filter")?.value || "all").toLowerCase();

  // Filter Deal Cards
  const dealCards = document.querySelectorAll(".deal-card");
  dealCards.forEach((card) => {
    const text = card.textContent.toLowerCase();
    const cardCategory = (card.dataset.category || "").toLowerCase();

    const matchesQuery = !query || text.includes(query);
    const matchesCategory = category === "all" || cardCategory === category;

    if (matchesQuery && matchesCategory) {
      card.style.display = "";
    } else {
      card.style.display = "none";
    }
  });

  // Filter Brand Rows
  const brandRows = document.querySelectorAll(".brand-row");
  brandRows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    const rowCategory = (row.dataset.category || "").toLowerCase();

    const matchesQuery = !query || text.includes(query);
    const matchesCategory = category === "all" || rowCategory === category;

    if (matchesQuery && matchesCategory) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });

  // Filter Invoice Items
  const invoiceItems = document.querySelectorAll(".invoice-item");
  invoiceItems.forEach((item) => {
    const text = item.textContent.toLowerCase();
    if (!query || text.includes(query)) {
      item.style.display = "";
    } else {
      item.style.display = "none";
    }
  });
}

// ── MODALS ──
function initCrmModals() {
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".crm-modal-overlay");
      if (modal) modal.classList.remove("active");
    });
  });

  document.querySelectorAll(".crm-modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("active");
    });
  });
}

window.openCrmModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("active");
};

window.closeCrmModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("active");
};

// ── FORMS & AJAX ──
function initCrmForms() {
  // Add Deal Form
  const addDealForm = document.getElementById("form-add-deal");
  if (addDealForm) {
    addDealForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(addDealForm);
      const data = Object.fromEntries(formData.entries());

      try {
        const res = await fetch("/api/crm/deals", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (result.success) {
          window.location.reload();
        } else {
          alert(result.message || "Failed to create deal");
        }
      } catch (err) {
        console.error(err);
        alert("Error creating deal");
      }
    });
  }

  // Add Brand Form
  const addBrandForm = document.getElementById("form-add-brand");
  if (addBrandForm) {
    addBrandForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(addBrandForm);
      const data = Object.fromEntries(formData.entries());
      data.socialLinks = {
        linkedin: data.linkedin || "",
        instagram: data.instagram || "",
        twitter: data.twitter || "",
      };

      try {
        const res = await fetch("/api/crm/brands", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (result.success) {
          window.location.reload();
        } else {
          alert(result.message || "Failed to create brand");
        }
      } catch (err) {
        console.error(err);
        alert("Error creating brand contact");
      }
    });
  }

  // Add Invoice Form
  const addInvoiceForm = document.getElementById("form-add-invoice");
  if (addInvoiceForm) {
    addInvoiceForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(addInvoiceForm);
      const data = Object.fromEntries(formData.entries());

      try {
        const res = await fetch("/api/crm/invoices", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (result.success) {
          window.location.reload();
        } else {
          alert(result.message || "Failed to create invoice");
        }
      } catch (err) {
        console.error(err);
        alert("Error creating invoice");
      }
    });
  }

  // Contact History Form
  const historyForm = document.getElementById("form-add-history");
  if (historyForm) {
    historyForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const brandId = historyForm.dataset.brandId;
      const formData = new FormData(historyForm);
      const data = Object.fromEntries(formData.entries());

      try {
        const res = await fetch(`/api/crm/brands/${brandId}/contact-history`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (result.success) {
          window.location.reload();
        } else {
          alert(result.message || "Failed to add contact note");
        }
      } catch (err) {
        console.error(err);
        alert("Error adding contact note");
      }
    });
  }
}

// ── ACTION HELPERS ──
window.moveDealStage = async function (dealId, currentStage) {
  const stages = ["lead", "outreach", "negotiation", "contract", "closed_won"];
  const currentIndex = stages.indexOf(currentStage);
  const nextStage = stages[(currentIndex + 1) % stages.length];

  try {
    const res = await fetch(`/api/crm/deals/${dealId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ stage: nextStage }),
    });
    const result = await res.json();
    if (result.success) {
      window.location.reload();
    }
  } catch (err) {
    console.error(err);
  }
};

window.markInvoicePaid = async function (invoiceId) {
  try {
    const res = await fetch(`/api/crm/invoices/${invoiceId}/paid`, {
      method: "PATCH",
      headers: getHeaders(),
    });
    const result = await res.json();
    if (result.success) {
      window.location.reload();
    } else {
      alert(result.message || "Failed to mark invoice as paid");
    }
  } catch (err) {
    console.error(err);
    alert("Error marking invoice paid");
  }
};

window.deleteCrmItem = async function (type, id) {
  if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

  try {
    const res = await fetch(`/api/crm/${type}s/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    const result = await res.json();
    if (result.success) {
      window.location.reload();
    } else {
      alert(result.message || "Failed to delete item");
    }
  } catch (err) {
    console.error(err);
  }
};

window.openContactHistoryModal = function (brandId, companyName, historyJson) {
  const modal = document.getElementById("contact-history-modal");
  const title = document.getElementById("history-modal-title");
  const list = document.getElementById("history-modal-list");
  const form = document.getElementById("form-add-history");

  if (!modal) return;
  title.textContent = `Contact History: ${companyName}`;
  form.dataset.brandId = brandId;

  let history = [];
  try {
    history = typeof historyJson === "string" ? JSON.parse(historyJson) : historyJson || [];
  } catch (e) {
    history = [];
  }

  if (history.length === 0) {
    list.innerHTML = `<div class="empty-state">No contact history recorded yet for ${companyName}.</div>`;
  } else {
    list.innerHTML = history
      .map(
        (h) => `
      <div class="history-item">
        <div class="history-head">
          <span class="history-type type-${h.type}">${(h.type || "note").toUpperCase()}</span>
          <span class="history-date">${new Date(h.date).toLocaleDateString()}</span>
        </div>
        <div class="history-body">${h.note}</div>
      </div>
    `
      )
      .join("");
  }

  modal.classList.add("active");
};

window.triggerIntegrationOutreach = function (platform, email, companyName) {
  const pitch = encodeURIComponent(
    `Hi ${companyName || "Team"},\n\nI'd love to explore a sponsorship collaboration between your brand and my audience. Check out my media kit and let's connect!\n\nBest,\nCreator`
  );

  if (platform === "email") {
    window.location.href = `mailto:${email || ""}?subject=CreatorOS Partnership Inquiry - ${companyName}&body=${pitch}`;
  } else if (platform === "linkedin") {
    window.open(`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(companyName)}`, "_blank");
  } else if (platform === "instagram") {
    window.open(`https://instagram.com`, "_blank");
  } else if (platform === "twitter") {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Hey @${companyName}, sent you a partnership proposal!`)}`, "_blank");
  }
};
