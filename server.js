// Kids Corner — a Stremio catalog add-on (no dependencies, Node 18+)
// Adds Netflix-style rows of kid-friendly content to the Stremio home screen.
// Data: The Movie Database (TMDB). Needs a free TMDB API key.

const http = require("http");

const PORT = process.env.PORT || 7000;
const TMDB_KEY = process.env.TMDB_API_KEY || "";
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
  version: "1.0.0",
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

async function tmdb(path, params = {}) {
  const url = new URL(TMDB + path);
  url.searchParams.set("api_key", TMDB_KEY);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}`);
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
      return ["/discover/movie", {
        ...movieBase,
        sort_by: "popularity.desc",
        with_genres: "10751|16",
        with_release_type: "4|5", // digital or physical = watchable at home
        "release_date.gte": daysAgo(180),
        "release_date.lte": today(),
      }];
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
    const data = await tmdb(q[0], q[1]);
    const keep = q[2] || (() => true);
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

function landingPage(host) {
  const manifestUrl = `${host}/manifest.json`;
  const stremioUrl = manifestUrl.replace(/^https?:\/\//, "stremio://");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Home Rows for Stremio</title>
<style>
body{margin:0;font-family:system-ui,sans-serif;background:#141414;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}
.c{max-width:520px;padding:32px}h1{font-size:44px;margin:0 0 8px;color:#e50914;letter-spacing:-1px}
p{color:#bbb;line-height:1.5}a.b{display:inline-block;margin:10px 6px;padding:14px 26px;border-radius:6px;font-weight:700;text-decoration:none}
.r{background:#e50914;color:#fff}.g{background:#333;color:#fff}code{background:#222;padding:6px 10px;border-radius:4px;display:block;margin-top:16px;word-break:break-all;color:#ddd}
.warn{color:#ffb347}</style></head><body><div class="c">
<h1>🍿 Home Rows</h1><p>Trending and new movies and series in English and Hindi, plus a kids section, as rows on your Stremio home screen.</p>
${TMDB_KEY ? "" : '<p class="warn">⚠️ TMDB_API_KEY is not set on the server, so rows will be empty.</p>'}
<a class="b r" href="${stremioUrl}">Install in Stremio</a>
<a class="b g" href="https://web.stremio.com/#/addons?addon=${encodeURIComponent(manifestUrl)}">Install on Stremio Web</a>
<p>Or paste this into Stremio → Add-ons → search box:</p><code>${manifestUrl}</code></div></body></html>`;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, "");
  const url = new URL(req.url, "http://x");
  const path = url.pathname;
  try {
    if (path === "/" || path === "/configure") {
      const proto = req.headers["x-forwarded-proto"] || "http";
      return send(res, 200, landingPage(`${proto}://${req.headers.host}`), "text/html");
    }
    if (path === "/manifest.json") return send(res, 200, manifest);

    // /catalog/{type}/{id}.json  or  /catalog/{type}/{id}/{extra}.json
    const m = path.match(/^\/catalog\/(movie|series)\/([^/]+?)(?:\/([^/]+))?\.json$/);
    if (m) {
      const [, type, id, extraStr] = m;
      if (!manifest.catalogs.some((c) => c.id === id && c.type === type)) return send(res, 404, { metas: [] });
      if (!TMDB_KEY) return send(res, 200, { metas: [] });
      return send(res, 200, await getCatalog(type, id, parseExtra(extraStr && decodeURIComponent(extraStr))));
    }
    return send(res, 404, { error: "not found" });
  } catch (e) {
    console.error(e.message);
    return send(res, 200, { metas: [] }); // never break the Stremio board
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Kids Corner running → http://127.0.0.1:${PORT}/manifest.json`);
    if (!TMDB_KEY) console.warn("⚠️  Set TMDB_API_KEY (free at https://www.themoviedb.org/settings/api)");
  });
}
module.exports = { server, discoverQuery, manifest };
