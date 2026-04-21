const FIELD_LABELS = {
  noPorsi: "No. Porsi",
  nama: "Nama",
  embarkasi: "Embarkasi",
  kloter: "Kloter",
  rombongan: "Rombongan",
  reguKloter: "Regu Kloter",
  umur: "Umur",
  noPaspor: "No. Paspor",
  noVisa: "No. Visa",
  statusJemaah: "Status Jemaah",
  kabKota: "Kab/Kota",
  jenisKelamin: "Jenis Kelamin",
  ket: "Keterangan",
  kloterPra: "Kloter Pra",
  syarikah: "Syarikah",
};

const state = {
  site: null,
  people: [],
  filtered: [],
  selectedId: null,
  filters: {
    query: "",
    kloter: "all",
    rombongan: "all",
    regu: "all",
    status: "all",
    kabKota: "all",
  },
};

const elements = {
  heroStats: document.getElementById("hero-stats"),
  toolbarSection: document.getElementById("toolbar-section"),
  loadingPanel: document.getElementById("loading-panel"),
  contentGrid: document.getElementById("content-grid"),
  searchInput: document.getElementById("search-input"),
  quickSearch: document.getElementById("quick-search"),
  quickSearchCount: document.getElementById("quick-search-count"),
  quickSearchList: document.getElementById("quick-search-list"),
  filterKloter: document.getElementById("filter-kloter"),
  filterRombongan: document.getElementById("filter-rombongan"),
  filterRegu: document.getElementById("filter-regu"),
  filterStatus: document.getElementById("filter-status"),
  filterKabKota: document.getElementById("filter-kabkota"),
  resetButton: document.getElementById("reset-filters"),
  resultCount: document.getElementById("result-count"),
  personList: document.getElementById("person-list"),
  listEmpty: document.getElementById("list-empty"),
  detailModal: document.getElementById("detail-modal"),
  modalBackdrop: document.getElementById("modal-backdrop"),
  modalClose: document.getElementById("modal-close"),
  detailContent: document.getElementById("detail-content"),
  detailKloter: document.getElementById("detail-kloter"),
  detailName: document.getElementById("detail-name"),
  detailChips: document.getElementById("detail-chips"),
  detailAssets: document.getElementById("detail-assets"),
  detailPhoto: document.getElementById("detail-photo"),
  profileHighlights: document.getElementById("profile-highlights"),
  fieldGrid: document.getElementById("field-grid"),
};

const filterControls = [
  elements.searchInput,
  elements.filterKloter,
  elements.filterRombongan,
  elements.filterRegu,
  elements.filterStatus,
  elements.filterKabKota,
  elements.resetButton,
];

function setControlsDisabled(disabled) {
  filterControls.forEach((control) => {
    control.disabled = disabled;
  });
}

function renderLoadingStats() {
  elements.heroStats.innerHTML = `
    <div class="stats-loading" aria-live="polite">
      <p class="stats-loading__title">Menyusun ringkasan kloter dan jumlah jemaah...</p>
      <div class="stats-loading__grid">
        <div class="stats-loading__card"></div>
        <div class="stats-loading__card"></div>
        <div class="stats-loading__card"></div>
        <div class="stats-loading__card"></div>
      </div>
    </div>
  `;
}

function setLoading(isLoading) {
  setControlsDisabled(isLoading);
  elements.loadingPanel.classList.toggle("hidden", !isLoading);
  elements.toolbarSection.classList.toggle("hidden", isLoading);
  elements.contentGrid.classList.toggle("hidden", isLoading);
  if (isLoading) {
    elements.resultCount.textContent = "…";
    renderLoadingStats();
  }
}

function makeOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function renderSelect(select, values, current, allLabel) {
  select.innerHTML = "";
  select.appendChild(makeOption("all", allLabel));
  values.forEach((value) => {
    select.appendChild(makeOption(value, value));
  });
  select.value = current;
}

function normalize(text) {
  return String(text || "").toLowerCase();
}

