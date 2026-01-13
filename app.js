/* NexaVault Media Catalog — stable build (v21)
   - GitHub Pages + PWA
   - Supabase Auth + DB
   - TMDB search/details
*/
(() => {
  // =========================
  // ✅ CONFIG (EDIT THESE)
  // =========================
  const SUPABASE_URL = "https://zmljybyharvunwctxbwp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptbGp5YnloYXJ2dW53Y3R4YndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MDQ5NDgsImV4cCI6MjA4MzM4MDk0OH0.h6TW7xX4B4y8D-yBL6-WqnhYWo0MqFAAP14lzXmXyrg";
  const TMDB_API_KEY = "cc4e1c1296a271801dd38dd0c5742ec3";
  // If you added a `release_date` column to media_items (text or date), set true:
  const USE_RELEASE_DATE_COLUMN = false;
  // =========================

  const TMDB_BASE = "https://api.themoviedb.org/3";
  const TMDB_IMG_500 = "https://image.tmdb.org/t/p/w500";
  const TMDB_IMG_ORIG = "https://image.tmdb.org/t/p/original";

  // ---- UI refs
  const authPanel = document.getElementById("authPanel");
  const appPanel = document.getElementById("appPanel");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const authMsg = document.getElementById("authMsg");
  const signInBtn = document.getElementById("signInBtn");
  const signUpBtn = document.getElementById("signUpBtn");

  const forgotPwBtn = document.getElementById("forgotPwBtn");

  const profileBtn = document.getElementById("profileBtn");
  const profileMenu = document.getElementById("profileMenu");
  const profileEmail = document.getElementById("profileEmail");
  const profileLogout = document.getElementById("profileLogout");

  const typeAll = document.getElementById("typeAll");
  const typeMovie = document.getElementById("typeMovie");
  const typeTv = document.getElementById("typeTv");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const searchResults = document.getElementById("searchResults");

  const filterScope = document.getElementById("filterScope");
  const filterMediaType = document.getElementById("filterMediaType");
  const filterFormat = document.getElementById("filterFormat");
  const librarySearch = document.getElementById("librarySearch");
  const sortBy = document.getElementById("sortBy");
  const minRating = document.getElementById("minRating");
  const filterGenre = document.getElementById("filterGenre");
  const groupBy = document.getElementById("groupBy");
  const statsText = document.getElementById("statsText");

  const grid = document.getElementById("grid");
  const emptyState = document.getElementById("emptyState");

  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modalBody");
  const toast = document.getElementById("toast");

  const filtersToggle = document.getElementById("filtersToggle");
  const filtersPanel = document.getElementById("filtersPanel");
  const filtersToggleIcon = document.getElementById("filtersToggleIcon");

  // ---- Helpers
  const esc = (s) =>
    (s ?? "").toString().replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));

function parseHashParams() {
  // Supabase sends recovery tokens in URL hash like:
  // #access_token=...&refresh_token=...&type=recovery
  const hash = (window.location.hash || "").replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const obj = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}

