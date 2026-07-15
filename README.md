# jmobbi

**Just Mobbi it.**

Marketing website for **jmobbi** — fast, privacy-first iOS and Mac apps trusted by over 2 million
people. It is a static site hosted on GitHub Pages at **[jmobbi.com](https://jmobbi.com)**.

## Apps

| App | Cloud | App Store |
|-----|-------|-----------|
| Musicbox | Dropbox | id1212543936 |
| GoPlayer | Google Drive | id1159282786 |
| MPlayer | MEGA.NZ | id1097961510 |
| YaPlayer | Yandex.Disk | id1103650450 |
| FirePlayer | MediaFire | id1212543917 |
| Money Currency Converter | — | id6480405624 |

## Project structure

```
index.html                 Homepage
<app>.html                 App detail pages (musicbox, goplayer, mplayer, yaplayer, fireplayer, exchange)
support.html               Support hub: how-to guides + FAQ
privacy_policy.html        Privacy policy
terms.html                 Terms & conditions
how-to/                    9 SEO/GEO-optimized how-to articles
assets/
  css/main.css             Base stylesheet
  css/custom.css           jmobbi theme (white/red landing design)
  js/reviews.js            App Store reviews wall (web + cache, deduped)
  js/appstore.js           App icon + screenshots loader (web + cache fallback)
images/
  services/                App icons
  og-banner.png            1200x630 social share banner
reviews/                   Cached App Store reviews per app (<appid>_reviews.json)
  generate_reviews.py      Refreshes the review cache (all App Store countries)
screenshots/               Cached App Store screenshots per app (<appid>/N.jpg)
  generate_screenshots.py  Refreshes the screenshot cache
sitemap.xml, robots.txt, llms.txt   SEO / GEO files
favicon.*, apple-touch-icon.png     Favicons (the "jm" mark)
CNAME                      Custom domain (jmobbi.com)
```

## Local preview

The pages fetch live data from the App Store, which browsers block from `file://` URLs, so serve
the folder over HTTP:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## App Store reviews

Each reviews section loads reviews **live from the App Store RSS feed** and **mixes them with an
on-disk cache**, deduplicated by review id and filtered by the ratings passed in the markup:

```html
<div class="app-reviews" data-app-id="1159282786" data-ratings="3,4,5"></div>
```

- `data-app-id` accepts one id or a comma-separated list (the homepage passes all apps).
- `data-ratings` selects which star scores to show.
- The cache (`reviews/<appid>_reviews.json`) is multilingual — collected across every App Store
  country — so reviews still appear when the live feed is unavailable (including offline).

Refresh the cache:

```bash
python3 reviews/generate_reviews.py
```

## Screenshots

App pages load screenshots from the App Store and fall back to the cached copies in
`screenshots/<appid>/` when it can't be reached. Refresh with:

```bash
python3 screenshots/generate_screenshots.py
```

## SEO & GEO

- `sitemap.xml`, `robots.txt` (AI crawlers welcomed) and `llms.txt`.
- Canonical URLs, Open Graph / Twitter cards on every page.
- Structured data (JSON-LD): `SoftwareApplication` (app pages), `Organization` + `WebSite`
  (homepage), `FAQPage` (support + articles) and `HowTo` (articles).

## Contact

support@jmobbi.com