function matchesQuery(person, query) {
  if (!query) return true;
  const haystack = [
    person.nama,
    person.noPorsi,
    person.noPaspor,
    person.noVisa,
    person.kabKota,
    person.statusJemaah,
    person.rombongan,
    person.reguKloter,
    person.kloterLabel,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function rankQuickResult(person, query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;

  const noPorsi = normalize(person.noPorsi);
  const nama = normalize(person.nama);
  const noPaspor = normalize(person.noPaspor);
  const noVisa = normalize(person.noVisa);
  const kabKota = normalize(person.kabKota);
  const statusJemaah = normalize(person.statusJemaah);

  let score = 0;

  if (noPorsi === normalizedQuery) score += 150;
  else if (noPorsi.startsWith(normalizedQuery)) score += 110;
  else if (noPorsi.includes(normalizedQuery)) score += 70;

  if (nama === normalizedQuery) score += 130;
  else if (nama.startsWith(normalizedQuery)) score += 100;
  else if (nama.includes(normalizedQuery)) score += 64;

  if (noPaspor === normalizedQuery) score += 90;
  else if (noPaspor.startsWith(normalizedQuery)) score += 66;
  else if (noPaspor.includes(normalizedQuery)) score += 42;

  if (noVisa === normalizedQuery) score += 90;
  else if (noVisa.startsWith(normalizedQuery)) score += 66;
  else if (noVisa.includes(normalizedQuery)) score += 42;

  if (kabKota.startsWith(normalizedQuery)) score += 36;
  else if (kabKota.includes(normalizedQuery)) score += 20;

  if (statusJemaah.startsWith(normalizedQuery)) score += 26;
  else if (statusJemaah.includes(normalizedQuery)) score += 12;

  return score;
}

function getQuickResults() {
  const query = state.filters.query.trim();
  if (!query) return [];

  return [...state.filtered]
    .map((person, index) => ({
      person,
      score: rankQuickResult(person, query),
      index,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 5)
    .map((item) => item.person);
}

function applyFilters() {
  const query = normalize(state.filters.query);
  state.filtered = state.people.filter((person) => {
    if (state.filters.kloter !== "all" && person.kloterCode !== state.filters.kloter) return false;
    if (state.filters.rombongan !== "all" && person.rombongan !== state.filters.rombongan) return false;
    if (state.filters.regu !== "all" && person.reguKloter !== state.filters.regu) return false;
    if (state.filters.status !== "all" && person.statusJemaah !== state.filters.status) return false;
    if (state.filters.kabKota !== "all" && person.kabKota !== state.filters.kabKota) return false;
    return matchesQuery(person, query);
  });

  if (!state.filtered.some((person) => person.id === state.selectedId)) {
    state.selectedId = state.filtered[0]?.id || null;
  }
}

function buildFilterValues(source) {
  const sortNumeric = (a, b) => Number(a) - Number(b);
  const kloters = [...new Set(source.map((person) => person.kloterCode))].sort(sortNumeric);
  const rombongan = [...new Set(source.map((person) => person.rombongan).filter(Boolean))].sort(sortNumeric);
  const regu = [...new Set(source.map((person) => person.reguKloter).filter(Boolean))].sort(sortNumeric);
  const status = [...new Set(source.map((person) => person.statusJemaah).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const kabKota = [...new Set(source.map((person) => person.kabKota).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return { kloters, rombongan, regu, status, kabKota };
}

function renderHeroStats() {
  const cards = [
    { value: state.site.totalPeople, label: "Total jemaah siap tampil" },
    { value: state.site.kloters.length, label: "Kloter terhubung" },
    ...state.site.kloters.map((kloter) => ({
      value: kloter.count,
      label: `${kloter.label}`,
    })),
  ];

  const grid = document.createElement("div");
  grid.className = "stats-grid";
  cards.forEach((card) => {
    const node = document.createElement("article");
    node.className = "stat-card";
    node.innerHTML = `<strong>${card.value}</strong><span>${card.label}</span>`;
    grid.appendChild(node);
  });

  elements.heroStats.innerHTML = "";
  elements.heroStats.appendChild(grid);
}

function renderFilters() {
  const values = buildFilterValues(state.people);
  renderSelect(elements.filterKloter, values.kloters, state.filters.kloter, "Semua Kloter");
  renderSelect(elements.filterRombongan, values.rombongan, state.filters.rombongan, "Semua Rombongan");
  renderSelect(elements.filterRegu, values.regu, state.filters.regu, "Semua Regu");
  renderSelect(elements.filterStatus, values.status, state.filters.status, "Semua Status");
  renderSelect(elements.filterKabKota, values.kabKota, state.filters.kabKota, "Semua Kabupaten/Kota");
}

function renderQuickSearch() {
  const quickResults = getQuickResults();
  const shouldShow = Boolean(state.filters.query.trim()) && quickResults.length > 0;

  elements.quickSearch.classList.toggle("hidden", !shouldShow);
  elements.quickSearchList.innerHTML = "";

  if (!shouldShow) return;

  elements.quickSearchCount.textContent = `${quickResults.length} teratas`;

  quickResults.forEach((person) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-search__item";
    button.innerHTML = `
      <div class="quick-search__item-top">
        <div>
          <h4 class="quick-search__name">${person.nama}</h4>
          <div class="quick-search__porsi">No. Porsi ${person.noPorsi}</div>
        </div>
        <span class="chip">${person.kloterLabel}</span>
      </div>
      <div class="quick-search__meta">
        <span class="chip">Rombongan ${person.rombongan}</span>
        <span class="chip">Regu ${person.reguKloter}</span>
        <span class="chip">${person.statusJemaah || "Status belum ada"}</span>
        <span class="chip">${person.kabKota || "-"}</span>
      </div>
    `;
    button.addEventListener("click", () => selectPerson(person.id));
    elements.quickSearchList.appendChild(button);
  });
}

function selectPerson(id, pushHash = true) {
  state.selectedId = id;
  if (pushHash && id) {
    window.location.hash = id;
  }
  renderList();
  renderDetail();
  openDetailModal();
}

function openDetailModal() {
  elements.detailModal.classList.remove("hidden");
  elements.detailModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeDetailModal(clearHash = true) {
  elements.detailModal.classList.add("hidden");
  elements.detailModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  if (clearHash && window.location.hash) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

function renderList() {
  elements.resultCount.textContent = String(state.filtered.length);
  elements.personList.innerHTML = "";

  if (state.filtered.length === 0) {
    elements.listEmpty.classList.remove("hidden");
    return;
  }

  elements.listEmpty.classList.add("hidden");

  state.filtered.forEach((person) => {
    const card = document.createElement("article");
    card.className = "person-card";
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="person-card__top">
        <div>
          <h3 class="person-card__name">${person.nama}</h3>
          <div class="person-card__porsi">${person.noPorsi}</div>
        </div>
        <div class="chip">${person.kloterLabel}</div>
      </div>
      <div class="person-card__chips">
        <span class="chip">Rombongan ${person.rombongan}</span>
        <span class="chip">Regu ${person.reguKloter}</span>
        <span class="chip">${person.statusJemaah || "Status belum ada"}</span>
      </div>
      <div class="person-card__meta">
        <div><strong>Kab/Kota:</strong> ${person.kabKota || "-"}</div>
        <div><strong>Paspor:</strong> ${person.noPaspor || "-"}</div>
      </div>
    `;

    card.addEventListener("click", () => selectPerson(person.id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectPerson(person.id);
      }
    });
    elements.personList.appendChild(card);
  });
}

function buildAssetLink(label, href) {
  const anchor = document.createElement("a");
  anchor.className = `asset-button${href ? "" : " is-muted"}`;
  anchor.textContent = label;
  if (href) {
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  }
  return anchor;
}

function renderDetail() {
  const person = state.people.find((item) => item.id === state.selectedId);
  if (!person) {
    elements.detailContent.classList.add("hidden");
    closeDetailModal(false);
    return;
  }

  elements.detailContent.classList.remove("hidden");

  elements.detailKloter.textContent = `${person.kloterLabel} • Nomor Porsi ${person.noPorsi}`;
  elements.detailName.textContent = person.nama;
  elements.detailChips.innerHTML = "";
  [
    `Rombongan ${person.rombongan}`,
    `Regu ${person.reguKloter}`,
    person.statusJemaah,
    person.kabKota,
  ]
    .filter(Boolean)
    .forEach((text) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = text;
      elements.detailChips.appendChild(chip);
    });

  elements.detailAssets.innerHTML = "";
  elements.detailAssets.append(
    buildAssetLink("Foto", person.assets.foto),
    buildAssetLink("Kartu Jemaah", person.assets.kartu),
    buildAssetLink("Visa Detail", person.assets.visa)
  );

  elements.detailPhoto.src = person.assets.foto || "";
  elements.detailPhoto.alt = `Foto ${person.nama}`;

  elements.profileHighlights.innerHTML = "";
  [
    ["No. Paspor", person.noPaspor || "-"],
    ["No. Visa", person.noVisa || "-"],
    ["Umur", person.umur ? `${person.umur} tahun` : "-"],
    ["Jenis Kelamin", person.jenisKelamin || "-"],
  ].forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "highlight-card";
    card.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    elements.profileHighlights.appendChild(card);
  });

  elements.fieldGrid.innerHTML = "";
  const tableWrap = document.createElement("div");
  tableWrap.className = "detail-table";

  const table = document.createElement("table");
  table.className = "detail-table__grid";

  const tbody = document.createElement("tbody");
  Object.entries(person.fields).forEach(([key, value]) => {
    const row = document.createElement("tr");

    const labelCell = document.createElement("th");
    labelCell.scope = "row";
    labelCell.textContent = FIELD_LABELS[key] || key;

    const valueCell = document.createElement("td");
    valueCell.textContent = value || "-";

    row.append(labelCell, valueCell);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  elements.fieldGrid.appendChild(tableWrap);
}

function updateFromInputs() {
  state.filters.query = elements.searchInput.value.trim();
  state.filters.kloter = elements.filterKloter.value;
  state.filters.rombongan = elements.filterRombongan.value;
  state.filters.regu = elements.filterRegu.value;
  state.filters.status = elements.filterStatus.value;
  state.filters.kabKota = elements.filterKabKota.value;
  applyFilters();
  renderQuickSearch();
  renderList();
  renderDetail();
}

function hydrateFromHash() {
  const hash = window.location.hash.replace(/^#/, "").trim();
  if (!hash) return;
  if (state.people.some((person) => person.id === hash)) {
    state.selectedId = hash;
  }
}

async function loadData() {
  const [siteResponse, kloter28Response, kloter30Response] = await Promise.all([
    fetch("./data/site.json"),
    fetch("./data/kloter-28.json"),
    fetch("./data/kloter-30.json"),
  ]);

  const site = await siteResponse.json();
  const kloter28 = await kloter28Response.json();
  const kloter30 = await kloter30Response.json();

  state.site = site;
  state.people = [...kloter28.people, ...kloter30.people];
  hydrateFromHash();
  applyFilters();
  renderHeroStats();
  renderFilters();
  renderQuickSearch();
  renderList();
  renderDetail();
}

function attachEvents() {
  elements.searchInput.addEventListener("input", updateFromInputs);
  elements.filterKloter.addEventListener("change", updateFromInputs);
  elements.filterRombongan.addEventListener("change", updateFromInputs);
  elements.filterRegu.addEventListener("change", updateFromInputs);
  elements.filterStatus.addEventListener("change", updateFromInputs);
  elements.filterKabKota.addEventListener("change", updateFromInputs);
  elements.resetButton.addEventListener("click", () => {
    state.filters = {
      query: "",
      kloter: "all",
      rombongan: "all",
      regu: "all",
      status: "all",
      kabKota: "all",
    };
    elements.searchInput.value = "";
    renderFilters();
    updateFromInputs();
  });

  window.addEventListener("hashchange", () => {
    hydrateFromHash();
    renderList();
    renderDetail();
    if (state.selectedId) {
      openDetailModal();
    }
  });

  elements.modalClose.addEventListener("click", () => closeDetailModal());
  elements.modalBackdrop.addEventListener("click", () => closeDetailModal());
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.detailModal.classList.contains("hidden")) {
      closeDetailModal();
    }
  });
}

attachEvents();
setLoading(true);
loadData().catch((error) => {
  console.error(error);
  elements.contentGrid.classList.remove("hidden");
  elements.personList.innerHTML = "";
  elements.listEmpty.classList.remove("hidden");
  elements.listEmpty.innerHTML = `
    <h3>Gagal memuat data</h3>
    <p>Periksa file JSON hasil generate dan pastikan aset website sudah tersedia.</p>
  `;
}).finally(() => {
  setLoading(false);
});
