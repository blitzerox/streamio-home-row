# Netflix-Style Home: English & Hindi — Stremio add-on (plus Kids Only Home)

Adds these rows to your Stremio home screen (Board), each a scrolling row of posters, like Netflix:

**English** (top of the home screen)
- 🔥 Trending Movies (TMDB's weekly trending chart)
- 🔥 Trending Series
- 🆕 New Movie Releases (now out on streaming or disc; filter by genre in Discover)
- 🆕 New Series
- ⭐ Top Rated Movies of the Year

**Hindi**
- 🇮🇳 Trending Hindi Movies
- 🇮🇳 New Hindi Releases
- 🇮🇳 Trending Hindi Series
- 🇮🇳 New Hindi Series
- 🇮🇳 All-Time Great Hindi Movies

Kids rows only include movies rated PG or lower and leave out horror, thriller, crime and war. Data comes from TMDB and refreshes every 6 hours. Items use IMDb ids, so tapping one opens the normal Stremio page and your other add-ons can supply streams.

This add-on only lists titles. It does not supply streams.

## 1. Get a free TMDB API key (about 2 minutes)
1. Sign up at https://www.themoviedb.org/signup
2. Go to Settings → API → request an API key (choose "Developer" and "Personal use").
3. Copy the **API Key** (the short one, not the long "Read Access Token").

## 2. Host it (free, about 5 minutes) on Render
Stremio on phones and TVs needs an `https://` address, so host it online:
1. Create a free GitHub account and a new repository. Upload `server.js`, `package.json` and `README.md`.
2. Sign up at https://render.com, then choose **New → Web Service** and pick your repository.
3. Use these settings: Runtime **Node**, Build command `npm install`, Start command `npm start`, Instance type **Free**.
4. Under **Environment**, add `TMDB_API_KEY` = your key.
5. Deploy. You'll get a URL like `https://kids-corner.onrender.com`.

(Render's free tier sleeps when idle, so the first load after a break takes about 30 seconds.)

## 3. Install in Stremio

If you'd rather not set the key on Render, open your Render link, paste your TMDB key into the box, and tap Install. The key is then kept only in your personal install link, so don't share that link.

Open your Render URL in a browser and tap **Install in Stremio**.
Or open Stremio → Add-ons, then paste `https://YOUR-URL/manifest.json` into the search box.

**Netflix-style home screen:** in Stremio's Add-ons list, drag Netflix-Style Home to the top. Its rows then appear first on the Board.

## Kids-only version
Kids rows are only in the separate **Kids Only Home** add-on, not the main one. For a child's Stremio profile, install `https://YOUR-URL/kids/manifest.json` (or open `/kids/configure`). It shows New for Kids, Trending Kids Movies, Trending Kids Shows, New Kids Shows, Top Rated Family Movies and Hindi Kids & Family Movies. Adult rows are blocked on that link.

## Options (environment variables)
| Variable | Default | Meaning |
|---|---|---|
| `TMDB_API_KEY` | – | Required |
| `MAX_CERT` | `PG` | Set to `G` for little kids only |
| `REGION` | `AU` | Release region |
| `CERT_COUNTRY` | `US` | Ratings system used for the kids filter |

## Run on a computer instead
Install Node 18+, then run `TMDB_API_KEY=yourkey npm start` and install `http://127.0.0.1:7000/manifest.json` in Stremio on the same computer.
