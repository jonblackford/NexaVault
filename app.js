// NexaVault fixed app.js
const supabase = supabaseJs.createClient(
  "YOUR_SUPABASE_URL",
  "YOUR_SUPABASE_ANON_KEY"
);

const profileBtn = document.getElementById("profileBtn");
const profileMenu = document.getElementById("profileMenu");
profileBtn.onclick = () => profileMenu.classList.toggle("hidden");

document.getElementById("logoutBtn").onclick = async () => {
  await supabase.auth.signOut();
  location.reload();
};

document.getElementById("createCollectionBtn").onclick = async () => {
  const name = prompt("Collection name");
  if (!name) return;
  const { data: user } = await supabase.auth.getUser();
  await supabase.from("collections").insert({ name, user_id: user.user.id });
  alert("Collection created");
};

async function saveItem(item, collectionId = null) {
  const { data: user } = await supabase.auth.getUser();
  const { data: media } = await supabase
    .from("media_items")
    .insert({
      user_id: user.user.id,
      tmdb_id: item.id,
      title: item.title || item.name,
      media_type: item.media_type,
      poster: item.poster_path,
      rating: item.vote_average
    })
    .select()
    .single();

  if (collectionId) {
    await supabase.from("collection_items").insert({
      collection_id: collectionId,
      media_item_id: media.id
    });
  }

  document.getElementById("searchInput").value = "";
  loadLibrary();
}

async function loadLibrary() {
  const { data } = await supabase
    .from("media_items")
    .select("*")
    .order("created_at", { ascending: false });

  const lib = document.getElementById("library");
  lib.innerHTML = "";
  data?.forEach(item => {
    const div = document.createElement("div");
    div.className = "bg-neutral-900 p-2 rounded";
    div.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster}" />
                     <p class="mt-2 text-sm">${item.title}</p>`;
    lib.appendChild(div);
  });
}

loadLibrary();

// Password recovery
async function recoverPassword(email) {
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });
}
