// Kids Corner — a Stremio catalog add-on (no dependencies, Node 18+)
// Adds Netflix-style rows of kid-friendly content to the Stremio home screen.
// Data: The Movie Database (TMDB). Needs a free TMDB API key.

const http = require("http");

const PORT = process.env.PORT || 7000;
// Accept TMDB_API_KEY, TMDB-API-KEY, or any similar spelling
const TMDB_KEY = (process.env.TMDB_API_KEY || process.env["TMDB-API-KEY"] ||
  Object.entries(process.env).find(([k]) => k.toUpperCase().replace(/[^A-Z]/g, "") === "TMDBAPIKEY")?.[1] || "").trim();
const REGION = process.env.REGION || "AU";            // watch/release region
const CERT_COUNTRY = process.env.CERT_COUNTRY || "US"; // US ratings data is the most complete on TMDB
const MAX_CERT = process.env.MAX_CERT || "PG";        // "G" for little kids, "PG" for older kids
const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

// Genres that are never kid-friendly
const BLOCK_MOVIE_GENRES = "27,53,80,10752"; // horror, thriller, crime, war
const BLOCK_TV_GENRES = "80,9648,10768,10767,10764,99"; // crime, mystery, war&politics, talk, reality, documentary

const GENRES = ["Animation", "Adventure", "Comedy", "Fantasy", "Family", "Music"];
const MOVIE_GENRE_IDS = { Animation: 16, Adventure: 12, Comedy: 35, Fantasy: 14, Family: 10751, Music: 10402 };
const TV_GENRE_IDS = { Animation: 16, Adventure: 10759, Comedy: 35, Fantasy: 10765, Family: 10751, Music: 10751 };

const EN_GENRES = ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Thriller", "Romance", "Crime", "Documentary"];
const EN_MOVIE_GENRE_IDS = { Action: 28, Comedy: 35, Drama: 18, "Sci-Fi": 878, Horror: 27, Thriller: 53, Romance: 10749, Crime: 80, Documentary: 99 };
const EN_TV_GENRE_IDS = { Action: 10759, Comedy: 35, Drama: 18, "Sci-Fi": 10765, Horror: 9648, Thriller: 9648, Romance: 18, Crime: 80, Documentary: 99 };

const HINDI_GENRES =["Action", "Comedy", "Drama", "Romance", "Thriller", "Family", "Crime"];
const HINDI_MOVIE_GENRE_IDS = { Action: 28, Comedy: 35, Drama: 18, Romance: 10749, Thriller: 53, Family: 10751, Crime: 80 };
const HINDI_TV_GENRE_IDS = { Action: 10759, Comedy: 35, Drama: 18, Romance: 18, Thriller: 9648, Family: 10751, Crime: 80 };

