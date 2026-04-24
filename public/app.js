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
  noHp: "No. HP",
  namaDesa: "Nama Desa",
};

const state = {
  site: null,
  placementGuide: null,
  peopleByKloter: new Map(),
  loadedKloterCodes: new Set(),
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
  placementSection: document.getElementById("placement-section"),
  placementSource: document.getElementById("placement-source"),
  placementGrid: document.getElementById("placement-grid"),
  placementNote: document.getElementById("placement-note"),
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

const mobileSearchGate = window.matchMedia("(max-width: 760px)");
const KLOTER_DATA_PATHS = {
  "28": "./data/kloter-28.json",
  "30": "./data/kloter-30.json",
};

function setControlsDisabled(disabled) {
  filterControls.forEach((control) => {
    control.disabled = disabled;
  });
}

function shouldGateListOnMobile() {
  return mobileSearchGate.matches;
}

function isSearchIdleOnMobile() {
  return shouldGateListOnMobile() && !state.filters.query.trim();
}

function hasActiveFilters() {
  return Boolean(
    state.filters.query.trim() ||
      state.filters.kloter !== "all" ||
      state.filters.rombongan !== "all" ||
      state.filters.regu !== "all" ||
      state.filters.status !== "all" ||
      state.filters.kabKota !== "all"
  );
}

function shouldHoldInitialDesktopList() {
  return !shouldGateListOnMobile() && !hasActiveFilters();
}

function rebuildPeopleCollection() {
  const orderedCodes = Object.keys(KLOTER_DATA_PATHS).filter((code) => state.loadedKloterCodes.has(code));
  state.people = orderedCodes.flatMap((code) => state.peopleByKloter.get(code) || []);
}

function buildFilterValuesFromSite() {
  const summaries = state.site?.kloters || [];
  const uniqueSorted = (values, numeric = false) =>
    [...new Set(values.filter(Boolean))].sort((a, b) =>
      numeric ? Number(a) - Number(b) : String(a).localeCompare(String(b))
    );

  return {
    kloters: uniqueSorted(summaries.map((item) => item.code), true),
    rombongan: uniqueSorted(summaries.flatMap((item) => item.rombongan || []), true),
    regu: uniqueSorted(summaries.flatMap((item) => item.reguKloter || []), true),
    status: uniqueSorted(summaries.flatMap((item) => item.statusJemaah || [])),
    kabKota: uniqueSorted(summaries.flatMap((item) => item.kabKota || [])),
  };
}

async function loadKloterData(code) {
  if (state.loadedKloterCodes.has(code)) return;
  if (!KLOTER_DATA_PATHS[code]) return;
  const response = await fetch(KLOTER_DATA_PATHS[code]);
  if (!response.ok) {
    throw new Error(`Gagal memuat data kloter ${code}`);
  }
  const payload = await response.json();
  state.peopleByKloter.set(code, payload.people || []);
  state.loadedKloterCodes.add(code);
  rebuildPeopleCollection();
}

async function ensureRelevantPeopleLoaded() {
  if (isSearchIdleOnMobile()) return;
  if (!hasActiveFilters()) return;

  const codesToLoad =
    state.filters.kloter !== "all" ? [state.filters.kloter] : Object.keys(KLOTER_DATA_PATHS);

  await Promise.all(codesToLoad.map((code) => loadKloterData(code)));
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

function formatPhoneNumber(value) {
  const digits = String(value || "").replace(/\D+/g, "");
  if (!digits || digits === "0") return "-";
  if (digits.startsWith("62")) return `0${digits.slice(2)}`;
  if (digits.startsWith("0")) return digits;
  return `0${digits}`;
}

function normalizePhoneDigits(value) {
  const digits = String(value || "").replace(/\D+/g, "");
  if (!digits || digits === "0") return "";
  return digits;
}

function toWhatsAppNumber(value) {
  const digits = normalizePhoneDigits(value);
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return `62${digits}`;
}

function displayFieldValue(key, value) {
  if (key === "noHp") return formatPhoneNumber(value);
  return value || "-";
}

function createIcon(name) {
  const paths = {
    phone:
      '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.35 1.9.66 2.81a2 2 0 0 1-.45 2.11L8.05 9.91a16 16 0 0 0 6.04 6.04l1.27-1.27a2 2 0 0 1 2.11-.45c.91.31 1.85.53 2.81.66A2 2 0 0 1 22 16.92Z"></path>',
    whatsapp:
      '<path d="M3 21l1.31-4.58A8.5 8.5 0 1 1 7.7 19.56L3 21Z"></path><path d="M9.2 8.7c.2-.45.35-.47.63-.47h.45c.17 0 .42.06.64.32.22.27.84.82.84 2 0 1.17-.86 2.3-.98 2.46-.12.15-1.66 2.65-4.1 3.61-.58.23-1.03.37-1.38.47-.58.18-1.1.15-1.52.09-.46-.07-1.42-.58-1.62-1.14-.2-.56-.2-1.04-.14-1.14.06-.1.22-.16.46-.28.23-.12 1.38-.68 1.6-.76.21-.08.37-.12.52.12.16.23.6.75.73.9.14.16.27.18.5.06.23-.12.98-.36 1.87-1.15.69-.62 1.16-1.38 1.3-1.61.13-.23.01-.36-.1-.48-.1-.1-.23-.27-.35-.4-.12-.14-.16-.24-.24-.4-.08-.15-.04-.3.02-.42.06-.12.52-1.26.72-1.72Z"></path>',
  };

  return `
    <svg class="phone-action__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      ${paths[name] || ""}
    </svg>
  `;
}

function renderPhoneValueCell(cell, value) {
  const digits = normalizePhoneDigits(value);
  const displayValue = formatPhoneNumber(value);
  cell.classList.add("detail-table__phone-cell");

  const valueNode = document.createElement("span");
  valueNode.className = "phone-value";
  valueNode.textContent = displayValue;
  cell.appendChild(valueNode);

  const actions = document.createElement("div");
  actions.className = "phone-actions";

  if (!digits) {
    actions.classList.add("is-disabled");
  }

  const phoneLink = document.createElement("a");
  phoneLink.className = `phone-action${digits ? "" : " is-disabled"}`;
  phoneLink.href = digits ? `tel:${displayValue}` : "#";
  phoneLink.setAttribute("aria-label", digits ? `Telepon ${displayValue}` : "Nomor HP tidak tersedia");
  phoneLink.title = "Telepon";
  phoneLink.innerHTML = createIcon("phone");

  const whatsappNumber = toWhatsAppNumber(value);
  const whatsappLink = document.createElement("a");
  whatsappLink.className = `phone-action phone-action--whatsapp${whatsappNumber ? "" : " is-disabled"}`;
  whatsappLink.href = whatsappNumber ? `https://wa.me/${whatsappNumber}` : "#";
  whatsappLink.target = whatsappNumber ? "_blank" : "";
  whatsappLink.rel = whatsappNumber ? "noopener noreferrer" : "";
  whatsappLink.setAttribute(
    "aria-label",
    whatsappNumber ? `Buka WhatsApp ${displayValue}` : "WhatsApp tidak tersedia"
  );
  whatsappLink.title = "WhatsApp";
  whatsappLink.innerHTML = createIcon("whatsapp");

  actions.append(phoneLink, whatsappLink);
  cell.appendChild(actions);
}

function matchesQuery(person, query) {
  if (!query) return true;
  const haystack = [
    person.nama,
    person.noPorsi,
    person.noPaspor,
    person.noVisa,
    person.noHp,
    formatPhoneNumber(person.noHp),
    person.namaDesa,
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
  if (isSearchIdleOnMobile()) {
    state.filtered = [];
    state.selectedId = null;
    return;
  }

  if (shouldHoldInitialDesktopList()) {
    state.filtered = [];
    state.selectedId = null;
    return;
  }

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
  const values = buildFilterValuesFromSite();
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
    const title = elements.listEmpty.querySelector("h3");
    const description = elements.listEmpty.querySelector("p");
    if (isSearchIdleOnMobile()) {
      title.textContent = "Mulai dengan pencarian";
      description.textContent =
        "Pada tampilan mobile, daftar jemaah akan muncul setelah Anda mengetik di kolom pencarian cepat.";
    } else if (shouldHoldInitialDesktopList()) {
      title.textContent = "Pilih kloter atau mulai pencarian";
      description.textContent =
        "Untuk mempercepat pembukaan halaman, daftar jemaah tidak dimuat penuh saat awal. Pilih kloter atau cari nama, nomor porsi, paspor, atau visa untuk memuat data yang relevan.";
    } else {
      title.textContent = "Tidak ada data yang cocok";
      description.textContent = "Ubah kata kunci atau filter untuk menampilkan jemaah lain.";
    }
    elements.listEmpty.classList.remove("hidden");
    return;
  }

  elements.listEmpty.classList.add("hidden");

  state.filtered.forEach((person) => {
    const placementSummary = buildPersonPlacementSummary(person);
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
      ${
        placementSummary
          ? `<div class="person-card__placement">
              <span class="person-card__placement-label">Penempatan kloter</span>
              <strong>${placementSummary.primary}</strong>
              <p>${placementSummary.secondary}</p>
            </div>`
          : ""
      }
      <div class="person-card__meta">
        <div><strong>Kab/Kota:</strong> ${person.kabKota || "-"}</div>
        <div><strong>Desa:</strong> ${person.namaDesa || "-"}</div>
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

function summarizeAccommodation(section, cityLabel) {
  const items = section?.accommodations || [];
  if (items.length === 0) return `${cityLabel}: belum ada rincian`;
  if (items.length === 1) {
    const item = items[0];
    return `${cityLabel}: ${item.namaHotel} • No. ${item.noHotel}`;
  }
  return `${cityLabel}: ${items.length} akomodasi kloter`;
}

function buildPersonPlacementSummary(person) {
  const placement = getPlacementForPerson(person);
  if (!placement) return null;

  const minaPlacement = placement.placements?.minaArea;
  return {
    primary: `Mina ${minaPlacement.nomorBoksGateMina} • Zona ${minaPlacement.zona}`,
    secondary: [
      summarizeAccommodation(placement.placements?.akomodasiMakkah, "Makkah"),
      summarizeAccommodation(placement.placements?.akomodasiMadinah, "Madinah"),
    ].join(" • "),
  };
}

function buildPlacementFact(label, value) {
  const item = document.createElement("div");
  item.className = "placement-fact";
  item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  return item;
}

function buildPlacementCard(title, description, eyebrow = "") {
  const card = document.createElement("article");
  card.className = "placement-card";

  const header = document.createElement("div");
  header.className = "placement-card__header";
  header.innerHTML = `${eyebrow ? `<span class="placement-card__eyebrow">${eyebrow}</span>` : ""}<h4>${title}</h4>${description ? `<p>${description}</p>` : ""}`;

  const body = document.createElement("div");
  body.className = "placement-card__body";

  card.append(header, body);
  return { card, body };
}

function buildPlacementLink(label, query) {
  const anchor = document.createElement("a");
  anchor.className = "placement-link";
  anchor.href = `https://www.google.com/maps?q=${encodeURIComponent(query)}`;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.textContent = label;
  return anchor;
}

function getPlacementForPerson(person) {
  return state.placementGuide?.kloters?.find((item) => item.code === person.kloterCode) || null;
}

function renderPlacement(person) {
  const placement = getPlacementForPerson(person);
  if (!placement) {
    elements.placementSection.classList.add("hidden");
    elements.placementGrid.innerHTML = "";
    elements.placementNote.textContent = "";
    elements.placementSource.textContent = "";
    return;
  }

  const placementDocument = state.placementGuide.document;
  const hasSplitAccommodation = ["akomodasiMakkah", "akomodasiMadinah"].some((key) => {
    const items = placement.placements?.[key]?.accommodations || [];
    return items.length > 1;
  });

  elements.placementSection.classList.remove("hidden");
  elements.placementGrid.innerHTML = "";
  elements.placementSource.textContent = `Dokumen resmi • Surat ${placementDocument.nomorSurat} • ${placementDocument.tanggalSuratDisplay}`;
  elements.placementNote.textContent = hasSplitAccommodation
    ? "Rincian di bawah ini mengikuti penempatan tingkat kloter pada surat resmi. Jika akomodasi terbagi ke beberapa hotel, dokumen sumber belum menunjukkan distribusi hotel per individu."
    : "Rincian di bawah ini mengikuti penempatan kloter pada surat resmi Kanwil Gorontalo dan dapat dipakai sebagai konteks pendampingan jemaah.";

  const minaPlacement = placement.placements.minaArea;
  const minaCard = buildPlacementCard(
    "Area Mina",
    "Acuan boks/gate dan zona kloter saat fase Mina.",
    "Tahap Mina"
  );
  minaCard.body.append(
    buildPlacementFact("Kloter", placement.label),
    buildPlacementFact("Jumlah Jemaah", `${placement.jumlahJemaah} jemaah`),
    buildPlacementFact("Boks/Gate Mina", minaPlacement.nomorBoksGateMina),
    buildPlacementFact("Zona", `Zona ${minaPlacement.zona}`)
  );
  elements.placementGrid.appendChild(minaCard.card);

  const tentPlacement = placement.placements.tendaMinaArafah;
  const tentCard = buildPlacementCard(
    "Tenda Mina dan Arafah",
    "Nomor jalan, nomor tenda, dan titik peta yang relevan untuk kloter.",
    "Rute & Titik"
  );
  tentCard.body.append(
    buildPlacementFact("Nomor Jalan", tentPlacement.nomorJalan),
    buildPlacementFact("Nomor Tenda", tentPlacement.nomorTenda),
    buildPlacementFact("Zona Mina", `Zona ${tentPlacement.zonaMina}`),
    buildPlacementFact("Boks/Gate", tentPlacement.nomorBoksGate)
  );
  const linkGroup = document.createElement("div");
  linkGroup.className = "placement-links";
  linkGroup.append(
    buildPlacementLink("Buka Lokasi Mina", tentPlacement.titikLokasiMina.gmapsQuery),
    buildPlacementLink("Buka Lokasi Arafah", tentPlacement.titikLokasiArafah.gmapsQuery)
  );
  tentCard.body.appendChild(linkGroup);
  const coordinateGrid = document.createElement("div");
  coordinateGrid.className = "placement-coordinates";
  coordinateGrid.innerHTML = `
    <div class="placement-coordinate">
      <span>Koordinat Mina</span>
      <code>${tentPlacement.titikLokasiMina.gmapsQuery}</code>
    </div>
    <div class="placement-coordinate">
      <span>Koordinat Arafah</span>
      <code>${tentPlacement.titikLokasiArafah.gmapsQuery}</code>
    </div>
  `;
  tentCard.body.appendChild(coordinateGrid);
  elements.placementGrid.appendChild(tentCard.card);

  [
    ["akomodasiMakkah", "Akomodasi Makkah"],
    ["akomodasiMadinah", "Akomodasi Madinah"],
  ].forEach(([key, title]) => {
    const section = placement.placements[key];
    const isSplit = (section.accommodations || []).length > 1;
    const accommodationCard = buildPlacementCard(
      title,
      isSplit
        ? `Kloter ${placement.label} terbagi ke beberapa akomodasi. Data ini belum menetapkan hotel per individu.`
        : `Seluruh kapasitas kloter ${placement.label} tercatat pada satu akomodasi dalam dokumen.`,
      title.includes("Makkah") ? "Fase Makkah" : "Fase Madinah"
    );
    accommodationCard.body.append(
      buildPlacementFact("Jumlah Jemaah Kloter", `${placement.jumlahJemaah} jemaah`),
      buildPlacementFact("Kapasitas Tercantum", `${section.kapasitasTotal} jemaah`)
    );

    const list = document.createElement("div");
    list.className = "placement-accommodation-list";
    section.accommodations.forEach((item) => {
      const node = document.createElement("div");
      node.className = "placement-accommodation";
      node.innerHTML = `
        <div class="placement-accommodation__top">
          <strong>${item.namaHotel}</strong>
          <span>Akomodasi ${item.sequence}</span>
        </div>
        <div class="placement-accommodation__meta">
          <span>No. Hotel ${item.noHotel}</span>
          <span>Kapasitas ${item.kapasitas} jemaah</span>
        </div>
      `;
      list.appendChild(node);
    });
    accommodationCard.body.appendChild(list);
    elements.placementGrid.appendChild(accommodationCard.card);
  });
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
    ["No. HP", formatPhoneNumber(person.noHp)],
    ["Nama Desa", person.namaDesa || "-"],
    ["Umur", person.umur ? `${person.umur} tahun` : "-"],
    ["Jenis Kelamin", person.jenisKelamin || "-"],
  ].forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "highlight-card";
    card.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    elements.profileHighlights.appendChild(card);
  });

  renderPlacement(person);

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
    if (key === "noHp") {
      renderPhoneValueCell(valueCell, value);
    } else {
      valueCell.textContent = displayFieldValue(key, value);
    }

    row.append(labelCell, valueCell);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  elements.fieldGrid.appendChild(tableWrap);
}

async function updateFromInputs() {
  state.filters.query = elements.searchInput.value.trim();
  state.filters.kloter = elements.filterKloter.value;
  state.filters.rombongan = elements.filterRombongan.value;
  state.filters.regu = elements.filterRegu.value;
  state.filters.status = elements.filterStatus.value;
  state.filters.kabKota = elements.filterKabKota.value;
  await ensureRelevantPeopleLoaded();
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

async function syncSelectionFromHash() {
  const hash = window.location.hash.replace(/^#/, "").trim();
  if (!hash) {
    state.selectedId = null;
    return;
  }

  if (!state.people.some((person) => person.id === hash)) {
    await Promise.all(Object.keys(KLOTER_DATA_PATHS).map((code) => loadKloterData(code)));
  }

  hydrateFromHash();
}

async function loadData() {
  const [siteResponse, placementResponse] = await Promise.all([
    fetch("./data/site.json"),
    fetch("./data/penempatan-jemaah-gorontalo.json"),
  ]);

  if (!siteResponse.ok) {
    throw new Error("Gagal memuat data situs");
  }

  const site = await siteResponse.json();
  const placementGuide = placementResponse.ok ? await placementResponse.json() : null;

  state.site = site;
  state.placementGuide = placementGuide;
  if (window.location.hash) {
    await Promise.all(Object.keys(KLOTER_DATA_PATHS).map((code) => loadKloterData(code)));
    hydrateFromHash();
  }
  applyFilters();
  renderHeroStats();
  renderFilters();
  renderQuickSearch();
  renderList();
  renderDetail();
}

function attachEvents() {
  elements.searchInput.addEventListener("input", () => {
    void updateFromInputs();
  });
  elements.filterKloter.addEventListener("change", () => {
    void updateFromInputs();
  });
  elements.filterRombongan.addEventListener("change", () => {
    void updateFromInputs();
  });
  elements.filterRegu.addEventListener("change", () => {
    void updateFromInputs();
  });
  elements.filterStatus.addEventListener("change", () => {
    void updateFromInputs();
  });
  elements.filterKabKota.addEventListener("change", () => {
    void updateFromInputs();
  });
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
    void updateFromInputs();
  });

  window.addEventListener("hashchange", async () => {
    await syncSelectionFromHash();
    renderList();
    renderDetail();
    if (state.selectedId) {
      openDetailModal();
    }
  });

  const handleViewportChange = async () => {
    await ensureRelevantPeopleLoaded();
    applyFilters();
    renderQuickSearch();
    renderList();
    renderDetail();
  };

  if (typeof mobileSearchGate.addEventListener === "function") {
    mobileSearchGate.addEventListener("change", handleViewportChange);
  } else if (typeof mobileSearchGate.addListener === "function") {
    mobileSearchGate.addListener(handleViewportChange);
  }

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