function clearUrlHash() {
  if (window.location.hash) {
    history.replaceState(null, document.title, window.location.pathname + window.location.search);
  }
}


  function showToast(message) {
    if (!toast) return;
    toast.classList.remove("hidden");
    toast.querySelector("div").textContent = message;
    setTimeout(() => toast.classList.add("hidden"), 2600);
  }

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
    // reset scroll to top of modal content
    modalBody.scrollTop = 0;
  }
  function closeModal() {
    modal.classList.add("hidden");
    modalBody.innerHTML = "";
    unlockBodyScroll();
  }
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  function closeProfileMenu() { profileMenu?.classList.add("hidden"); }
  function toggleProfileMenu() { profileMenu?.classList.toggle("hidden"); }

  function imgUrl(path, size="w500") {
    if (!path) return null;
    if (size === "orig") return `${TMDB_IMG_ORIG}${path}`;
    return `${TMDB_IMG_500}${path}`;
  }

  // ---- Guard for config corruption
  function configLooksBad() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return true;
    // users sometimes paste 'eyJ...xyz' which breaks auth
    if (SUPABASE_ANON_KEY.includes("...")) return true;
    return false;
  }

  // ---- Supabase client
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  // ---- State
  let sessionUser = null;
  let library = [];
  let searchType = "all";

  // ---- TMDB
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
      .filter(r => {
        if (searchType === "all") return r.media_type === "movie" || r.media_type === "tv";
        return r.media_type === searchType;
      })
      .map(r => ({
        tmdb_id: r.id,
        media_type: r.media_type,
        title: r.media_type === "movie" ? r.title : r.name,
        year: ((r.media_type === "movie" ? r.release_date : r.first_air_date) || "").split("-")[0] || "",
        release_date_full: (r.media_type === "movie" ? (r.release_date||"") : (r.first_air_date||"")),
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
    const runtime =
      media_type === "movie"
        ? (d.runtime ? `${d.runtime} min` : "—")
        : (d.episode_run_time?.[0] ? `${d.episode_run_time[0]} min` : "—");

    return {
      tmdb_id: d.id,
      media_type,
      title: media_type === "movie" ? d.title : d.name,
      year: ((media_type === "movie" ? d.release_date : d.first_air_date) || "").split("-")[0] || "",
      release_date_full: (media_type === "movie" ? (d.release_date||"") : (d.first_air_date||"")),
      poster_url: imgUrl(d.poster_path),
      backdrop_url: imgUrl(d.backdrop_path, "orig"),
      overview: d.overview || "No overview available.",
      cast: cast || "—",
      genre: genres || "—",
      runtime,
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

  // ---- DB ops
  async function loadLibrary() {
    if (!sessionUser) return;
    const { data, error } = await supabase
      .from("media_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      showToast("Failed to load library");
      return;
    }
    library = data || [];
    updateGenreFilterOptions();
    renderLibrary();
  }

  async function tryUpsert(payload) {
    // Schema-resilient upsert: retry if column mismatch
    const attempts = [];

    // base attempt
    attempts.push(payload);

    // if payload has cast_list, try cast instead
    if ("cast_list" in payload) {
      const p = { ...payload };
      p.cast = p.cast_list;
      delete p.cast_list;
      attempts.push(p);
    }
    // if payload has cast, try cast_list instead
    if ("cast" in payload) {
      const p = { ...payload };
      p.cast_list = p.cast;
      delete p.cast;
      attempts.push(p);
    }
    // if release_date might break, try without it
    if ("release_date" in payload) {
      const p = { ...payload };
      delete p.release_date;
      attempts.push(p);
    }

    for (const p of attempts) {
      const { error } = await supabase.from("media_items").upsert(p, {
        onConflict: "user_id,tmdb_id,media_type,scope,season_number,episode_number"
      });
      if (!error) return true;
      console.error(error);
      // continue trying alternatives
    }
    return false;
  }

  async function upsertItem(payload) {
    const ok = await tryUpsert(payload);
    if (!ok) {
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

// ---- Filters + sorting
function splitGenres(genreStr) {
  return (genreStr || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function updateGenreFilterOptions() {
  if (!filterGenre) return;
  const selected = filterGenre.value || "all";

  const set = new Set();
  (library || []).forEach(row => splitGenres(row.genre).forEach(g => set.add(g)));
  const genres = Array.from(set).sort((a, b) => a.localeCompare(b));

  // Rebuild options safely (no HTML encoding problems in values)
  filterGenre.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "All genres";
  filterGenre.appendChild(optAll);

  genres.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    filterGenre.appendChild(opt);
  });

  const stillValid = selected === "all" || genres.includes(selected);
  filterGenre.value = stillValid ? selected : "all";
}

function getGroupKey(row, mode) {
  switch (mode) {
    case "genre": {
      const gs = splitGenres(row.genre);
      return gs[0] || "Unknown genre";
    }
    case "format":
      return (row.format || "Digital") || "Digital";
    case "media_type":
      return row.media_type === "tv" ? "TV" : "Movies";
    case "scope":
      return row.scope ? row.scope.charAt(0).toUpperCase() + row.scope.slice(1) : "Unknown";
    case "year":
      return row.year ? row.year.toString() : "Unknown year";
    case "rating_bucket": {
      const v = (row.rating === null || row.rating === undefined || row.rating === "") ? null : Number(row.rating);
      if (v === null || !Number.isFinite(v)) return "Unrated";
      if (v >= 9) return "⭐ 9–10";
      if (v >= 8) return "⭐ 8–8.9";
      if (v >= 7) return "⭐ 7–7.9";
      if (v >= 6) return "⭐ 6–6.9";
      if (v >= 5) return "⭐ 5–5.9";
      return "⭐ <5";
    }
    default:
      return "";
  }
}

  function libraryFiltersMatch(row) {
    const scopeOk = (filterScope?.value || "all") === "all" || row.scope === filterScope.value;
    const typeOk = (filterMediaType?.value || "all") === "all" || row.media_type === filterMediaType.value;
    const formatOk = (filterFormat?.value || "all") === "all" || (row.format || "Digital") === filterFormat.value;

    const genreSel = (filterGenre?.value || "all");
    const genreOk = genreSel === "all" || splitGenres(row.genre).some(g => g.toLowerCase() === genreSel.toLowerCase());

    const minR = Number(minRating?.value || 0);
    const rv = row.rating === null || row.rating === undefined || row.rating === "" ? null : Number(row.rating);
    const ratingOk = minR === 0 || (rv !== null && rv >= minR);

    const q = (librarySearch?.value || "").trim().toLowerCase();
    const hay = [
      row.title,
      row.comment,
      row.genre,
      row.cast_list || row.cast,
      row.overview,
      row.year,
      row.format
    ].map(v => (v || "").toString().toLowerCase());
    const searchOk = !q || hay.some(v => v.includes(q));

    return scopeOk && typeOk && formatOk && genreOk && ratingOk && searchOk;
  }

  function sortLibraryRows(rows) {
    const mode = (sortBy?.value || "added_desc");
    const parseYear = (y) => {
      const n = parseInt((y||"").toString().slice(0,4), 10);
      return Number.isFinite(n) ? n : 0;
    };
    const ratingNum = (r) => {
      const v = r.rating;
      if (v === null || v === undefined || v === "") return -1;
      const n = Number(v);
      return Number.isFinite(n) ? n : -1;
    };
    const dateNum = (r) => {
      const d = (r.release_date || "").toString();
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return Date.parse(d) || 0;
      return parseYear(r.year) * 365 * 24 * 3600 * 1000;
    };
    const out = [...rows];
    out.sort((a,b) => {
      switch(mode) {
        case "added_asc": return (new Date(a.created_at).getTime()||0) - (new Date(b.created_at).getTime()||0);
        case "release_desc": return dateNum(b) - dateNum(a);
        case "release_asc": return dateNum(a) - dateNum(b);
        case "rating_desc": return ratingNum(b) - ratingNum(a);
        case "rating_asc": return ratingNum(a) - ratingNum(b);
        case "title_desc": return (b.title||"").localeCompare(a.title||"");
        case "title_asc":
        default: return (a.title||"").localeCompare(b.title||"");
      }
    });
    return out;
  }

  function renderLibrary() {
  const groupMode = (groupBy?.value || "none");
  const grouped = groupMode !== "none";

  const filtered = sortLibraryRows((library || []).filter(libraryFiltersMatch));
  if (statsText) statsText.textContent = `${filtered.length} item${filtered.length===1?"":"s"} (of ${library.length})`;

  if (!filtered.length) {
    grid.innerHTML = "";
    emptyState?.classList.remove("hidden");
    // reset grid layout
    grid.className = "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5";
    return;
  }
  emptyState?.classList.add("hidden");

  const cardHtml = (row) => {
    const poster = row.poster_url || "";
    const scopeLabel =
      row.scope === "season" ? `Season ${row.season_number}` :
      row.scope === "episode" ? `S${row.season_number}E${row.episode_number}` :
      "Title";

    const subtitle =
      row.scope === "title" ? "" :
      `<div class="text-xs text-white/60 mt-1 truncate">${esc(scopeLabel)}</div>`;

    const rating = (row.rating ?? null);
    return `
      <button class="poster-card rounded-2xl overflow-hidden text-left" data-rowid="${row.id}">
        <div class="relative">
          <div class="aspect-[2/3] bg-black/25">
            ${poster ? `<img src="${esc(poster)}" class="w-full h-full object-cover" loading="lazy" />`
                      : `<div class="w-full h-full flex items-center justify-center text-3xl">🎬</div>`}
          </div>
          <div class="absolute top-2 left-2 chip px-2 py-1 rounded-xl text-xs">${row.media_type==="tv"?"📺":"🎬"} ${esc(scopeLabel)}</div>
          ${rating !== null && rating !== undefined && rating !== "" ? `<div class="absolute top-2 right-2 chip px-2 py-1 rounded-xl text-xs">⭐ ${rating}/10</div>` : ""}
        </div>
        <div class="p-3">
          <div class="font-semibold text-sm truncate">${esc(row.title)}</div>
          ${subtitle}
          <div class="text-xs text-white/65 mt-2 flex items-center justify-between gap-2">
            <span class="truncate">${esc(row.year || "")}</span>
            <span class="chip px-2 py-0.5 rounded-full">${esc(row.format || "Digital")}</span>
          </div>
        </div>
      </button>
    `;
  };

  if (!grouped) {
    // grid layout
    grid.className = "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5";
    grid.innerHTML = filtered.map(cardHtml).join("");
  } else {
    // section layout
    grid.className = "space-y-6";

    const groups = new Map();
    filtered.forEach(row => {
      const key = getGroupKey(row, groupMode) || "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    // sort group keys
    const keys = Array.from(groups.keys()).sort((a,b) => a.localeCompare(b));

    grid.innerHTML = keys.map((key, idx) => {
      const rows = groups.get(key) || [];
      const inner = rows.map(cardHtml).join("");
      return `
        <div class="glass rounded-3xl p-4 border border-white/10">
          <button type="button" class="w-full flex items-center justify-between gap-3 btn" data-group-toggle="${idx}">
            <div class="text-left">
              <div class="text-sm font-semibold">${esc(key)}</div>
              <div class="text-xs text-white/60">${rows.length} item${rows.length===1?"":"s"}</div>
            </div>
            <div class="text-white/60" data-group-icon="${idx}">▾</div>
          </button>
          <div class="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5" data-group-panel="${idx}">
            ${inner}
          </div>
        </div>
      `;
    }).join("");
  }

  // Card click handlers
  [...grid.querySelectorAll("button[data-rowid]")].forEach(card => {
    card.addEventListener("click", () => {
      const rowId = Number(card.dataset.rowid);
      const row = library.find(r => r.id === rowId);
      if (row) showItemModal(row);
    });
  });

  // Group collapse toggles (works on all screens, handy on mobile)
  [...grid.querySelectorAll("button[data-group-toggle]")].forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.groupToggle;
      const panel = grid.querySelector(`[data-group-panel="${id}"]`);
      const icon = grid.querySelector(`[data-group-icon="${id}"]`);
      if (!panel) return;
      panel.classList.toggle("hidden");
      if (icon) icon.textContent = panel.classList.contains("hidden") ? "▸" : "▾";
    });
  });
}


  // ---- Modals: view/edit item
  function showItemModal(row) {
    const titleLine =
      row.scope === "season" ? `${row.title} • Season ${row.season_number}` :
      row.scope === "episode" ? `${row.title} • S${row.season_number}E${row.episode_number}` :
      row.title;

    const poster = row.poster_url
      ? `<img src="${esc(row.poster_url)}" class="w-full h-full object-cover" />`
      : `<div class="w-full h-full flex items-center justify-center text-4xl">🎬</div>`;

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

            <div class="glass rounded-2xl p-4 border border-white/10">
              <div class="text-sm text-white/70">Cast</div>
              <div class="text-sm mt-1">${esc((row.cast_list || row.cast) || "—")}</div>
            </div>

            <div class="grid md:grid-cols-3 gap-3">
              <div>
                <label class="text-xs text-white/70">Format</label>
                <select id="eFormat" class="mt-1 w-full rounded-2xl px-3 py-2 input">
                  ${["Blu-ray","DVD","Digital","4K Ultra HD","VHS"].map(v => `<option value="${v}" ${v===(row.format||"Digital")?"selected":""}>${v}</option>`).join("")}
                </select>
              </div>
              <div>
                <label class="text-xs text-white/70">Rating (0-10)</label>
                <input id="eRating" type="number" min="0" max="10" step="0.5" value="${row.rating ?? ""}" class="mt-1 w-full rounded-2xl px-3 py-2 input" />
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

    document.getElementById("saveBtn").addEventListener("click", async () => {
      const format = document.getElementById("eFormat").value;
      const ratingRaw = document.getElementById("eRating").value;
      const rating = ratingRaw === "" ? null : Number(ratingRaw);
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

      await loadLibrary();
      showToast("Saved");
      closeModal();
    });

    document.getElementById("delBtn").addEventListener("click", async () => {
      await deleteItem(row.id);
      closeModal();
    });
  }

  // ---- Add flow
  async function showAddFlow(media_type, tmdb_id) {
    openModal(`
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold">Loading…</div>
          <button id="mClose" class="btn chip rounded-2xl px-3 py-1.5">Close</button>
        </div>
        <div class="text-sm text-white/70">Fetching details from TMDB…</div>
      </div>
    `);
    document.getElementById("mClose").addEventListener("click", closeModal);

    let d;
    try {
      d = await getDetails(media_type, tmdb_id);
    } catch (e) {
      console.error(e);
      openModal(`<div class="space-y-3"><div class="text-lg font-semibold">Couldn’t load details</div><div class="text-sm text-white/70">TMDB request failed.</div><button id="mClose" class="btn chip rounded-2xl px-3 py-2">Close</button></div>`);
      document.getElementById("mClose").addEventListener("click", closeModal);
      return;
    }

    const poster = d.poster_url
      ? `<img src="${esc(d.poster_url)}" class="w-full h-full object-cover" />`
      : `<div class="w-full h-full flex items-center justify-center text-4xl">🎬</div>`;

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

        <div id="seasonPicker" class="hidden mt-4">
          <div class="text-sm text-white/70" id="episodesStatus">Pick a season and load episodes.</div>
        </div>
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
                <label class="text-xs text-white/70">Rating (0-10)</label>
                <input id="rating" type="number" min="0" max="10" step="0.5" value="" class="mt-1 w-full rounded-2xl px-3 py-2 input" />
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

    const buildCommon = () => {
      const format = document.getElementById("format").value;
      const ratingRaw = document.getElementById("rating").value;
      const rating = ratingRaw === "" ? null : Number(ratingRaw);
      const comment = document.getElementById("comment").value;
      const releasePart = USE_RELEASE_DATE_COLUMN ? { release_date: d.release_date_full || null } : {};
      return { format, rating, comment, releasePart };
    };

    document.getElementById("saveTitleBtn").addEventListener("click", async () => {
      const { format, rating, comment, releasePart } = buildCommon();
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
        ...releasePart,
        format,
        rating,
        comment,
        genre: d.genre,
        cast_list: d.cast,
        overview: d.overview,
        runtime: d.runtime
      };
      const ok = await upsertItem(payload);
      if (ok) closeModal();
    });

    if (d.media_type === "tv") {
      const addSeriesBtn = document.getElementById("addSeriesBtn");
      const loadSeasonBtn = document.getElementById("loadSeasonBtn");
      const seasonSelect = document.getElementById("seasonSelect");
      const seasonPicker = document.getElementById("seasonPicker");

      addSeriesBtn.addEventListener("click", () => document.getElementById("saveTitleBtn").click());

      loadSeasonBtn.addEventListener("click", async () => {
        const season_number = Number(seasonSelect.value);
        seasonPicker.classList.remove("hidden");
        // scroll into view within modal
        seasonPicker.scrollIntoView({ behavior: "smooth", block: "start" });
        const status = document.getElementById("episodesStatus");
        status.textContent = "Loading episodes…";

        let episodes = [];
        try {
          episodes = await getSeasonEpisodes(d.tmdb_id, season_number);
        } catch (e) {
          console.error(e);
          status.textContent = "Failed to load episodes.";
          return;
        }

        const listHtml = `
          <div class="mt-3 glass rounded-2xl p-4 border border-white/10">
            <div class="flex items-center justify-between">
              <div class="font-semibold">Season ${season_number}</div>
              <button id="hidePicker" class="btn chip rounded-2xl px-3 py-1.5 text-sm">Hide</button>
            </div>

            <div class="mt-3 flex flex-col md:flex-row md:items-center gap-2">
              <button id="addSeasonBtn" class="btn rounded-2xl px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/25 border border-indigo-400/20">
                Add entire season ${season_number}
              </button>
              <div class="text-xs text-white/60">Or add individual episodes below.</div>
            </div>

            <div id="epList" class="mt-3 space-y-2" style="max-height: 50vh; overflow-y:auto; -webkit-overflow-scrolling: touch;"></div>
          </div>
        `;

        seasonPicker.innerHTML = `<div class="text-sm text-white/70" id="episodesStatus"></div>${listHtml}`;
        document.getElementById("hidePicker").addEventListener("click", () => seasonPicker.classList.add("hidden"));

        const epList = document.getElementById("epList");
        epList.innerHTML = episodes.map(ep => {
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
          const { format, rating, comment, releasePart } = buildCommon();
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
            ...releasePart,
            format,
            rating,
            comment,
            genre: d.genre,
            cast_list: d.cast,
            overview: d.overview,
            runtime: d.runtime
          };
          await upsertItem(payload);
        });

        [...epList.querySelectorAll("button[data-add-ep]")].forEach(btn => {
          btn.addEventListener("click", async () => {
            const episode_number = Number(btn.dataset.addEp);
            const ep = episodes.find(e => e.episode_number === episode_number);
            const { format, rating, comment, releasePart } = buildCommon();

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
              ...releasePart,
              format,
              rating,
              comment,
              genre: d.genre,
              cast_list: d.cast,
              overview: ep?.overview || d.overview,
              runtime: ep?.runtime ? `${ep.runtime} min` : d.runtime
            };
            await upsertItem(payload);
          });
        });
      });
    }
  }

  // ---- Search UI
  function setSearchType(t) {
    searchType = t;
    // visual
    const active = (el, on) => {
      if (!el) return;
      el.classList.toggle("bg-white/10", on);
      el.classList.toggle("border-white/15", on);
    };
    active(typeAll, t==="all");
    active(typeMovie, t==="movie");
    active(typeTv, t==="tv");
  }
  typeAll?.addEventListener("click", () => setSearchType("all"));
  typeMovie?.addEventListener("click", () => setSearchType("movie"));
  typeTv?.addEventListener("click", () => setSearchType("tv"));
  setSearchType("all");

  async function doSearch() {
    const q = (searchInput?.value || "").trim();
    if (!q) return;
    searchBtn.disabled = true;
    searchBtn.textContent = "Searching…";
    try {
      const items = await searchTMDB(q);
      renderSearchResults(items);
    } catch (e) {
      console.error(e);
      showToast("Search failed");
    } finally {
      searchBtn.disabled = false;
      searchBtn.textContent = "Search";
    }
  }
  searchBtn?.addEventListener("click", doSearch);
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  function renderSearchResults(items) {
    if (!searchResults) return;
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
            ${it.overview ? `<div class="text-xs text-white/60 mt-1 line-clamp-2">${esc(it.overview)}</div>` : ""}
          </div>
          <div class="text-white/60">›</div>
        </button>
      `;
    }).join("");
    searchResults.classList.remove("hidden");
    [...searchResults.querySelectorAll("button[data-id]")].forEach(btn => {
      btn.addEventListener("click", async () => {
        const tmdb_id = Number(btn.dataset.id);
        const media_type = btn.dataset.type;
        await showAddFlow(media_type, tmdb_id);
      });
    });
  }

  // ---- Auth
async function sendPasswordRecoveryEmail(email) {
  const cleanEmail = (email || "").trim();
  if (!cleanEmail) {
    showToast("Enter your email");
    return;
  }

  // For GitHub Pages, include the full path (repo) in redirect URL
  const redirectTo = window.location.origin + window.location.pathname;

  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
  if (error) {
    console.error(error);
    showToast(error.message || "Could not send reset email");
    return;
  }
  showToast("Reset email sent");
  authMsg.textContent = "Password reset link sent. Check your inbox (and spam).";
  closeModal();
}

function showPasswordRecoveryRequestModal() {
  const preset = (authEmail?.value || "").trim();
  openModal(`
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="text-lg font-semibold">Reset your password</div>
        <button id="mClose" class="btn chip rounded-2xl px-3 py-1.5">Close</button>
      </div>

      <div class="text-sm text-white/70">
        Enter the email you used for this account. We’ll send a secure reset link.
      </div>

      <input id="pwResetEmail" type="email" value="${esc(preset)}" placeholder="Email"
        class="w-full rounded-2xl px-4 py-3 input" />

      <button id="pwResetSend" class="btn w-full rounded-2xl px-4 py-3 bg-indigo-500/20 hover:bg-indigo-500/25 border border-indigo-400/20">
        Send reset link
      </button>
    </div>
  `);

  document.getElementById("mClose").addEventListener("click", closeModal);
  document.getElementById("pwResetSend").addEventListener("click", async () => {
    const email = document.getElementById("pwResetEmail").value;
    await sendPasswordRecoveryEmail(email);
  });
}

function showSetNewPasswordModal() {
  openModal(`
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="text-lg font-semibold">Set a new password</div>
        <button id="mClose" class="btn chip rounded-2xl px-3 py-1.5">Close</button>
      </div>

      <div class="text-sm text-white/70">
        Choose a new password for your account.
      </div>

      <input id="newPw1" type="password" placeholder="New password"
        class="w-full rounded-2xl px-4 py-3 input" />
      <input id="newPw2" type="password" placeholder="Confirm new password"
        class="w-full rounded-2xl px-4 py-3 input" />

      <button id="pwUpdateBtn" class="btn w-full rounded-2xl px-4 py-3 bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-400/20">
        Update password
      </button>

      <div class="text-xs text-white/60">
        Tip: After saving, you’ll be signed in automatically.
      </div>
    </div>
  `);

  document.getElementById("mClose").addEventListener("click", closeModal);
  document.getElementById("pwUpdateBtn").addEventListener("click", async () => {
    const p1 = document.getElementById("newPw1").value || "";
    const p2 = document.getElementById("newPw2").value || "";
    if (p1.length < 6) return showToast("Use 6+ characters");
    if (p1 !== p2) return showToast("Passwords don’t match");

    const { error } = await supabase.auth.updateUser({ password: p1 });
    if (error) {
      console.error(error);
      showToast(error.message || "Password update failed");
      return;
    }
    showToast("Password updated");
    clearUrlHash();
    closeModal();
    refreshSessionUI(0);
  });
}

function maybeHandleRecoveryFromUrl() {
  const hp = parseHashParams();
  if (hp.type === "recovery") {
    // Supabase will set a session via detectSessionInUrl:true
    showSetNewPasswordModal();
  }
}

  async function refreshSessionUI(retry=0) {
    if (configLooksBad()) {
      authPanel?.classList.remove("hidden");
      appPanel?.classList.add("hidden");
      authMsg.textContent = "Supabase key looks invalid. Open app.js and paste the FULL SUPABASE_ANON_KEY (no …).";
      return;
    }

    let data;
    try {
      ({ data } = await supabase.auth.getSession());
    } catch (e) {
      console.error(e);
      if (retry < 3) {
        return setTimeout(() => refreshSessionUI(retry+1), 250);
      }
      showToast("Auth error");
      return;
    }

    sessionUser = data.session?.user || null;

    if (!sessionUser) {
      if (retry < 3) {
        return setTimeout(() => refreshSessionUI(retry+1), 250);
      }
      authPanel?.classList.remove("hidden");
      appPanel?.classList.add("hidden");
      profileBtn?.classList.add("hidden");
      closeProfileMenu();
      return;
    }

    authPanel?.classList.add("hidden");
    appPanel?.classList.remove("hidden");
    profileBtn?.classList.remove("hidden");
    if (profileEmail) profileEmail.textContent = sessionUser.email || "Signed in";
    closeProfileMenu();
    await loadLibrary();
  }

  signInBtn?.addEventListener("click", async () => {
    authMsg.textContent = "";
    const email = (authEmail.value || "").trim();
    const password = authPassword.value || "";

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      authMsg.textContent = error.message;
      return;
    }
    showToast("Signed in");
    // let mobile settle
    setTimeout(() => refreshSessionUI(0), 150);
  });

  signUpBtn?.addEventListener("click", async () => {
    authMsg.textContent = "";
    const email = (authEmail.value || "").trim();
    const password = authPassword.value || "";
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      authMsg.textContent = error.message;
      return;
    }
    authMsg.textContent = "Account created. If you get a confirmation email, confirm it then sign in.";
    showToast("Account created");
  });

  forgotPwBtn?.addEventListener("click", () => {
    authMsg.textContent = "";
    showPasswordRecoveryRequestModal();
  });

  profileBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleProfileMenu();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#profileMenu") && !e.target.closest("#profileBtn")) closeProfileMenu();
  });
  profileLogout?.addEventListener("click", async () => {
    closeProfileMenu();
    await supabase.auth.signOut();
    showToast("Logged out");
    refreshSessionUI(0);
  });

  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      showSetNewPasswordModal();
    }
    refreshSessionUI(0);
  });

  // ---- Library control listeners
  [filterScope, filterMediaType, filterFormat, filterGenre, sortBy, minRating, groupBy].filter(Boolean)
    .forEach(el => el.addEventListener("change", renderLibrary));
  librarySearch?.addEventListener("input", () => renderLibrary());
// ---- Mobile: collapse filters panel
let filtersOpen = false;
function setFiltersPanelOpen(open) {
  if (!filtersPanel) return;
  const isDesktop = window.matchMedia("(min-width: 768px)").matches;
  if (isDesktop) {
    // Always open on desktop
    filtersPanel.classList.remove("hidden");
    filtersToggleIcon && (filtersToggleIcon.textContent = "▾");
    return;
  }
  filtersOpen = !!open;
  filtersPanel.classList.toggle("hidden", !filtersOpen);
  if (filtersToggleIcon) filtersToggleIcon.textContent = filtersOpen ? "▴" : "▾";
}

filtersToggle?.addEventListener("click", () => setFiltersPanelOpen(!filtersOpen));
window.addEventListener("resize", () => setFiltersPanelOpen(filtersOpen));
// start collapsed on mobile
setFiltersPanelOpen(false);



  // ---- PWA SW
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  // Boot
  refreshSessionUI(0);
  maybeHandleRecoveryFromUrl();
})();