const manifest = {
  id: "community.kidscorner.hindi.tmdb",
  version: "1.2.1",
  name: "Netflix-Style Home: Kids, English & Hindi",
  description: "Trending and new movies and series in English and Hindi, plus a kid-safe section, as Netflix-style rows on your Stremio home screen.",
  logo: "https://em-content.zobj.net/source/apple/391/rocket_1f680.png",
  background: "https://image.tmdb.org/t/p/original/ab8m5ZjTe6FE1tVwz6Nl4l0Bz1H.jpg",
  resources: ["catalog"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  catalogs: [
    // ---- English (all ages) ----
    { type: "movie", id: "en_trending_movies", name: "🔥 Trending Movies", extra: [{ name: "skip" }] },
    { type: "series", id: "en_trending_series", name: "🔥 Trending Series", extra: [{ name: "skip" }] },
    { type: "movie", id: "en_new_movies", name: "🆕 New Movie Releases", extra: [{ name: "skip" }, { name: "genre", options: EN_GENRES }] },
    { type: "series", id: "en_new_series", name: "🆕 New Series", extra: [{ name: "skip" }, { name: "genre", options: EN_GENRES }] },
    { type: "movie", id: "en_top_movies", name: "⭐ Top Rated Movies of the Year", extra: [{ name: "skip" }, { name: "genre", options: EN_GENRES }] },
    { type: "movie", id: "kids_new_movies", name: "🆕 New for Kids", extra: [{ name: "skip" }] },
    { type: "movie", id: "kids_trending_movies", name: "🔥 Trending Kids Movies", extra: [{ name: "skip" }, { name: "genre", options: GENRES }] },
    { type: "series", id: "kids_trending_series", name: "🔥 Trending Kids Shows", extra: [{ name: "skip" }, { name: "genre", options: GENRES }] },
    { type: "series", id: "kids_new_series", name: "🆕 New Kids Shows", extra: [{ name: "skip" }] },
    { type: "movie", id: "kids_top_movies", name: "⭐ Top Rated Family Movies", extra: [{ name: "skip" }, { name: "genre", options: GENRES }] },
    // ---- Hindi (all ages) ----
    { type: "movie", id: "hindi_trending_movies", name: "🇮🇳 Trending Hindi Movies", extra: [{ name: "skip" }, { name: "genre", options: HINDI_GENRES }] },
    { type: "movie", id: "hindi_new_movies", name: "🇮🇳 New Hindi Releases", extra: [{ name: "skip" }] },
    { type: "series", id: "hindi_trending_series", name: "🇮🇳 Trending Hindi Series", extra: [{ name: "skip" }, { name: "genre", options: HINDI_GENRES }] },
    { type: "series", id: "hindi_new_series", name: "🇮🇳 New Hindi Series", extra: [{ name: "skip" }] },
    { type: "movie", id: "hindi_top_movies", name: "🇮🇳 All-Time Great Hindi Movies", extra: [{ name: "skip" }] },
    { type: "movie", id: "hindi_kids_movies", name: "🇮🇳 Hindi Family & Kids Movies", extra: [{ name: "skip" }] },
  ],
  behaviorHints: { configurable: false },
};

// Kids-only version: install /kids/manifest.json on a child's profile
const kidsManifest = {
  ...manifest,
  id: "community.kidscorner.only.tmdb",
  name: "Kids Only Home",
  description: "Only kid-friendly rows: trending and new kids movies and shows, top family movies, and Hindi family movies. Nothing else.",
  catalogs: manifest.catalogs
    .filter((c) => c.id.startsWith("kids_") || c.id === "hindi_kids_movies")
    .map((c) => ({ ...c, name: c.id === "hindi_kids_movies" ? "🇮🇳 Hindi Kids & Family Movies" : c.name })),
};

// ---------- tiny cache ----------
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.val;
  const val = await fn();
  cache.set(key, { val, exp: Date.now() + ttlMs });
  if (cache.size > 5000) cache.delete(cache.keys().next().value);
  return val;
}
const HOUR = 3600e3;

// Key can come from the install link (/KEY/manifest.json) or from the server environment
const { AsyncLocalStorage } = require("async_hooks");
const reqKey = new AsyncLocalStorage();
const activeKey = () => reqKey.getStore() || TMDB_KEY;
async function tmdb(path, params = {}) {
  const key = activeKey();
  const url = new URL(TMDB + path);
  const isToken = key.length > 40; // long "Read Access Token" vs short v3 key
  if (!isToken) url.searchParams.set("api_key", key);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, v);
  const res = await fetch(url, isToken ? { headers: { Authorization: `Bearer ${key}` } } : undefined);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TMDB ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const today = () => daysAgo(0);

