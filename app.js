/* NexaVault • Media Catalog
   - Static-host friendly (GitHub Pages)
   - Auth + DB via Supabase
   - Search/details via TMDB
*/

(() => {
  // =========================
  // ✅ CONFIG (EDIT THESE)
  // =========================
  const SUPABASE_URL = "https://zmljybyharvunwctxbwp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptbGp5YnloYXJ2dW53Y3R4YndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MDQ5NDgsImV4cCI6MjA4MzM4MDk0OH0.h6TW7xX4B4y8D-yBL6-WqnhYWo0MqFAAP14lzXmXyrg";
  const TMDB_API_KEY = "cc4e1c1296a271801dd38dd0c5742ec3";
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

  const userPill = document.getElementById("userPill");
  const userEmail = document.getElementById("userEmail");
  const logoutBtn = document.getElementById("logoutBtn");

  const typeAll = document.getElementById("typeAll");
  const typeMovie = document.getElementById("typeMovie");
  const typeTv = document.getElementById("typeTv");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const searchResults = document.getElementById("searchResults");

  const filterScope = document.getElementById("filterScope");
  const filterMediaType = document.getElementById("filterMediaType");
  const filterFormat = document.getElementById("filterFormat");
  const statsText = document.getElementById("statsText");

  const grid = document.getElementById("grid");
  const emptyState = document.getElementById("emptyState");

  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modalBody");
  const toast = document.getElementById("toast");

  // Supabase init
  if (!SUPABASE_URL.startsWith("http")) {
    console.warn("Supabase URL not set yet.");
  }
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // App state
  let sessionUser = null;
  let library = []; // rows from Supabase
  let searchType = "all"; // all | movie | tv

  // =========================
  // Helpers
  // =========================
  const esc = (s) =>
    (s ?? "").toString().replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m]));

  function showToast(message) {
    toast.classList.remove("hidden");
    toast.querySelector("div").textContent = message;
    setTimeout(() => toast.classList.add("hidden"), 2400);
  }

  function openModal(html) {
    modalBody.innerHTML = html;
    modal.classList.remove("hidden");
  }
  function closeModal() {
    modal.classList.add("hidden");
    modalBody.innerHTML = "";
  }
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  function imgUrl(path, size = "w500") {
    if (!path) return null;
    if (size === "orig") return `${TMDB_IMG_ORIG}${path}`;
    return `${TMDB_IMG_500}${path}`;
  }

  function btnActive(el, isActive) {
    el.classList.toggle("bg-white/10", isActive);
    el.classList.toggle("border-white/15", isActive);
  }

  // =========================
  // TMDB API
  // =========================
  async function tmdbFetch(url) {
    if (!TMDB_API_KEY || TMDB_API_KEY.includes("PASTE_")) {
      showToast("Add your TMDB key in app.js");
      throw new Error("TMDB key missing");
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  }

  async function searchTMDB(query) {
    const q = encodeURIComponent(query);
    const url = `${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&query=${q}&include_adult=false`;
    const data = await tmdbFetch(url);
    const results = (data.results || [])
      .filter((r) => (searchType === "all" ? (r.media_type === "movie" || r.media_type === "tv") : r.media_type === searchType))
      .map((r) => ({
        tmdb_id: r.id,
        media_type: r.media_type,
        title: r.media_type === "movie" ? r.title : r.name,
        year: (r.media_type === "movie" ? r.release_date : r.first_air_date || "").split("-")[0] || "",
        poster_path: r.poster_path,
        backdrop_path: r.backdrop_path,
        overview: r.overview || "",
      }));
    return results;
  }

  async function getDetails(media_type, tmdb_id) {
    const endpoint = media_type === "movie" ? "movie" : "tv";
    const url = `${TMDB_BASE}/${endpoint}/${tmdb_id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
    const d = await tmdbFetch(url);

    const cast = (d.credits?.cast || []).slice(0, 8).map((c) => c.name).join(", ");
    const genres = (d.genres || []).map((g) => g.name).join(", ");

    let runtime = "";
    if (media_type === "movie") runtime = d.runtime ? `${d.runtime} min` : "";
    if (media_type === "tv") runtime = (d.episode_run_time?.[0] ? `${d.episode_run_time[0]} min` : "");

    return {
      tmdb_id: d.id,
      media_type,
      title: media_type === "movie" ? d.title : d.name,
      year: (media_type === "movie" ? d.release_date : d.first_air_date || "").split("-")[0] || "",
      poster_url: imgUrl(d.poster_path),
      backdrop_url: imgUrl(d.backdrop_path, "orig"),
      overview: d.overview || "No overview available.",
      cast: cast || "—",
      genre: genres || "—",
      runtime: runtime || "—",
      seasons_count: media_type === "tv" ? (d.number_of_seasons || 0) : 0,
      seasons: media_type === "tv" ? (d.seasons || []).filter(s => s.season_number !== 0) : [],
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

  // =========================
  // Supabase (Library)
  // =========================
  async function loadLibrary() {
    if (!sessionUser) return;
    const { data, error } = await supabase
      .from("media_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      showToast("Failed to load your library");
      return;
    }
    library = data || [];
    renderLibrary();
  }

  async function upsertItem(payload) {
    // payload must include: user_id, tmdb_id, media_type, scope, title
    const { error } = await supabase.from("media_items").upsert(payload, {
      onConflict: "user_id,tmdb_id,media_type,scope,season_number,episode_number"
    });
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

  // =========================
  // Rendering
  // =========================
  function renderSearchResults(items) {
    if (!items.length) {
      searchResults.innerHTML = `<div class="p-4 text-sm text-white/70">No results</div>`;
      searchResults.classList.remove("hidden");
      return;
    }

    searchResults.innerHTML = items.map((it) => {
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

  function libraryFiltersMatch(row) {
    const scopeOk = filterScope.value === "all" || row.scope === filterScope.value;
    const typeOk = filterMediaType.value === "all" || row.media_type === filterMediaType.value;
    const formatOk = filterFormat.value === "all" || (row.format || "Digital") === filterFormat.value;
    return scopeOk && typeOk && formatOk;
  }

  function renderLibrary() {
    const filtered = library.filter(libraryFiltersMatch);

    statsText.textContent = `${filtered.length} item${filtered.length === 1 ? "" : "s"} (of ${library.length})`;

    if (!filtered.length) {
      grid.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    grid.innerHTML = filtered.map((row) => {
      const poster = row.poster_url || "";
      const typeEmoji = row.media_type === "tv" ? "📺" : "🎬";
      const scopeBadge =
        row.scope === "title" ? "Title" :
        row.scope === "season" ? `Season ${row.season_number}` :
        `S${row.season_number}E${row.episode_number}`;

      const rating = (row.rating ?? null);
      return `
        <button class="poster-card rounded-2xl overflow-hidden text-left"
          data-rowid="${row.id}">
          <div class="relative">
            <div class="aspect-[2/3] bg-black/25">
              ${poster
                ? `<img src="${esc(poster)}" class="w-full h-full object-cover" loading="lazy" />`
                : `<div class="w-full h-full flex items-center justify-center text-3xl">🎬</div>`}
            </div>
            <div class="absolute top-2 left-2 chip px-2 py-1 rounded-xl text-xs">${typeEmoji} ${scopeBadge}</div>
            ${rating !== null && rating !== undefined && rating !== ""
              ? `<div class="absolute top-2 right-2 chip px-2 py-1 rounded-xl text-xs">⭐ ${rating}/10</div>`
              : ""}
          </div>
          <div class="p-3">
            <div class="font-semibold text-sm truncate">${esc(row.title)}</div>
            <div class="text-xs text-white/65 mt-1 flex items-center justify-between gap-2">
              <span class="truncate">${esc(row.year || "")}</span>
              <span class="chip px-2 py-0.5 rounded-full">${esc(row.format || "Digital")}</span>
            </div>
          </div>
        </button>
      `;
    }).join("");

    [...grid.querySelectorAll("button[data-rowid]")].forEach(card => {
      card.addEventListener("click", () => {
        const rowId = Number(card.dataset.rowid);
        const row = library.find(r => r.id === rowId);
        if (row) showItemModal(row);
      });
    });
  }

  // =========================
  // Add / Edit flows
  // =========================
  async function showAddFlow(media_type, tmdb_id) {
    openModal(`
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold">Loading details…</div>
          <button id="mClose" class="btn chip rounded-2xl px-3 py-1.5">Close</button>
        </div>
        <div class="grid md:grid-cols-[160px,1fr] gap-4">
          <div class="rounded-2xl overflow-hidden border border-white/10 skeleton aspect-[2/3]"></div>
          <div class="space-y-3">
            <div class="h-6 w-2/3 rounded-xl skeleton"></div>
            <div class="h-4 w-1/2 rounded-xl skeleton"></div>
            <div class="h-4 w-full rounded-xl skeleton"></div>
            <div class="h-4 w-full rounded-xl skeleton"></div>
          </div>
        </div>
      </div>
    `);
    document.getElementById("mClose").addEventListener("click", closeModal);

    const d = await getDetails(media_type, tmdb_id);

    // default form fields
    const defaultFormat = "Digital";
    const defaultRating = "";
    const defaultComment = "";

    const titleBadge = d.media_type === "tv" ? "TV" : "Movie";
    const poster = d.poster_url ? `<img src="${esc(d.poster_url)}" class="w-full h-full object-cover" />` :
      `<div class="w-full h-full flex items-center justify-center text-4xl">🎬</div>`;

    const tvControls = d.media_type === "tv" ? `
      <div class="glass rounded-2xl p-4 border border-white/10">
        <div class="flex items-center justify-between">
          <div class="font-semibold">TV Options</div>
          <div class="text-xs text-white/60">${d.seasons_count} seasons</div>
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
            <div class="text-xs uppercase tracking-[0.25em] text-white/60">${titleBadge}</div>
            <div class="text-2xl font-semibold">${esc(d.title)} <span class="text-white/60 font-normal">(${esc(d.year)})</span></div>
            <div class="text-sm text-white/70 mt-1">${esc(d.runtime)} • ${esc(d.genre)}</div>
          </div>
          <button id="mClose" class="btn chip rounded-2xl px-3 py-1.5">Close</button>
        </div>

        <div class="grid md:grid-cols-[170px,1fr] gap-5">
          <div class="rounded-3xl overflow-hidden border border-white/10 bg-black/20 aspect-[2/3]">
            ${poster}
          </div>

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
                  ${["Blu-ray","DVD","Digital","4K Ultra HD","VHS"].map(v => `<option value="${v}" ${v===defaultFormat?"selected":""}>${v}</option>`).join("")}
                </select>
              </div>
              <div>
                <label class="text-xs text-white/70">Rating (0-10)</label>
                <input id="rating" type="number" min="0" max="10" step="0.5" value="${defaultRating}"
                  class="mt-1 w-full rounded-2xl px-3 py-2 input" />
              </div>
              <div>
                <label class="text-xs text-white/70">Scope</label>
                <select id="scope" class="mt-1 w-full rounded-2xl px-3 py-2 input">
                  <option value="title" selected>${d.media_type === "tv" ? "Series" : "Movie"}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="text-xs text-white/70">Comment</label>
              <textarea id="comment" rows="3" class="mt-1 w-full rounded-2xl px-3 py-2 input" placeholder="What did you think?">${esc(defaultComment)}</textarea>
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

    // Save title/movie/series row
    document.getElementById("saveTitleBtn").addEventListener("click", async () => {
      const format = document.getElementById("format").value;
      const ratingRaw = document.getElementById("rating").value;
      const rating = ratingRaw === "" ? null : Number(ratingRaw);
      const comment = document.getElementById("comment").value;

      const payload = {
        user_id: sessionUser.id,
        tmdb_id: d.tmdb_id,
        media_type: d.media_type,
        scope: "title",
        title: d.title,
        year: d.year,
        poster_url: d.poster_url || null,
        backdrop_url: d.backdrop_url || null,
        format,
        rating,
        comment,
        genre: d.genre,
        cast: d.cast,
        overview: d.overview,
        runtime: d.runtime,
        season_number: null,
        episode_number: null,
      };

      const ok = await upsertItem(payload);
      if (ok) closeModal();
    });

    // TV: add series button + pick episodes
    if (d.media_type === "tv") {
      const addSeriesBtn = document.getElementById("addSeriesBtn");
      const loadSeasonBtn = document.getElementById("loadSeasonBtn");
      const seasonSelect = document.getElementById("seasonSelect");
      const seasonPicker = document.getElementById("seasonPicker");

      addSeriesBtn.addEventListener("click", async () => {
        // same as saveTitleBtn but explicit series naming
        document.getElementById("scope").value = "title";
        document.getElementById("saveTitleBtn").click();
      });

      loadSeasonBtn.addEventListener("click", async () => {
        const season_number = Number(seasonSelect.value);
        seasonPicker.classList.remove("hidden");
        seasonPicker.innerHTML = `
          <div class="glass rounded-2xl p-4 border border-white/10">
            <div class="flex items-center justify-between">
              <div class="font-semibold">Season ${season_number}</div>
              <button id="closeSeasonPicker" class="btn chip rounded-2xl px-3 py-1.5 text-sm">Hide</button>
            </div>
            <div class="mt-3 text-sm text-white/70">Loading episodes…</div>
            <div class="mt-4 space-y-2" id="epList"></div>
          </div>
        `;
        document.getElementById("closeSeasonPicker").addEventListener("click", () => {
          seasonPicker.classList.add("hidden");
        });

        const episodes = await getSeasonEpisodes(d.tmdb_id, season_number);
        const epList = document.getElementById("epList");

        if (!episodes.length) {
          epList.innerHTML = `<div class="text-sm text-white/60">No episodes found.</div>`;
          return;
        }

        // Add season button
        epList.innerHTML = `
          <div class="flex flex-col md:flex-row md:items-center gap-2 mb-3">
            <button id="addSeasonBtn" class="btn rounded-2xl px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/25 border border-indigo-400/20">
              Add entire season ${season_number}
            </button>
            <div class="text-xs text-white/60">Adds a season entry; you can also add individual episodes below.</div>
          </div>
        ` + episodes.map(ep => {
          const still = ep.still_path ? `<img src="${esc(imgUrl(ep.still_path))}" class="w-14 h-10 object-cover rounded-xl border border-white/10" />`
            : `<div class="w-14 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">🎞️</div>`;
          return `
            <div class="glass rounded-2xl p-3 border border-white/10 flex items-center gap-3">
              ${still}
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold truncate">E${ep.episode_number} • ${esc(ep.name)}</div>
                <div class="text-xs text-white/60 truncate">${esc(ep.air_date || "")}</div>
              </div>
              <button class="btn chip rounded-2xl px-3 py-1.5 text-sm" data-add-ep="${ep.episode_number}">
                Add
              </button>
            </div>
          `;
        }).join("");

        document.getElementById("addSeasonBtn").addEventListener("click", async () => {
          const format = document.getElementById("format").value;
          const ratingRaw = document.getElementById("rating").value;
          const rating = ratingRaw === "" ? null : Number(ratingRaw);
          const comment = document.getElementById("comment").value;

          const payload = {
            user_id: sessionUser.id,
            tmdb_id: d.tmdb_id,
            media_type: "tv",
            scope: "season",
            title: d.title,
            year: d.year,
            poster_url: d.poster_url || null,
            backdrop_url: d.backdrop_url || null,
            format,
            rating,
            comment,
            genre: d.genre,
            cast: d.cast,
            overview: d.overview,
            runtime: d.runtime,
            season_number,
            episode_number: null,
          };
          await upsertItem(payload);
        });

        [...epList.querySelectorAll("button[data-add-ep]")].forEach(b => {
          b.addEventListener("click", async () => {
            const episode_number = Number(b.dataset.addEp);
            const format = document.getElementById("format").value;
            const ratingRaw = document.getElementById("rating").value;
            const rating = ratingRaw === "" ? null : Number(ratingRaw);
            const comment = document.getElementById("comment").value;

            const ep = episodes.find(e => e.episode_number === episode_number);

            const payload = {
              user_id: sessionUser.id,
              tmdb_id: d.tmdb_id,
              media_type: "tv",
              scope: "episode",
              title: d.title,
              year: d.year,
              poster_url: d.poster_url || null,
              backdrop_url: d.backdrop_url || null,
              format,
              rating,
              comment,
              genre: d.genre,
              cast: d.cast,
              overview: ep?.overview || d.overview,
              runtime: ep?.runtime ? `${ep.runtime} min` : d.runtime,
              season_number,
              episode_number,
            };
            await upsertItem(payload);
          });
        });
      });
    }
  }

  function showItemModal(row) {
    const titleLine =
      row.scope === "title" ? row.title :
      row.scope === "season" ? `${row.title} • Season ${row.season_number}` :
      `${row.title} • S${row.season_number}E${row.episode_number}`;

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
          <div class="rounded-3xl overflow-hidden border border-white/10 bg-black/20 aspect-[2/3]">
            ${poster}
          </div>

          <div class="space-y-4">
            <div class="glass rounded-2xl p-4 border border-white/10">
              <div class="text-sm text-white/70">Overview</div>
              <div class="text-sm mt-1 leading-relaxed text-white/85">${esc(row.overview || "—")}</div>
            </div>

            <div class="glass rounded-2xl p-4 border border-white/10">
              <div class="text-sm text-white/70">Cast</div>
              <div class="text-sm mt-1">${esc(row.cast_list || "—")}</div>
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
                <input id="eRating" type="number" min="0" max="10" step="0.5" value="${row.rating ?? ""}"
                  class="mt-1 w-full rounded-2xl px-3 py-2 input" />
              </div>
              <div>
                <label class="text-xs text-white/70">Scope</label>
                <input class="mt-1 w-full rounded-2xl px-3 py-2 input" value="${esc(row.scope)}" disabled />
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

      const payload = { ...row, format, rating, comment };
      const ok = await upsertItem(payload);
      if (ok) closeModal();
    });

    document.getElementById("delBtn").addEventListener("click", async () => {
      await deleteItem(row.id);
      closeModal();
    });
  }

  // =========================
  // Auth
  // =========================
  async function refreshSessionUI() {
    const { data } = await supabase.auth.getSession();
    sessionUser = data.session?.user || null;

    if (!sessionUser) {
      authPanel.classList.remove("hidden");
      appPanel.classList.add("hidden");
      userPill.classList.add("hidden");
      logoutBtn.classList.add("hidden");
      return;
    }

    authPanel.classList.add("hidden");
    appPanel.classList.remove("hidden");
    userPill.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    userEmail.textContent = sessionUser.email || "Signed in";
    await loadLibrary();
  }

  signInBtn.addEventListener("click", async () => {
    authMsg.textContent = "";
    const email = authEmail.value.trim();
    const password = authPassword.value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      authMsg.textContent = error.message;
      return;
    }
    authMsg.textContent = "Signed in!";
    await refreshSessionUI();
  });

  signUpBtn.addEventListener("click", async () => {
    authMsg.textContent = "";
    const email = authEmail.value.trim();
    const password = authPassword.value;

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      authMsg.textContent = error.message;
      return;
    }
    authMsg.textContent = "Account created. If email confirmation is enabled, check your inbox.";
    await refreshSessionUI();
  });

  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    showToast("Logged out");
    await refreshSessionUI();
  });

  supabase.auth.onAuthStateChange(() => {
    refreshSessionUI();
  });

  // =========================
  // Search + buttons
  // =========================
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
    const q = searchInput.value.trim();
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

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#searchResults") && !e.target.closest("#searchInput") && !e.target.closest("#searchBtn")) {
      searchResults.classList.add("hidden");
    }
  });

  // Filters re-render
  [filterScope, filterMediaType, filterFormat].forEach(el => el.addEventListener("change", renderLibrary));

  // =========================
  // Boot
  // =========================
  refreshSessionUI();
})();