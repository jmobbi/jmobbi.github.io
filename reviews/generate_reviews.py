#!/usr/bin/env python3
"""
Refresh the on-disk review cache used as a fallback / supplement when the
App Store RSS feed can't be reached from the browser.

Reviews are collected across many App Store countries and merged into one
file per app, deduplicated by review id and sorted by date (newest first):

    reviews/<appid>_reviews.json

Each entry: { id, country, author, rating, title, body, date }

Run from the project root:

    python3 reviews/generate_reviews.py
"""
import json
import os
import time
import urllib.request

APP_IDS = [
    "1212543936",  # Musicbox
    "1159282786",  # GoPlayer
    "1097961510",  # MPlayer
    "1103650450",  # YaPlayer
    "1212543917",  # FirePlayer
    "6480405624",  # Money Currency Converter
]

# Every App Store storefront, so reviews are captured in all languages.
COUNTRIES = [
    "dz", "ao", "ai", "ag", "ar", "am", "au", "at", "az", "bh",
    "bb", "by", "be", "bz", "bj", "bm", "bt", "bo", "bw", "br",
    "vg", "bn", "bg", "bf", "kh", "cm", "ca", "cv", "ky", "td",
    "cl", "cn", "co", "cg", "cr", "ci", "hr", "cy", "cz", "dk",
    "dm", "do", "ec", "eg", "sv", "ee", "sz", "fj", "fi", "fr",
    "ga", "gm", "ge", "de", "gh", "gr", "gd", "gt", "gw", "gy",
    "hn", "hk", "hu", "is", "in", "id", "iq", "ie", "il", "it",
    "jm", "jp", "jo", "kz", "ke", "kr", "kw", "kg", "la", "lv",
    "lb", "lr", "ly", "lt", "lu", "mo", "mg", "mw", "my", "mv",
    "ml", "mt", "mr", "mu", "mx", "fm", "md", "mn", "me", "ms",
    "ma", "mz", "mm", "na", "nr", "np", "nl", "nz", "ni", "ne",
    "ng", "mk", "no", "om", "pk", "pw", "pa", "pg", "py", "pe",
    "ph", "pl", "pt", "qa", "ro", "ru", "rw", "kn", "lc", "vc",
    "st", "sa", "sn", "rs", "sc", "sl", "sg", "sk", "si", "sb",
    "za", "es", "lk", "sr", "se", "ch", "tw", "tj", "tz", "th",
    "tn", "tr", "tm", "tc", "ug", "ua", "ae", "gb", "us", "uy",
    "uz", "ve", "vn", "ye", "zm", "zw",
]

MAX_PAGES = 3
UA = {"User-Agent": "Mozilla/5.0"}
OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def fetch_page(appid, country, page):
    url = (f"https://itunes.apple.com/{country}/rss/customerreviews/"
           f"page={page}/id={appid}/sortby=mostrecent/json")
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def normalize(e, country):
    return {
        "id": e.get("id", {}).get("label"),
        "country": country,
        "author": e.get("author", {}).get("name", {}).get("label"),
        "rating": int(e["im:rating"]["label"]),
        "title": e.get("title", {}).get("label"),
        "body": e.get("content", {}).get("label"),
        "date": e.get("updated", {}).get("label", ""),
    }


def collect(appid):
    seen, reviews = set(), []
    for country in COUNTRIES:
        for page in range(1, MAX_PAGES + 1):
            data = None
            for _ in range(2):  # one retry on hiccup/throttle
                try:
                    data = fetch_page(appid, country, page)
                    break
                except Exception:
                    time.sleep(1.5)
            if data is None:
                break
            entries = data.get("feed", {}).get("entry", []) or []
            if not isinstance(entries, list):
                entries = [entries]
            rated = [normalize(e, country) for e in entries
                     if isinstance(e, dict) and "im:rating" in e]
            if not rated:
                break
            added = 0
            for r in rated:
                if r["id"] and r["id"] not in seen:
                    seen.add(r["id"])
                    reviews.append(r)
                    added += 1
            if added == 0:
                break
            time.sleep(0.35)
        time.sleep(0.25)
    reviews.sort(key=lambda r: r.get("date") or "", reverse=True)
    return reviews


def main():
    for appid in APP_IDS:
        reviews = collect(appid)
        path = os.path.join(OUT_DIR, f"{appid}_reviews.json")
        with open(path, "w") as f:
            json.dump(reviews, f, ensure_ascii=False, indent=1)
        countries = len({r["country"] for r in reviews})
        print(f"{appid}: {len(reviews)} reviews from {countries} countries -> {path}")


if __name__ == "__main__":
    main()