// ---------- what each row asks TMDB for ----------
function discoverQuery(catalogId, genre, page) {
  const movieBase = {
    certification_country: CERT_COUNTRY,
    "certification.lte": MAX_CERT,
    include_adult: "false",
    without_genres: BLOCK_MOVIE_GENRES,
    region: REGION,
    page,
  };
  const tvBase = {
    include_adult: "false",
    without_genres: BLOCK_TV_GENRES,
    page,
  };
  const g = (map) => (genre && map[genre] ? String(map[genre]) : undefined);

  switch (catalogId) {
    case "kids_trending_movies":
      return ["/discover/movie", {
        ...movieBase,
        sort_by: "popularity.desc",
        with_genres: g(MOVIE_GENRE_IDS) || "10751|16", // family OR animation
        "primary_release_date.gte": daysAgo(3 * 365),
        "vote_count.gte": 20,
      }];
    case "kids_new_movies":
      // Ratings and release dates must come from the same country's release record
      return ["/discover/movie", {
        ...movieBase,
        region: CERT_COUNTRY,
        sort_by: "popularity.desc",
        with_genres: "10751|16",
        with_release_type: "4|5", // digital or physical = watchable at home
        "release_date.gte": daysAgo(240),
        "release_date.lte": today(),
      }];
    case "kids_new_movies__fallback":
      return ["/discover/movie", {
        include_adult: "false", without_genres: BLOCK_MOVIE_GENRES, page,
        sort_by: "popularity.desc",
        with_genres: "10751|16",
        "primary_release_date.gte": daysAgo(365),
        "primary_release_date.lte": today(),
        "vote_count.gte": 5,
      }, (r) => r.adult === false || r.adult === undefined];
    case "kids_top_movies":
      return ["/discover/movie", {
        ...movieBase,
        sort_by: "vote_average.desc",
        with_genres: g(MOVIE_GENRE_IDS) || "10751|16",
        "vote_count.gte": 1500,
      }];
    case "kids_trending_series":
      return ["/discover/tv", {
        ...tvBase,
        sort_by: "popularity.desc",
        with_genres: g(TV_GENRE_IDS) ? `10762,${g(TV_GENRE_IDS)}` : "10762", // Kids genre
        "air_date.gte": daysAgo(2 * 365),
        "vote_count.gte": 5,
      }];
    case "kids_new_series":
      return ["/discover/tv", {
        ...tvBase,
        sort_by: "popularity.desc",
        with_genres: "10762",
        "first_air_date.gte": daysAgo(365),
        "first_air_date.lte": today(),
      }];

    // ---- English ----
    // Real weekly trending chart from TMDB, filtered to English-language titles
    case "en_trending_movies":
      return ["/trending/movie/week", { page }, (r) => r.original_language === "en"];
    case "en_trending_series":
      return ["/trending/tv/week", { page }, (r) => r.original_language === "en"];
    case "en_new_movies":
      return ["/discover/movie", {
        with_original_language: "en", include_adult: "false", page, region: REGION,
        sort_by: "popularity.desc",
        with_genres: g(EN_MOVIE_GENRE_IDS),
        with_release_type: "4|5", // out on streaming/digital or disc
        "release_date.gte": daysAgo(120),
        "release_date.lte": today(),
      }];
    case "en_new_series":
      return ["/discover/tv", {
        with_original_language: "en", include_adult: "false", page,
        sort_by: "popularity.desc",
        with_genres: g(EN_TV_GENRE_IDS),
        without_genres: "10767,10764,10763", // no talk, reality, news
        "first_air_date.gte": daysAgo(180),
        "first_air_date.lte": today(),
      }];
    case "en_top_movies":
      return ["/discover/movie", {
        with_original_language: "en", include_adult: "false", page,
        sort_by: "vote_average.desc",
        with_genres: g(EN_MOVIE_GENRE_IDS),
        "primary_release_date.gte": daysAgo(365),
        "vote_count.gte": 300,
      }];

    // ---- Hindi ----
    case "hindi_trending_movies":
      return ["/discover/movie", {
        with_original_language: "hi", include_adult: "false", page,
        sort_by: "popularity.desc",
        with_genres: g(HINDI_MOVIE_GENRE_IDS),
        "primary_release_date.gte": daysAgo(2 * 365),
        "vote_count.gte": 10,
      }];
    case "hindi_new_movies":
      return ["/discover/movie", {
        with_original_language: "hi", include_adult: "false", page,
        sort_by: "popularity.desc",
        "primary_release_date.gte": daysAgo(120),
        "primary_release_date.lte": today(),
      }];
    case "hindi_top_movies":
      return ["/discover/movie", {
        with_original_language: "hi", include_adult: "false", page,
        sort_by: "vote_average.desc",
        "vote_count.gte": 300,
      }];
    case "hindi_kids_movies":
      return ["/discover/movie", {
        with_original_language: "hi", include_adult: "false", page,
        sort_by: "popularity.desc",
        with_genres: "10751|16",
        without_genres: BLOCK_MOVIE_GENRES,
        "vote_count.gte": 5,
      }];
    case "hindi_trending_series":
      return ["/discover/tv", {
        with_original_language: "hi", include_adult: "false", page,
        sort_by: "popularity.desc",
        with_genres: g(HINDI_TV_GENRE_IDS),
        without_genres: "10767,10764", // no talk/reality shows
        "air_date.gte": daysAgo(2 * 365),
        "vote_count.gte": 3,
      }];
    case "hindi_new_series":
      return ["/discover/tv", {
        with_original_language: "hi", include_adult: "false", page,
        sort_by: "popularity.desc",
        without_genres: "10767,10764",
        "first_air_date.gte": daysAgo(365),
        "first_air_date.lte": today(),
      }];
  }
  return null;
}

// Stremio's streaming add-ons work with IMDb ids, so convert TMDB ids.
async function imdbId(kind, tmdbId) {
  return cached(`ext:${kind}:${tmdbId}`, 7 * 24 * HOUR, async () => {
    const ext = await tmdb(`/${kind}/${tmdbId}/external_ids`);
    return ext.imdb_id || null;
  });
}

