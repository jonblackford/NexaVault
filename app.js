(() => {
  // =========================
  // ✅ CONFIG (EDIT THESE)
  // =========================
  const SUPABASE_URL = "https://zmljybyharvunwctxbwp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptbGp5YnloYXJ2dW53Y3R4YndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MDQ5NDgsImV4cCI6MjA4MzM4MDk0OH0.h6TW7xX4B4y8D-yBL6-WqnhYWo0MqFAAP14lzXmXyrg";
  const TMDB_API_KEY = "cc4e1c1296a271801dd38dd0c5742ec3";
  const USE_RELEASE_DATE_COLUMN = false; // only if your table has release_date
  // =========================

  const TMDB_BASE = "https://api.themoviedb.org/3";
  const TMDB_IMG_500 = "https://image.tmdb.org/t/p/w500";
  const TMDB_IMG_ORIG = "https://image.tmdb.org/t/p/original";

  // UI refs
  const authPanel = document.getElementById("authPanel");
  const appPanel = document.getElementById("appPanel");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const authMsg = document.getElementById("authMsg");
  const signInBtn = document.getElementById("signInBtn");
  const signUpBtn = document.getElementById("signUpBtn");

  const profileBtn = document.getElementById("profileBtn");
  const profileMenu = document.getElementById("profileMenu");
  const profileEmail = document.getElementById("profileEmail");
  const profileLogout = document.getElementById("profileLogout");
  const collectionsBtn = document.getElementById("collectionsBtn");

  const typeAll = document.getElementById("typeAll");
  const typeMovie = document.getElementById("typeMovie");
  const typeTv = document.getElementById("typeTv");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const searchResults = document.getElementById("searchResults");

  const filterCollection = document.getElementById("filterCollection");
  const filterScope = document.getElementById("filterScope");
  const filterMediaType = document.getElementById("filterMediaType");
  const filterFormat = document.getElementById("filterFormat");
  const librarySearch = document.getElementById("librarySearch");
  const sortBy = document.getElementById("sortBy");
  const minRating = document.getElementById("minRating");
  const statsText = document.getElementById("statsText");

  const viewGridBtn = document.getElementById("viewGridBtn");
  const viewListBtn = document.getElementById("viewListBtn");
  const grid = document.getElementById("grid");
  const list = document.getElementById("list");
  const emptyState = document.getElementById("emptyState");

  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modalBody");
  const toast = document.getElementById("toast");

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let sessionUser = null;
  let library = [];
  let searchType = "all";
  let viewMode = localStorage.getItem("nv_view") || "grid"; // grid|list

  // Collections state
  let collectionsAvailable = null;
  let collections = [];
  let collectionItems = new Map(); // media_item_id -> Set(collection_id)
  let currentCollectionFilter = "all";

  // Helpers
  const esc = (s) =>
    (s ?? "").toString().replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));

  function showToast(message) {
    if (!toast) return;
    toast.classList.remove("hidden");
    toast.querySelector("div").textContent = message;
    setTimeout(() => toast.classList.add("hidden"), 2400);
  }

  function closeProfileMenu() { profileMenu?.classList.add("hidden"); }
  function toggleProfileMenu() { profileMenu?.classList.toggle("hidden"); }

  function lockBodyScroll() {
    document.documentElement.classList.add("modal-open");
    document.body.classList.add("modal-open");
    document.documentElement.style.overscrollBehavior = "none";
  }
  function unlockBodyScroll() {
    document.documentElement.classList.remove("modal-open");
    document.body.classList.remove("modal-open");
    document.documentElement.style.overscrollBehavior = "";
  }

  function openModal(html) {
    modalBody.innerHTML = html;
    modal.classList.remove("hidden");
    lockBodyScroll();
  }
  function closeModal() {
    modal.classList.add("hidden");
    modalBody.innerHTML = "";
    unlockBodyScroll();
  }
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  function imgUrl(path, size = "w500") {
    if (!path) return null;
    if (size === "orig") return `${TMDB_IMG_ORIG}${path}`;
    return `${TMDB_IMG_500}${path}`;
  }

  function btnActive(el, isActive) {
    if (!el) return;
    el.classList.toggle("bg-white/10", isActive);
    el.classList.toggle("border-white/15", isActive);
  }

  function starsFromRating(r) {
    if (r === null || r === undefined || r === "") return "";
    const n = Math.max(0, Math.min(10, Number(r)));
    const five = n / 2; // 0..5
    const full = Math.floor(five);
    const half = (five - full) >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return "★".repeat(full) + (half ? "⯨" : "") + "☆".repeat(empty);
  }

  // Safe time parser (fixes Added sorting)
  function toTime(v) {
    if (!v) return 0;
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }

  // TMDB
  async function tmdbFetch(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  }

  async function searchTMDB(query) {
    const q = encodeURIComponent(query);
    const url = `${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&query=${q}&include_adult=false`;
    const data = await tmdbFetch(url);
    return (data.results || [])
      .filter(r => (searchType === "all" ? (r.media_type === "movie" || r.media_type === "tv") : r.media_type === searchType))
      .map(r => ({
        tmdb_id: r.id,
        media_type: r.media_type,
        title: r.media_type === "movie" ? r.title : r.name,
        year: ((r.media_type === "movie" ? r.release_date : r.first_air_date) || "").split("-")[0] || "",
        release_date_full: (r.media_type === "movie" ? (r.release_date || "") : (r.first_air_date || "")),
        poster_path: r.poster_path,
        overview: r.overview || ""
      }));
  }

  async function getDetails(media_type, tmdb_id) {
    const endpoint = media_type === "movie" ? "movie" : "tv";
    const url = `${TMDB_BASE}/${endpoint}/${tmdb_id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
    const d = await tmdbFetch(url);

    const cast = (d.credits?.cast || []).slice(0, 10).map(c => c.name).join(", ");
    const genres = (d.genres || []).map(g => g.name).join(", ");

    let runtime = "";
    if (media_type === "movie") runtime = d.runtime ? `${d.runtime} min` : "";
    if (media_type === "tv") runtime = (d.episode_run_time?.[0] ? `${d.episode_run_time[0]} min` : "");

    return {
      tmdb_id: d.id,
      media_type,
      title: media_type === "movie" ? d.title : d.name,
      year: ((media_type === "movie" ? d.release_date : d.first_air_date) || "").split("-")[0] || "",
      release_date_full: (media_type === "movie" ? (d.release_date || "") : (d.first_air_date || "")),
      poster_url: imgUrl(d.poster_path),
      backdrop_url: imgUrl(d.backdrop_path, "orig"),
      overview: d.overview || "No overview available.",
      cast: cast || "—",
      genre: genres || "—",
      runtime: runtime || "—",
      seasons: media_type === "tv" ? (d.seasons || []).filter(s => s.season_number !== 0) : []
    };
  }

  async function getSeasonEpisodes(tv_id, season_number) {
    const url = `${TMDB_BASE}/tv/${tv_id}/season/${season_number}?api_key=${TMDB_API_KEY}`;
    const d = await tmdbFetch(url);
    return (d.episodes || []).map(ep => ({
      episode_number: ep.episode_number,
      name: ep.name,
      overview: ep.overview || "",
      still_path: ep.still_path,
      air_date: ep.air_date || "",
      runtime: ep.runtime || null
    }));
  }

  // Collections availability
  async function detectCollections() {
    if (collectionsAvailable !== null) return collectionsAvailable;
    const { error } = await supabase.from("collections").select("id").limit(1);
    collectionsAvailable = !error;
    return collectionsAvailable;
  }

  async function loadCollections() {
    if (!(await detectCollections()) || !sessionUser) {
      collections = [];
      collectionItems = new Map();
      renderCollectionFilter();
      return;
    }
    const { data: cols, error } = await supabase
      .from("collections")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      collections = [];
      renderCollectionFilter();
      return;
    }
    collections = cols || [];

    const { data: links, error: e2 } = await supabase
      .from("collection_items")
      .select("collection_id, media_item_id")
      .eq("user_id", sessionUser.id);
    if (e2) {
      console.error(e2);
      collectionItems = new Map();
    } else {
      const map = new Map();
      (links||[]).forEach(l => {
        if (!map.has(l.media_item_id)) map.set(l.media_item_id, new Set());
        map.get(l.media_item_id).add(l.collection_id);
      });
      collectionItems = map;
    }
    renderCollectionFilter();
  }

  function renderCollectionFilter() {
    if (!filterCollection) return;
    const cur = filterCollection.value || "all";
    const opts = ['<option value="all">All collections</option>']
      .concat(collections.map(c => `<option value="${c.id}">${esc(c.name)}</option>`));
    filterCollection.innerHTML = opts.join("");
    if (cur) filterCollection.value = cur;
  }

  async function openCollectionsManager() {
    if (!(await detectCollections())) {
      showToast("Collections tables not found. Run supabase_collections.sql.");
      return;
    }
    await loadCollections();

    openModal(`
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <div class="text-2xl font-semibold">Collections</div>
          <button id="mClose" class="btn chip rounded-2xl px-3 py-1.5">Close</button>
        </div>

        <div class="glass rounded-2xl p-4 border border-white/10">
          <div class="font-semibold">Create a collection</div>
          <div class="mt-3 flex flex-col md:flex-row gap-2">
            <input id="newColName" class="input rounded-2xl px-3 py-2 flex-1" placeholder="Collection name" />
            <button id="createColBtn" class="btn rounded-2xl px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-400/20">Create</button>
          </div>
        </div>

        <div class="glass rounded-2xl p-4 border border-white/10">
          <div class="font-semibold">Your collections</div>
          <div id="colList" class="mt-3 space-y-2"></div>
        </div>
      </div>
    `);

    document.getElementById("mClose").addEventListener("click", closeModal);

    const renderList = () => {
      const el = document.getElementById("colList");
      if (!collections.length) {
        el.innerHTML = `<div class="text-sm text-white/70">No collections yet.</div>`;
        return;
      }
      el.innerHTML = collections.map(c => `
        <div class="glass rounded-2xl p-3 border border-white/10 flex items-center gap-2">
          <div class="flex-1 min-w-0">
            <div class="font-semibold truncate">${esc(c.name)}</div>
            <div class="text-xs text-white/60">${c.id}</div>
          </div>
          <button class="btn chip rounded-2xl px-3 py-1.5 text-sm" data-view="${c.id}">View</button>
          <button class="btn chip rounded-2xl px-3 py-1.5 text-sm" data-rename="${c.id}">Rename</button>
          <button class="btn rounded-2xl px-3 py-1.5 text-sm bg-red-500/15 hover:bg-red-500/20 border border-red-400/20" data-del="${c.id}">Delete</button>
        </div>
      `).join("");

      el.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => {
        filterCollection.value = b.dataset.view;
        currentCollectionFilter = b.dataset.view;
        closeModal();
        renderLibrary();
      }));

      el.querySelectorAll("[data-rename]").forEach(b => b.addEventListener("click", async () => {
        const id = b.dataset.rename;
        const c = collections.find(x => x.id === id);
        const name = prompt("Rename collection", c?.name || "");
        if (!name) return;
        const { error } = await supabase.from("collections").update({ name }).eq("id", id);
        if (error) {
          console.error(error);
          showToast("Rename failed");
          return;
        }
        await loadCollections();
        renderList();
        showToast("Renamed");
      }));

      el.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
        const id = b.dataset.del;
        if (!confirm("Delete this collection?")) return;
        // delete links first
        await supabase.from("collection_items").delete().eq("collection_id", id);
        const { error } = await supabase.from("collections").delete().eq("id", id);
        if (error) {
          console.error(error);
          showToast("Delete failed");
          return;
        }
        await loadCollections();
        renderList();
        showToast("Deleted");
      }));
    };
    renderList();

    document.getElementById("createColBtn").addEventListener("click", async () => {
      const name = (document.getElementById("newColName").value || "").trim();
      if (!name) return;
      const { error } = await supabase.from("collections").insert({ user_id: sessionUser.id, name });
      if (error) {
        console.error(error);
        showToast("Create failed");
        return;
      }
      document.getElementById("newColName").value = "";
      await loadCollections();
      renderList();
      showToast("Created");
    });
  }

  // Library
  async function loadLibrary() {
    if (!sessionUser) return;
    const { data, error } = await supabase
      .from("media_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      showToast("Failed to load catalog");
      library = [];
      renderLibrary();
      return;
    }
    library = data || [];
    await loadCollections();
    renderLibrary();
  }

  async function upsertItem(payload) {
    // schema resilience: if cast_list isn't present, try cast; if cast isn't present, try cast_list
    const attempt = async (p) => {
      return supabase.from("media_items").upsert(p, {
        onConflict: "user_id,tmdb_id,media_type,scope,season_number,episode_number"
      });
    };

    let { error } = await attempt(payload);
    if (error && /column\s+\"cast_list\"\s+does not exist/i.test(error.message)) {
      const p2 = { ...payload };
      p2.cast = payload.cast_list;
      delete p2.cast_list;
      ({ error } = await attempt(p2));
    } else if (error && /column\s+\"cast\"\s+does not exist/i.test(error.message)) {
      const p2 = { ...payload };
      p2.cast_list = payload.cast;
      delete p2.cast;
      ({ error } = await attempt(p2));
    } else if (error && /column\s+\"release_date\"\s+does not exist/i.test(error.message)) {
      const p2 = { ...payload };
      delete p2.release_date;
      ({ error } = await attempt(p2));
    }

    if (error) {
      console.error(error);
      showToast("Save failed");
      return false;
    }
    await loadLibrary();
    showToast("Saved");
    return true;
  }

  async function deleteItem(rowId) {
    const { error } = await supabase.from("media_items").delete().eq("id", rowId);
    if (error) {
      console.error(error);
      showToast("Delete failed");
      return false;
    }
    await loadLibrary();
    showToast("Removed");
    return true;
  }

  function libraryFiltersMatch(row) {
    const scopeOk = filterScope.value === "all" || row.scope === filterScope.value;
    const typeOk = filterMediaType.value === "all" || row.media_type === filterMediaType.value;
    const formatOk = filterFormat.value === "all" || (row.format || "Digital") === filterFormat.value;

    const minR = Number(minRating.value || 0);
    const ratingVal = (row.rating === null || row.rating === undefined || row.rating === "") ? null : Number(row.rating);
    const ratingOk = minR === 0 || (ratingVal !== null && ratingVal >= minR);

    // Collection filter
    const colId = filterCollection?.value || "all";
    if (colId !== "all") {
      const set = collectionItems.get(row.id);
      if (!set || !set.has(colId)) return false;
    }

    const q = (librarySearch.value || "").trim().toLowerCase();
    const searchOk = !q || [
      row.title,
      row.comment,
      row.genre,
      row.cast_list || row.cast,
      row.overview,
      row.year,
      row.format
    ].some(v => (v || "").toString().toLowerCase().includes(q));

    return scopeOk && typeOk && formatOk && ratingOk && searchOk;
  }

  function sortLibraryRows(rows) {
    const mode = sortBy.value || "added_desc";
    const toNumYear = (y) => {
      const n = parseInt((y || "").toString().slice(0,4), 10);
      return Number.isFinite(n) ? n : 0;
    };
    const toDateNum = (r) => {
      const d = (r.release_date || "").toString();
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return Date.parse(d) || 0;
      return toNumYear(r.year) * 365 * 24 * 3600 * 1000;
    };
    const ratingNum = (r) => {
      const v = r.rating;
      if (v === null || v === undefined || v === "") return -1;
      const n = Number(v);
      return Number.isFinite(n) ? n : -1;
    };
    const coll = [...rows];
    coll.sort((a,b) => {
      switch (mode) {
        case "added_asc": return toTime(a.created_at) - toTime(b.created_at);
        case "release_desc": return toDateNum(b) - toDateNum(a);
        case "release_asc": return toDateNum(a) - toDateNum(b);
        case "rating_desc": return ratingNum(b) - ratingNum(a);
        case "rating_asc": return ratingNum(a) - ratingNum(b);
        case "title_asc": return (a.title||"").localeCompare(b.title||"");
        case "title_desc": return (b.title||"").localeCompare(a.title||"");
        case "added_desc":
        default: return toTime(b.created_at) - toTime(a.created_at);
      }
    });
    return coll;
  }

  function setView(mode) {
    viewMode = mode;
    localStorage.setItem("nv_view", mode);
    btnActive(viewGridBtn, mode === "grid");
    btnActive(viewListBtn, mode === "list");
    if (mode === "grid") {
      grid.classList.remove("hidden");
      list.classList.add("hidden");
    } else {
      list.classList.remove("hidden");
      grid.classList.add("hidden");
    }
    renderLibrary();
  }

  function renderLibrary() {
    const filtered = sortLibraryRows((library || []).filter(libraryFiltersMatch));
    statsText.textContent = `${filtered.length} item${filtered.length===1?"":"s"} (of ${library.length})`;

    if (!filtered.length) {
      grid.innerHTML = "";
      list.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    if (viewMode === "grid") {
      grid.innerHTML = filtered.map((row) => {
        const poster = row.poster_url || "";
        const scopeLabel = row.scope === "title" ? "Title" : row.scope === "season" ? `Season ${row.season_number}` : `S${row.season_number}E${row.episode_number}`;
        const subtitle = row.scope === "title" ? "" : scopeLabel;

        const rating = (row.rating ?? null);
        return `
          <button class="poster-card rounded-2xl overflow-hidden text-left" data-rowid="${row.id}">
            <div class="relative">
              <div class="aspect-[2/3] bg-black/25">
                ${poster ? `<img src="${esc(poster)}" class="w-full h-full object-cover" loading="lazy" />` : `<div class="w-full h-full flex items-center justify-center text-3xl">🎬</div>`}
              </div>
              <div class="absolute top-2 left-2 chip px-2 py-1 rounded-xl text-xs">${row.media_type === "tv" ? "📺" : "🎬"} ${scopeLabel}</div>
              ${rating !== null && rating !== undefined && rating !== "" ? `<div class="absolute top-2 right-2 chip px-2 py-1 rounded-xl text-xs">⭐ ${rating}/10</div>` : ""}
            </div>
            <div class="p-3">
              <div class="font-semibold text-sm truncate">${esc(row.title)}</div>
              ${subtitle ? `<div class="text-xs text-white/60 mt-1 truncate">${esc(subtitle)}</div>` : ""}
              <div class="text-xs text-white/65 mt-1 flex items-center justify-between gap-2">
                <span class="truncate">${esc(row.year || "")}</span>
                <span class="chip px-2 py-0.5 rounded-full">${esc(row.format || "Digital")}</span>
              </div>
            </div>
          </button>
        `;
      }).join("");
      list.innerHTML = "";
    } else {
      list.innerHTML = filtered.map(row => {
        const scopeLabel = row.scope === "title" ? "Title" : row.scope === "season" ? `Season ${row.season_number}` : `S${row.season_number}E${row.episode_number}`;
        const rating = (row.rating ?? "");
        return `
          <button class="glass rounded-2xl p-3 border border-white/10 w-full text-left flex items-center gap-3" data-rowid="${row.id}">
            <div class="w-12 h-16 rounded-xl overflow-hidden bg-black/25 border border-white/10 flex-shrink-0">
              ${row.poster_url ? `<img src="${esc(row.poster_url)}" class="w-full h-full object-cover" loading="lazy" />` : `<div class="w-full h-full flex items-center justify-center">🎬</div>`}
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold truncate">${esc(row.title)}</div>
              <div class="text-xs text-white/60 mt-0.5">${esc(scopeLabel)} • ${esc(row.year || "")} • ${esc(row.format || "Digital")}</div>
              ${row.comment ? `<div class="text-xs text-white/65 mt-1 line-clamp-2">${esc(row.comment)}</div>` : ""}
            </div>
            <div class="text-xs text-white/70 text-right">
              ${rating !== "" ? `<div>⭐ ${rating}/10</div>` : ""}
              <div class="mt-1">${starsFromRating(rating)}</div>
            </div>
          </button>
        `;
      }).join("");
      grid.innerHTML = "";
    }

    document.querySelectorAll("[data-rowid]").forEach(card => {
      card.addEventListener("click", () => {
        const rowId = Number(card.dataset.rowid);
        const row = library.find(r => r.id === rowId);
        if (row) showItemModal(row);
      });
    });
  }

  // Search results UI
  function renderSearchResults(items) {
    if (!items.length) {
      searchResults.innerHTML = `<div class="p-4 text-sm text-white/70">No results</div>`;
      searchResults.classList.remove("hidden");
      return;
    }
    searchResults.innerHTML = items.map(it => {
      const poster = it.poster_path ? imgUrl(it.poster_path) : null;
      const badge = it.media_type === "tv" ? "TV" : "Movie";
      return `
        <button class="w-full text-left p-4 flex items-center gap-4 hover:bg-white/5 transition border-b border-white/10 last:border-b-0"
          data-id="${it.tmdb_id}" data-type="${it.media_type}">
          <div class="w-12 h-16 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
            ${poster ? `<img src="${poster}" class="w-full h-full object-cover" />` : `<div class="w-full h-full flex items-center justify-center text-xl">🎬</div>`}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold truncate">${esc(it.title)}</div>
            <div class="text-xs text-white/65 mt-0.5">${esc(it.year)} • <span class="chip px-2 py-0.5 rounded-full">${badge}</span></div>
          </div>
          <div class="text-white/60">›</div>
        </button>
      `;
    }).join("");
    searchResults.classList.remove("hidden");

    searchResults.querySelectorAll("button[data-id]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const tmdb_id = Number(btn.dataset.id);
        const media_type = btn.dataset.type;
        await showAddFlow(media_type, tmdb_id);
      });
    });
  }

  function clearSearchUI() {
    if (searchInput) searchInput.value = "";
    if (searchResults) searchResults.classList.add("hidden");
    if (searchResults) searchResults.innerHTML = "";
  }

  // Add flow + item modal
  async function showAddFlow(media_type, tmdb_id) {
    openModal(`
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold">Loading…</div>
          <button id="mClose" class="btn chip rounded-2xl px-3 py-1.5">Close</button>
        </div>
        <div class="text-sm text-white/70">Fetching details…</div>
      </div>
    `);
    document.getElementById("mClose").addEventListener("click", closeModal);

    let d;
    try {
      d = await getDetails(media_type, tmdb_id);
    } catch (e) {
      console.error(e);
      showToast("Failed to load details");
      return;
    }

    const poster = d.poster_url ? `<img src="${esc(d.poster_url)}" class="w-full h-full object-cover" />` :
      `<div class="w-full h-full flex items-center justify-center text-4xl">🎬</div>`;

    const tvControls = d.media_type === "tv" ? `
      <div class="glass rounded-2xl p-4 border border-white/10">
        <div class="flex items-center justify-between">
          <div class="font-semibold">TV Options</div>
          <div class="text-xs text-white/60">${d.seasons.length} seasons</div>
        </div>

        <div class="mt-3 flex flex-col md:flex-row gap-2">
          <button id="addSeriesBtn" class="btn rounded-2xl px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/25 border border-indigo-400/20">
            Add entire series
          </button>

          <select id="seasonSelect" class="rounded-2xl px-3 py-2 input flex-1">
            ${d.seasons.map(s => `<option value="${s.season_number}">Season ${s.season_number}${s.name ? ` • ${esc(s.name)}` : ""}</option>`).join("")}
          </select>

          <button id="loadSeasonBtn" class="btn chip rounded-2xl px-4 py-2">Pick episodes</button>
        </div>

        <div id="seasonPicker" class="hidden mt-4"></div>
      </div>
    ` : "";

    openModal(`
      <div class="space-y-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-xs uppercase tracking-[0.25em] text-white/60">${d.media_type === "tv" ? "TV" : "MOVIE"}</div>
            <div class="text-2xl font-semibold">${esc(d.title)} <span class="text-white/60 font-normal">(${esc(d.year)})</span></div>
            <div class="text-sm text-white/70 mt-1">${esc(d.runtime)} • ${esc(d.genre)}</div>
          </div>
          <button id="mClose" class="btn chip rounded-2xl px-3 py-1.5">Close</button>
        </div>

        <div class="grid md:grid-cols-[170px,1fr] gap-5">
          <div class="rounded-3xl overflow-hidden border border-white/10 bg-black/20 aspect-[2/3]">${poster}</div>

          <div class="space-y-4">
            <div class="glass rounded-2xl p-4 border border-white/10">
              <div class="text-sm text-white/70">Cast</div>
              <div class="text-sm mt-1">${esc(d.cast)}</div>
            </div>

            <div class="glass rounded-2xl p-4 border border-white/10">
              <div class="text-sm text-white/70">Overview</div>
              <div class="text-sm mt-1 leading-relaxed text-white/85">${esc(d.overview)}</div>
            </div>

            <div class="grid md:grid-cols-3 gap-3">
              <div>
                <label class="text-xs text-white/70">Format</label>
                <select id="format" class="mt-1 w-full rounded-2xl px-3 py-2 input">
                  ${["Blu-ray","DVD","Digital","4K Ultra HD","VHS"].map(v => `<option value="${v}" ${v==="Digital"?"selected":""}>${v}</option>`).join("")}
                </select>
              </div>
              <div>
                <label class="text-xs text-white/70">Rating</label>
                <input id="rating" type="range" min="0" max="10" step="0.5" value="0" class="mt-2 w-full" />
                <div class="text-xs text-white/70 mt-1"><span id="ratingLabel">0</span> • <span id="ratingStars"></span></div>
              </div>
              <div>
                <label class="text-xs text-white/70">Entry</label>
                <input class="mt-1 w-full rounded-2xl px-3 py-2 input" value="${d.media_type === "tv" ? "Series" : "Movie"}" disabled />
              </div>
            </div>

            <div>
              <label class="text-xs text-white/70">Comment</label>
              <textarea id="comment" rows="3" class="mt-1 w-full rounded-2xl px-3 py-2 input" placeholder="What did you think?"></textarea>
            </div>

            <div class="flex flex-col md:flex-row gap-2">
              <button id="saveTitleBtn" class="btn rounded-2xl px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-400/20">
                Save to library
              </button>
              <button id="cancelBtn" class="btn chip rounded-2xl px-4 py-2">Cancel</button>
            </div>
          </div>
        </div>

        ${tvControls}
      </div>
    `);

    document.getElementById("mClose").addEventListener("click", closeModal);
    document.getElementById("cancelBtn").addEventListener("click", closeModal);

    const ratingEl = document.getElementById("rating");
    const ratingLabel = document.getElementById("ratingLabel");
    const ratingStars = document.getElementById("ratingStars");
    const syncRating = () => {
      const v = Number(ratingEl.value);
      ratingLabel.textContent = v.toString();
      ratingStars.textContent = starsFromRating(v);
    };
    ratingEl.addEventListener("input", syncRating);
    syncRating();

    document.getElementById("saveTitleBtn").addEventListener("click", async () => {
      const format = document.getElementById("format").value;
      const rating = Number(document.getElementById("rating").value);
      const comment = document.getElementById("comment").value;

      const payload = {
        user_id: sessionUser.id,
        tmdb_id: d.tmdb_id,
        media_type: d.media_type,
        scope: "title",
        season_number: null,
        episode_number: null,
        title: d.title,
        year: d.year,
        poster_url: d.poster_url || null,
        backdrop_url: d.backdrop_url || null,
        ...(USE_RELEASE_DATE_COLUMN ? { release_date: d.release_date_full || null } : {}),
        format,
        rating,
        comment,
        genre: d.genre,
        cast_list: d.cast,
        overview: d.overview,
        runtime: d.runtime
      };

      const ok = await upsertItem(payload);
      if (ok) {
        closeModal();
        clearSearchUI();
      }
    });

    if (d.media_type === "tv") {
      const addSeriesBtn = document.getElementById("addSeriesBtn");
      const loadSeasonBtn = document.getElementById("loadSeasonBtn");
      const seasonSelect = document.getElementById("seasonSelect");
      const seasonPicker = document.getElementById("seasonPicker");

      addSeriesBtn?.addEventListener("click", () => document.getElementById("saveTitleBtn").click());

      loadSeasonBtn?.addEventListener("click", async () => {
        const season_number = Number(seasonSelect.value);
        seasonPicker.classList.remove("hidden");
        seasonPicker.innerHTML = `
          <div class="glass rounded-2xl p-4 border border-white/10">
            <div class="flex items-center justify-between">
              <div class="font-semibold">Season ${season_number}</div>
              <div id="episodesStatus" class="text-xs text-white/60">Loading episodes…</div>
            </div>
            <div class="mt-4 space-y-2" id="epList"></div>
          </div>
        `;
        seasonPicker.scrollIntoView({ behavior: "smooth", block: "start" });

        let episodes = [];
        try {
          episodes = await getSeasonEpisodes(d.tmdb_id, season_number);
          document.getElementById("episodesStatus").textContent = `${episodes.length} episodes`;
        } catch (e) {
          console.error(e);
          document.getElementById("episodesStatus").textContent = "Failed to load episodes";
          return;
        }

        const epList = document.getElementById("epList");
        epList.innerHTML =
          `<div class="flex flex-col md:flex-row md:items-center gap-2 mb-3">
            <button id="addSeasonBtn" class="btn rounded-2xl px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/25 border border-indigo-400/20">
              Add entire season ${season_number}
            </button>
            <div class="text-xs text-white/60">Or add individual episodes below.</div>
          </div>` +
          episodes.map(ep => {
            const still = ep.still_path
              ? `<img src="${esc(imgUrl(ep.still_path))}" class="w-14 h-10 object-cover rounded-xl border border-white/10" />`
              : `<div class="w-14 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">🎞️</div>`;
            return `
              <div class="glass rounded-2xl p-3 border border-white/10 flex items-center gap-3">
                ${still}
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold truncate">E${ep.episode_number} • ${esc(ep.name)}</div>
                  <div class="text-xs text-white/60 truncate">${esc(ep.air_date || "")}</div>
                </div>
                <button class="btn chip rounded-2xl px-3 py-1.5 text-sm" data-add-ep="${ep.episode_number}">Add</button>
              </div>
            `;
          }).join("");

        document.getElementById("addSeasonBtn").addEventListener("click", async () => {
          const format = document.getElementById("format").value;
          const rating = Number(document.getElementById("rating").value);
          const comment = document.getElementById("comment").value;

          const payload = {
            user_id: sessionUser.id,
            tmdb_id: d.tmdb_id,
            media_type: "tv",
            scope: "season",
            season_number,
            episode_number: null,
            title: d.title,
            year: d.year,
            poster_url: d.poster_url || null,
            backdrop_url: d.backdrop_url || null,
            ...(USE_RELEASE_DATE_COLUMN ? { release_date: d.release_date_full || null } : {}),
            format,
            rating,
            comment,
            genre: d.genre,
            cast_list: d.cast,
            overview: d.overview,
            runtime: d.runtime
          };
          const ok = await upsertItem(payload);
          if (ok) {
            // keep modal open for more adds
          }
        });

        epList.querySelectorAll("button[data-add-ep]").forEach(b => {
          b.addEventListener("click", async () => {
            const episode_number = Number(b.dataset.addEp);
            const format = document.getElementById("format").value;
            const rating = Number(document.getElementById("rating").value);
            const comment = document.getElementById("comment").value;
            const ep = episodes.find(e => e.episode_number === episode_number);

            const payload = {
              user_id: sessionUser.id,
              tmdb_id: d.tmdb_id,
              media_type: "tv",
              scope: "episode",
              season_number,
              episode_number,
              title: d.title,
              year: d.year,
              poster_url: d.poster_url || null,
              backdrop_url: d.backdrop_url || null,
              ...(USE_RELEASE_DATE_COLUMN ? { release_date: d.release_date_full || null } : {}),
              format,
              rating,
              comment,
              genre: d.genre,
              cast_list: d.cast,
              overview: ep?.overview || d.overview,
              runtime: ep?.runtime ? `${ep.runtime} min` : d.runtime
            };
            const ok = await upsertItem(payload);
            if (ok) {
              // keep picker visible
            }
          });
        });
      });
    }
  }

  async function setItemCollections(rowId, selectedSet) {
    if (!(await detectCollections())) return;
    const current = collectionItems.get(rowId) || new Set();
    const toAdd = [...selectedSet].filter(id => !current.has(id));
    const toRemove = [...current].filter(id => !selectedSet.has(id));

    if (toRemove.length) {
      await supabase.from("collection_items").delete().in("collection_id", toRemove).eq("media_item_id", rowId).eq("user_id", sessionUser.id);
    }
    if (toAdd.length) {
      const rows = toAdd.map(cid => ({ user_id: sessionUser.id, collection_id: cid, media_item_id: rowId }));
      await supabase.from("collection_items").insert(rows);
    }
    await loadCollections();
    renderLibrary();
  }

  function showItemModal(row) {
    const titleLine =
      row.scope === "title" ? row.title :
      row.scope === "season" ? `${row.title} • Season ${row.season_number}` :
      `${row.title} • S${row.season_number}E${row.episode_number}`;

    const poster = row.poster_url
      ? `<img src="${esc(row.poster_url)}" class="w-full h-full object-cover" />`
      : `<div class="w-full h-full flex items-center justify-center text-4xl">🎬</div>`;

    const ratingVal = (row.rating ?? 0);

    const collectionsSection = (collectionsAvailable && collections.length) ? `
      <div class="glass rounded-2xl p-4 border border-white/10">
        <div class="flex items-center justify-between">
          <div class="font-semibold">Collections</div>
          <div class="text-xs text-white/60">Select to add/remove</div>
        </div>
        <div class="mt-3 space-y-2" id="colChecks">
          ${collections.map(c => {
            const set = collectionItems.get(row.id) || new Set();
            const checked = set.has(c.id) ? "checked" : "";
            return `
              <label class="flex items-center gap-3 text-sm">
                <input type="checkbox" class="h-4 w-4" data-col="${c.id}" ${checked} />
                <span>${esc(c.name)}</span>
              </label>
            `;
          }).join("")}
        </div>
      </div>
    ` : `
      <div class="glass rounded-2xl p-4 border border-white/10">
        <div class="font-semibold">Collections</div>
        <div class="text-sm text-white/70 mt-1">Run supabase_collections.sql to enable collections.</div>
      </div>
    `;

    openModal(`
      <div class="space-y-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-xs uppercase tracking-[0.25em] text-white/60">${row.media_type === "tv" ? "TV" : "MOVIE"} • ${row.scope.toUpperCase()}</div>
            <div class="text-2xl font-semibold">${esc(titleLine)}</div>
            <div class="text-sm text-white/70 mt-1">${esc(row.year || "")} • ${esc(row.runtime || "—")} • ${esc(row.genre || "—")}</div>
          </div>
          <button id="mClose" class="btn chip rounded-2xl px-3 py-1.5">Close</button>
        </div>

        <div class="grid md:grid-cols-[170px,1fr] gap-5">
          <div class="rounded-3xl overflow-hidden border border-white/10 bg-black/20 aspect-[2/3]">${poster}</div>

          <div class="space-y-4">
            <div class="glass rounded-2xl p-4 border border-white/10">
              <div class="text-sm text-white/70">Overview</div>
              <div class="text-sm mt-1 leading-relaxed text-white/85">${esc(row.overview || "—")}</div>
            </div>

            <div class="grid md:grid-cols-3 gap-3">
              <div>
                <label class="text-xs text-white/70">Format</label>
                <select id="eFormat" class="mt-1 w-full rounded-2xl px-3 py-2 input">
                  ${["Blu-ray","DVD","Digital","4K Ultra HD","VHS"].map(v => `<option value="${v}" ${v===(row.format||"Digital")?"selected":""}>${v}</option>`).join("")}
                </select>
              </div>
              <div>
                <label class="text-xs text-white/70">Rating</label>
                <input id="eRating" type="range" min="0" max="10" step="0.5" value="${ratingVal}" class="mt-2 w-full" />
                <div class="text-xs text-white/70 mt-1"><span id="eRatingLabel">${ratingVal}</span> • <span id="eRatingStars">${starsFromRating(ratingVal)}</span></div>
              </div>
              <div>
                <label class="text-xs text-white/70">Entry</label>
                <input class="mt-1 w-full rounded-2xl px-3 py-2 input" value="${row.scope}" disabled />
              </div>
            </div>

            <div>
              <label class="text-xs text-white/70">Comment</label>
              <textarea id="eComment" rows="3" class="mt-1 w-full rounded-2xl px-3 py-2 input" placeholder="Add your notes…">${esc(row.comment || "")}</textarea>
            </div>

            ${collectionsSection}

            <div class="flex flex-col md:flex-row gap-2">
              <button id="saveBtn" class="btn rounded-2xl px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-400/20">
                Save changes
              </button>
              <button id="delBtn" class="btn rounded-2xl px-4 py-2 bg-red-500/15 hover:bg-red-500/20 border border-red-400/20">
                Remove
              </button>
              <button id="cancelBtn" class="btn chip rounded-2xl px-4 py-2">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `);

    document.getElementById("mClose").addEventListener("click", closeModal);
    document.getElementById("cancelBtn").addEventListener("click", closeModal);

    const eRating = document.getElementById("eRating");
    const eRatingLabel = document.getElementById("eRatingLabel");
    const eRatingStars = document.getElementById("eRatingStars");
    const syncERating = () => {
      const v = Number(eRating.value);
      eRatingLabel.textContent = v.toString();
      eRatingStars.textContent = starsFromRating(v);
    };
    eRating.addEventListener("input", syncERating);
    syncERating();

    document.getElementById("saveBtn").addEventListener("click", async () => {
      const format = document.getElementById("eFormat").value;
      const rating = Number(document.getElementById("eRating").value);
      const comment = document.getElementById("eComment").value;

      const { error } = await supabase
        .from("media_items")
        .update({ format, rating, comment })
        .eq("id", row.id);

      if (error) {
        console.error(error);
        showToast("Save failed");
        return;
      }

      // collections checkbox save
      if (await detectCollections()) {
        const selected = new Set();
        document.querySelectorAll("#colChecks input[data-col]").forEach(cb => {
          if (cb.checked) selected.add(cb.dataset.col);
        });
        await setItemCollections(row.id, selected);
      } else {
        await loadLibrary();
      }
      showToast("Saved");
      closeModal();
    });

    document.getElementById("delBtn").addEventListener("click", async () => {
      await deleteItem(row.id);
      closeModal();
    });
  }

  // Auth
  async function refreshSessionUI() {
    const { data } = await supabase.auth.getSession();
    sessionUser = data.session?.user || null;

    if (!sessionUser) {
      authPanel.classList.remove("hidden");
      appPanel.classList.add("hidden");
      profileBtn.classList.add("hidden");
      closeProfileMenu();
      return;
    }

    authPanel.classList.add("hidden");
    appPanel.classList.remove("hidden");
    profileBtn.classList.remove("hidden");
    profileEmail.textContent = sessionUser.email || "Signed in";
    closeProfileMenu();
    await loadLibrary();
  }

  // More reliable mobile sign-in: wait for SIGNED_IN event
  async function waitForSignedIn(timeoutMs = 2500) {
    return new Promise((resolve) => {
      const start = Date.now();
      const sub = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          sub.data.subscription.unsubscribe();
          resolve(true);
        }
      });
      const t = setInterval(async () => {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          clearInterval(t);
          sub.data.subscription.unsubscribe();
          resolve(true);
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(t);
          sub.data.subscription.unsubscribe();
          resolve(false);
        }
      }, 250);
    });
  }

  signInBtn.addEventListener("click", async () => {
    authMsg.textContent = "";
    const email = (authEmail.value || "").trim();
    const password = authPassword.value || "";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      authMsg.textContent = error.message;
      return;
    }
    const ok = await waitForSignedIn();
    if (!ok) {
      authMsg.textContent = "Signed in, but session is taking a moment… try again.";
      return;
    }
    await refreshSessionUI();
  });

  signUpBtn.addEventListener("click", async () => {
    authMsg.textContent = "";
    const email = (authEmail.value || "").trim();
    const password = authPassword.value || "";
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      authMsg.textContent = error.message;
      return;
    }
    authMsg.textContent = "Account created. If you receive a confirmation email, confirm it then sign in.";
    showToast("Account created");
  });

  // Profile interactions
  profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleProfileMenu();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#profileMenu") && !e.target.closest("#profileBtn")) closeProfileMenu();
  });
  profileLogout.addEventListener("click", async () => {
    closeProfileMenu();
    await supabase.auth.signOut();
    showToast("Logged out");
    await refreshSessionUI();
  });
  collectionsBtn.addEventListener("click", async () => {
    closeProfileMenu();
    await openCollectionsManager();
  });

  supabase.auth.onAuthStateChange(() => {
    refreshSessionUI();
  });

  // Search controls
  function setSearchType(t) {
    searchType = t;
    btnActive(typeAll, t === "all");
    btnActive(typeMovie, t === "movie");
    btnActive(typeTv, t === "tv");
  }
  typeAll.addEventListener("click", () => setSearchType("all"));
  typeMovie.addEventListener("click", () => setSearchType("movie"));
  typeTv.addEventListener("click", () => setSearchType("tv"));
  setSearchType("all");

  async function doSearch() {
    const q = (searchInput.value || "").trim();
    if (!q) return;
    searchBtn.disabled = true;
    searchBtn.textContent = "Searching…";
    try {
      const results = await searchTMDB(q);
      renderSearchResults(results);
    } catch (e) {
      console.error(e);
      showToast("Search failed");
    } finally {
      searchBtn.disabled = false;
      searchBtn.textContent = "Search";
    }
  }
  searchBtn.addEventListener("click", doSearch);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  // Filter events
  [filterCollection, filterScope, filterMediaType, filterFormat, sortBy, minRating].forEach(el => el.addEventListener("change", renderLibrary));
  librarySearch.addEventListener("input", () => requestAnimationFrame(renderLibrary));

  // View mode
  viewGridBtn.addEventListener("click", () => setView("grid"));
  viewListBtn.addEventListener("click", () => setView("list"));
  setView(viewMode);

  // PWA: register service worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  // Boot
  refreshSessionUI();
})();
