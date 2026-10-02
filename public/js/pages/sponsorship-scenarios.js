(() => {
  const root = document.getElementById("sponsorship-scenario-app");
  if (!root) return;

  const form = document.getElementById("scenario-form");
  const scenarioList = document.getElementById("scenario-list");
  const comparison = document.getElementById("scenario-comparison");
  const rateCardSelect = document.getElementById("scenario-rate-card");
  const platformSelect = form.elements.platform;
  const manualList = document.querySelector(".manual-deliverable-list");
  const cardDeliverables = document.querySelector("#rate-card-deliverables .scenario-choice-list");
  const cardDeliverableField = document.getElementById("rate-card-deliverables");
  const manualField = document.getElementById("manual-deliverables");
  const proposalForm = document.getElementById("proposal-form");
  const proposalSelect = document.getElementById("proposal-scenario");
  const status = document.getElementById("scenario-status");
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
  const state = { cards: [], scenarios: [], editingId: null };
  const deliverableTypes = [
    ["dedicated_video", "Dedicated video"], ["integrated_segment", "Integrated segment"],
    ["reel_or_short", "Reel or short"], ["story_sequence", "Story sequence"],
    ["feed_post", "Feed post"], ["thread", "Thread"],
    ["newsletter_sponsorship", "Newsletter sponsorship"],
  ];

  async function request(url, options = {}) {
    const headers = { Accept: "application/json", ...options.headers };
    if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    if (csrfToken && options.method && options.method !== "GET") headers["X-CSRF-Token"] = csrfToken;
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || "Request failed");
    }
    return response;
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.dataset.error = isError ? "true" : "false";
  }

  function selectedCard() {
    return state.cards.find((card) => String(card._id) === rateCardSelect.value) || null;
  }

  function renderRateCards() {
    const currentValue = rateCardSelect.value;
    rateCardSelect.replaceChildren(new Option("Manual deliverables", ""));
    state.cards.forEach((card) => rateCardSelect.add(new Option(card.title, card._id)));
    rateCardSelect.value = currentValue;
    renderCardDeliverables();
  }

  function renderCardDeliverables(selectedIds = []) {
    const card = selectedCard();
    const useCard = Boolean(card);
    cardDeliverableField.hidden = !useCard;
    manualField.hidden = useCard;
    cardDeliverables.replaceChildren();
    if (!card) return;

    const availablePlatforms = [...new Set((card.deliverables || []).map((item) => item.platform))];
    if (!availablePlatforms.includes(platformSelect.value) && availablePlatforms.length) {
      platformSelect.value = availablePlatforms[0];
    }
    (card.deliverables || []).filter((item) => item.platform === platformSelect.value).forEach((item) => {
      const label = document.createElement("label");
      label.className = "scenario-choice";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "deliverableIds";
      checkbox.value = item._id;
      checkbox.checked = selectedIds.includes(String(item._id));
      const text = document.createElement("span");
      text.textContent = item.description || item.deliverableType.replace(/_/g, " ");
      const price = document.createElement("small");
      price.textContent = `${card.currency || "USD"} ${item.basePrice}`;
      label.append(checkbox, text, price);
      cardDeliverables.append(label);
    });
    if (!cardDeliverables.childElementCount) {
      const empty = document.createElement("p");
      empty.textContent = "No deliverables match this platform on the selected card.";
      cardDeliverables.append(empty);
    }
  }

  function addManualDeliverable(data = {}) {
    const row = document.createElement("div");
    row.className = "manual-deliverable";
    const type = document.createElement("select");
    type.name = "deliverableType";
    type.setAttribute("aria-label", "Deliverable type");
    deliverableTypes.forEach(([value, label]) => type.add(new Option(label, value)));
    type.value = data.deliverableType || deliverableTypes[0][0];
    const price = document.createElement("input");
    price.name = "basePrice";
    price.type = "number";
    price.min = "0";
    price.step = "0.01";
    price.required = true;
    price.placeholder = "Base price";
    price.setAttribute("aria-label", "Deliverable base price");
    price.value = data.basePrice ?? "";
    const description = document.createElement("input");
    description.name = "description";
    description.maxLength = 240;
    description.placeholder = "Description";
    description.setAttribute("aria-label", "Deliverable description");
    description.value = data.description || "";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Remove deliverable";
    remove.setAttribute("aria-label", "Remove deliverable");
    remove.addEventListener("click", () => {
      if (manualList.childElementCount > 1) row.remove();
      else setStatus("A scenario needs at least one deliverable.", true);
    });
    row.append(type, price, description, remove);
    manualList.append(row);
  }

  function scenarioPayload() {
    const data = new FormData(form);
    const payload = {
      name: data.get("name").trim(),
      platform: data.get("platform"),
      campaignDurationDays: Number(data.get("campaignDurationDays")),
      usageRightsOption: data.get("usageRightsOption"),
      exclusivityOption: data.get("exclusivityOption"),
      whitelistingAllowed: data.get("whitelistingAllowed") === "on",
      rateCardId: data.get("rateCardId") || null,
    };
    if (payload.rateCardId) {
      payload.deliverableIds = [...cardDeliverables.querySelectorAll('input[name="deliverableIds"]:checked')].map((input) => input.value);
    } else {
      payload.deliverables = [...manualList.querySelectorAll(".manual-deliverable")].map((row) => ({
        deliverableType: row.querySelector('[name="deliverableType"]').value,
        basePrice: Number(row.querySelector('[name="basePrice"]').value),
        description: row.querySelector('[name="description"]').value.trim(),
      }));
    }
    return payload;
  }

  function addButton(label, action, id) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.id = id;
    return button;
  }

  function renderScenarios() {
    scenarioList.replaceChildren();
    proposalSelect.replaceChildren(new Option("Select a saved scenario", ""));
    document.getElementById("scenario-count").textContent = String(state.scenarios.length);
    state.scenarios.forEach((scenario) => {
      const row = document.createElement("div");
      row.className = "scenario-row";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "compareScenario";
      checkbox.value = scenario._id;
      checkbox.setAttribute("aria-label", `Select ${scenario.name} for comparison`);
      const name = document.createElement("span");
      name.className = "scenario-row-name";
      name.textContent = scenario.name;
      const price = document.createElement("span");
      price.className = "scenario-row-price";
      price.textContent = `${scenario.assumptions.currency} ${scenario.quote.finalTotal}`;
      row.append(checkbox, name, price, addButton("Edit", "edit", scenario._id), addButton("Delete", "delete", scenario._id));
      scenarioList.append(row);
      proposalSelect.add(new Option(scenario.name, scenario._id));
    });
    if (!state.scenarios.length) {
      const empty = document.createElement("p");
      empty.textContent = "No saved scenarios yet.";
      scenarioList.append(empty);
    }
  }

  async function loadData() {
    const [cardsResponse, scenariosResponse] = await Promise.all([
      request("/api/rate-cards"),
      request("/api/sponsorship-scenarios"),
    ]);
    state.cards = (await cardsResponse.json()).cards || [];
    state.scenarios = (await scenariosResponse.json()).scenarios || [];
    renderRateCards();
    renderScenarios();
  }

  function renderComparison() {
    const chosen = [...scenarioList.querySelectorAll('input[name="compareScenario"]:checked')]
      .map((input) => state.scenarios.find((scenario) => String(scenario._id) === input.value))
      .filter(Boolean);
    comparison.replaceChildren();
    if (chosen.length < 2) {
      setStatus("Select at least two scenarios to compare.", true);
      return;
    }

    const rows = [
      ["Platform", (item) => item.inputs.platform],
      ["Deliverables", (item) => item.deliverables.map((d) => d.description || d.deliverableType.replace(/_/g, " ")).join(", ")],
      ["Calculated price", (item) => `${item.assumptions.currency} ${item.quote.finalTotal}`],
      ["Usage rights", (item) => item.inputs.usageRightsOption.replace(/_/g, " ")],
      ["Exclusivity", (item) => item.inputs.exclusivityOption.replace(/_/g, " ")],
      ["Campaign duration", (item) => `${item.inputs.campaignDurationDays} days`],
      ["Assumptions", (item) => `Usage +${Math.round(item.assumptions.usageRightsMultiplier * 100)}%; exclusivity +${Math.round(item.assumptions.exclusivityMultiplier * 100)}%; bundle discount ${item.quote.discountPercent || 0}%; whitelisting ${item.inputs.whitelistingAllowed ? "included" : "not included"}; rules ${item.pricingRuleVersion}`],
    ];
    const table = document.createElement("table");
    const head = table.createTHead().insertRow();
    const corner = document.createElement("th");
    corner.scope = "col";
    head.append(corner);
    chosen.forEach((scenario) => {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = scenario.name;
      head.append(cell);
    });
    const body = table.createTBody();
    rows.forEach(([label, getValue]) => {
      const row = body.insertRow();
      const header = document.createElement("th");
      header.scope = "row";
      header.textContent = label;
      row.append(header);
      chosen.forEach((scenario) => {
        const cell = row.insertCell();
        cell.textContent = getValue(scenario);
      });
    });
    comparison.append(table);
    setStatus("Scenario comparison updated.");
  }

  function editScenario(id) {
    const scenario = state.scenarios.find((item) => String(item._id) === id);
    if (!scenario) return;
    state.editingId = id;
    form.elements.name.value = scenario.name;
    form.elements.platform.value = scenario.inputs.platform;
    form.elements.campaignDurationDays.value = scenario.inputs.campaignDurationDays;
    form.elements.usageRightsOption.value = scenario.inputs.usageRightsOption;
    form.elements.exclusivityOption.value = scenario.inputs.exclusivityOption;
    form.elements.whitelistingAllowed.checked = scenario.inputs.whitelistingAllowed;
    rateCardSelect.value = scenario.inputs.rateCardId || "";
    renderCardDeliverables(scenario.inputs.deliverableIds.map(String));
    manualList.replaceChildren();
    if (!scenario.inputs.rateCardId) scenario.deliverables.forEach(addManualDeliverable);
    if (!scenario.inputs.rateCardId && !scenario.deliverables.length) addManualDeliverable();
    document.getElementById("scenario-form-title").textContent = "Edit scenario";
    document.getElementById("save-scenario").textContent = "Recalculate and save";
    document.getElementById("cancel-scenario-edit").hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetScenarioForm() {
    state.editingId = null;
    form.reset();
    form.elements.campaignDurationDays.value = "30";
    manualList.replaceChildren();
    addManualDeliverable();
    renderCardDeliverables();
    document.getElementById("scenario-form-title").textContent = "Create a scenario";
    document.getElementById("save-scenario").textContent = "Calculate and save";
    document.getElementById("cancel-scenario-edit").hidden = true;
  }

  function applyProposal(proposal) {
    proposalForm.elements.title.value = proposal.title || "";
    proposalForm.elements.creatorName.value = proposal.creatorName || root.dataset.creatorName || "";
    proposalForm.elements.creatorEmail.value = proposal.creatorEmail || root.dataset.creatorEmail || "";
    proposalForm.elements.brandName.value = proposal.brandName || "";
    proposalForm.elements.campaignName.value = proposal.campaignName || "";
    proposalForm.elements.price.value = proposal.price ?? "";
    proposalForm.elements.currency.value = proposal.currency || "USD";
    proposalForm.elements.usageRights.value = proposal.usageRights || "";
    proposalForm.elements.exclusivity.value = proposal.exclusivity || "";
    proposalForm.elements.campaignDurationDays.value = proposal.campaignDurationDays ?? "";
    proposalForm.elements.deliverables.value = (proposal.deliverables || []).map((item) => `${item.name} | ${item.basePrice}`).join("\n");
    proposalForm.elements.assumptions.value = (proposal.assumptions || []).join("\n");
    proposalForm.elements.disclaimer.value = proposal.disclaimer || "";
  }

  function proposalPayload() {
    const data = new FormData(proposalForm);
    const deliverables = String(data.get("deliverables") || "").split(/\r?\n/).filter(Boolean).map((line) => {
      const separator = line.lastIndexOf("|");
      return separator < 0
        ? { name: line.trim(), basePrice: "" }
        : { name: line.slice(0, separator).trim(), basePrice: line.slice(separator + 1).trim() };
    });
    return {
      title: data.get("title"), creatorName: data.get("creatorName"), creatorEmail: data.get("creatorEmail"),
      brandName: data.get("brandName"), campaignName: data.get("campaignName"), deliverables,
      price: data.get("price"), currency: data.get("currency"), usageRights: data.get("usageRights"),
      exclusivity: data.get("exclusivity"), campaignDurationDays: data.get("campaignDurationDays"),
      assumptions: String(data.get("assumptions") || "").split(/\r?\n/).filter(Boolean),
      disclaimer: data.get("disclaimer"),
    };
  }

  rateCardSelect.addEventListener("change", () => renderCardDeliverables());
  platformSelect.addEventListener("change", () => renderCardDeliverables());
  document.getElementById("add-deliverable").addEventListener("click", () => addManualDeliverable());
  document.getElementById("cancel-scenario-edit").addEventListener("click", resetScenarioForm);
  document.getElementById("compare-scenarios").addEventListener("click", renderComparison);
  scenarioList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit") return editScenario(button.dataset.id);
    if (button.dataset.action === "delete" && window.confirm("Delete this scenario?")) {
      try {
        await request(`/api/sponsorship-scenarios/${encodeURIComponent(button.dataset.id)}`, { method: "DELETE" });
        state.scenarios = state.scenarios.filter((item) => String(item._id) !== button.dataset.id);
        renderScenarios();
        comparison.replaceChildren();
        setStatus("Scenario deleted.");
      } catch (error) {
        setStatus(error.message, true);
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const id = state.editingId;
      const response = await request(id ? `/api/sponsorship-scenarios/${encodeURIComponent(id)}` : "/api/sponsorship-scenarios", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(scenarioPayload()),
      });
      const result = await response.json();
      if (id) state.scenarios = state.scenarios.map((item) => String(item._id) === id ? result.scenario : item);
      else state.scenarios.unshift(result.scenario);
      renderScenarios();
      resetScenarioForm();
      setStatus(`Scenario saved. Calculated total: ${result.scenario.assumptions.currency} ${result.scenario.quote.finalTotal}.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  proposalSelect.addEventListener("change", async () => {
    if (!proposalSelect.value) return;
    try {
      const response = await request(`/api/sponsorship-scenarios/${encodeURIComponent(proposalSelect.value)}/proposal`);
      applyProposal((await response.json()).proposal);
      setStatus("Proposal summary loaded. Edit any field before export.");
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  document.getElementById("export-proposal").addEventListener("click", async () => {
    try {
      const response = await request("/api/sponsorship-scenarios/export-html", {
        method: "POST",
        body: JSON.stringify({ proposal: proposalPayload() }),
      });
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "sponsorship-proposal.html";
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      setStatus("Proposal HTML exported.");
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  addManualDeliverable();
  loadData().catch((error) => setStatus(error.message, true));
})();