async function toMeta(item, type) {
  const kind = type === "movie" ? "movie" : "tv";
  const id = await imdbId(kind, item.id).catch(() => null);
  if (!id) return null;
  const date = item.release_date || item.first_air_date || "";
  return {
    id,
    type,
    name: item.title || item.name,
    poster: item.poster_path ? `${IMG}/w500${item.poster_path}` : undefined,
    background: item.backdrop_path ? `${IMG}/w1280${item.backdrop_path}` : undefined,
    posterShape: "poster",
    description: item.overview,
    releaseInfo: date.slice(0, 4),
    imdbRating: item.vote_average ? item.vote_average.toFixed(1) : undefined,
  };
}

async function getCatalog(type, catalogId, extra) {
  const skip = parseInt(extra.skip || "0", 10) || 0;
  const page = Math.floor(skip / 20) + 1;
  const q = discoverQuery(catalogId, extra.genre, page);
  if (!q) return { metas: [] };
  const key = `cat:${catalogId}:${extra.genre || ""}:${page}`;
  return cached(key, 6 * HOUR, async () => {
    let data = await tmdb(q[0], q[1]);
    let keep = q[2] || (() => true);
    // If a strict row comes back empty, use its looser backup query
    if (!(data.results || []).length) {
      const fb = discoverQuery(catalogId + "__fallback", extra.genre, page);
      if (fb) { data = await tmdb(fb[0], fb[1]); keep = fb[2] || (() => true); }
    }
    const metas = (await Promise.all((data.results || []).filter((r) => r.poster_path && keep(r)).map((r) => toMeta(r, type)))).filter(Boolean);
    return { metas, cacheMaxAge: 6 * 3600 };
  });
}

// ---------- HTTP ----------
function send(res, status, body, type = "application/json") {
  res.writeHead(status, {
    "Content-Type": type + "; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Cache-Control": status === 200 && type === "application/json" ? "max-age=3600" : "no-cache",
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function parseExtra(str) {
  const out = {};
  if (!str) return out;
  for (const part of str.split("&")) {
    const [k, v] = part.split("=");
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || "");
  }
  return out;
}

function landingPage(host, hasLinkKey, kidsOnly) {
  const base = kidsOnly ? host + "/kids" : host;
  const serverHasKey = !!TMDB_KEY;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Home Rows for Stremio</title>
<style>
body{margin:0;font-family:system-ui,sans-serif;background:#141414;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}
.c{max-width:520px;padding:32px;width:100%;box-sizing:border-box}h1{font-size:44px;margin:0 0 8px;color:#e50914;letter-spacing:-1px}
p{color:#bbb;line-height:1.5}.b{display:inline-block;margin:8px 4px;padding:14px 22px;border-radius:6px;font-weight:700;text-decoration:none;border:0;font-size:16px;cursor:pointer}
.r{background:#e50914;color:#fff}.g{background:#333;color:#fff}
textarea{width:100%;box-sizing:border-box;min-height:120px;padding:18px;border-radius:10px;border:2px solid #e50914;background:#222;color:#fff;font-size:20px;font-family:ui-monospace,monospace;margin:10px 0;resize:vertical;-webkit-user-select:text;user-select:text}
.paste{width:100%;padding:18px;font-size:20px;border-radius:10px;background:#fff;color:#141414;border:0;font-weight:800;margin-bottom:6px}
#st{min-height:20px;color:#7CFC9A;font-weight:600}
code{background:#222;padding:8px 10px;border-radius:4px;display:block;margin-top:12px;word-break:break-all;color:#ddd;font-size:13px}
.hide{display:none}.small{font-size:13px;color:#888}</style></head><body><div class="c">
${kidsOnly ? `<h1>🧸 Kids Only</h1><p>Only kid-friendly rows. Install this on your child&#39;s Stremio profile.</p>` : `<h1>🍿 Home Rows</h1><p>Trending and new movies and series in English and Hindi, plus a kids section, as rows on your Stremio home screen.</p><p><a class="b g" href="/kids/configure">🧸 Kids-only version</a></p>`}
<div id="keybox" class="${serverHasKey ? "hide" : ""}">
  <p>Paste your TMDB API key to make your personal install link:</p>
  <button class="paste" id="pb" type="button">📋 Paste my key</button>
  <textarea id="k" placeholder="Or tap here and paste your TMDB API key" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text"></textarea>
  <div id="st"></div>
  <p class="small">Free at themoviedb.org → Settings → API. It's only stored in your install link.</p>
</div>
<div><a id="i1" class="b r" href="#">Install in Stremio</a><a id="i2" class="b g" href="#">Install on Stremio Web</a></div>
<p>Or paste this link into Stremio → Add-ons → search box:</p><code id="u"></code>
<script>
const host=${JSON.stringify(base)}, needKey=${serverHasKey ? "false" : "true"};
const k=document.getElementById("k");
function upd(){
  const key=[...(k&&k.value||"")].filter(c=>c.trim()).join("");
  const st=document.getElementById("st");
  if(st) st.textContent=!needKey?"":key.length>=20?"✅ Key added. Now tap Install.":key?"That looks too short. Check you copied the whole key.":"";
  const ok=!needKey||key.length>=20;
  const m=host+(needKey&&key?"/"+encodeURIComponent(key):"")+"/manifest.json";
  document.getElementById("u").textContent=ok?m:"Enter your key above first";
  document.getElementById("i1").href=ok?m.replace("https://","stremio://").replace("http://","stremio://"):"#";
  document.getElementById("i2").href=ok?"https://web.stremio.com/#/addons?addon="+encodeURIComponent(m):"#";
  for(const id of ["i1","i2"]) document.getElementById(id).style.opacity=ok?1:.4;
}
if(k){k.addEventListener("input",upd);k.addEventListener("paste",()=>setTimeout(upd,50));}
const pb=document.getElementById("pb");
if(pb)pb.addEventListener("click",async()=>{
  try{const t=await navigator.clipboard.readText();k.value=t;upd();}
  catch(e){k.focus();document.getElementById("st").textContent="Tap the box below, then hold and choose Paste.";}
});
upd();
</script></div></body></html>`;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, "");
  const url = new URL(req.url, "http://x");
  let path = url.pathname;
  // Personal install links look like /<tmdb key>/manifest.json
  const km = path.match(/^\/([A-Za-z0-9._-]{20,})(\/.*)$/);
  let linkKey = "";
  if (km) { linkKey = km[1]; path = km[2]; }
  // Kids-only links look like /kids/manifest.json
  let kidsOnly = false;
  if (path === "/kids" || path.startsWith("/kids/")) { kidsOnly = true; path = path.slice(5) || "/"; }
  return reqKey.run(linkKey, () => handle(req, res, url, path, linkKey, kidsOnly));
});

async function handle(req, res, url, path, linkKey, kidsOnly) {
  const mf = kidsOnly ? kidsManifest : manifest;
  try {
    // Stremio apps fetching the bare link get the manifest; browsers get the install page
    const wantsHtml = (req.headers.accept || "").includes("text/html");
    if (path === "/" && !wantsHtml) return send(res, 200, mf);
    if (path === "/" || path === "/configure") {
      const proto = req.headers["x-forwarded-proto"] || "http";
      return send(res, 200, landingPage(`${proto}://${req.headers.host}`, !!linkKey, kidsOnly), "text/html");
    }
    if (path === "/manifest.json") return send(res, 200, mf);

    // Diagnostics page (never shows the key itself)
    if (path === "/health") {
      const keyVars = Object.keys(process.env).filter((k) => /tmdb/i.test(k));
      const out = { version: manifest.version, keyFrom: linkKey ? "install link" : TMDB_KEY ? "server environment" : "none", keyLength: activeKey().length, envVarNamesSeen: keyVars };
      try {
        const t0 = Date.now();
        const d = await tmdb("/trending/movie/week");
        out.tmdb = `OK — ${(d.results || []).length} results in ${Date.now() - t0}ms`;
        out.sample = (d.results || []).slice(0, 3).map((r) => r.title);
      } catch (e) { out.tmdb = "ERROR: " + e.message.split(activeKey() || "\u0000").join("***"); }
      return send(res, 200, out);
    }

    // /catalog/{type}/{id}.json  or  /catalog/{type}/{id}/{extra}.json
    const m = path.match(/^\/catalog\/(movie|series)\/([^/]+?)(?:\/([^/]+))?\.json$/);
    if (m) {
      const [, type, id, extraStr] = m;
      if (!mf.catalogs.some((c) => c.id === id && c.type === type)) return send(res, 404, { metas: [] });
      if (!activeKey()) return send(res, 200, { metas: [] });
      return send(res, 200, await getCatalog(type, id, parseExtra(extraStr && decodeURIComponent(extraStr))));
    }
    return send(res, 404, { error: "not found" });
  } catch (e) {
    console.error("Catalog error:", e.message.split(activeKey() || "\u0000").join("***"));
    return send(res, 200, { metas: [] }); // never break the Stremio board
  }
}

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Kids Corner running → http://127.0.0.1:${PORT}/manifest.json`);
    if (!TMDB_KEY) console.warn("⚠️  Set TMDB_API_KEY (free at https://www.themoviedb.org/settings/api)");
  });
}
module.exports = { server, discoverQuery, manifest };
