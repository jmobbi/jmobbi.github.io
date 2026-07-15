#!/usr/bin/env python3
"""
Refresh the on-disk screenshot cache used as a fallback when the App Store
can't be reached from the browser.

Run from the project root:

    python3 screenshots/generate_screenshots.py

It writes screenshots/<appid>/1.jpg, 2.jpg, ... (up to 6) per app,
using the App Store's iPhone screenshots (falling back to iPad).
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
    "6480405624",  # Exchange Converter
]

COUNTRY = "us"
MAX_SHOTS = 6
UA = {"User-Agent": "Mozilla/5.0"}
OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25)


def main():
    for appid in APP_IDS:
        try:
            data = json.load(get(f"https://itunes.apple.com/{COUNTRY}/lookup?id={appid}"))
            if not data.get("resultCount"):
                print(f"{appid}: no App Store result")
                continue
            r = data["results"][0]
            shots = (r.get("screenshotUrls") or r.get("ipadScreenshotUrls") or [])[:MAX_SHOTS]
            if not shots:
                print(f"{appid}: no screenshots available from the App Store")
                continue
            d = os.path.join(OUT_DIR, appid)
            os.makedirs(d, exist_ok=True)
            saved = 0
            for i, u in enumerate(shots, 1):
                try:
                    blob = get(u).read()
                    with open(os.path.join(d, f"{i}.jpg"), "wb") as f:
                        f.write(blob)
                    saved += 1
                except Exception as ex:
                    print(f"  {appid} shot {i} failed: {ex}")
                time.sleep(0.3)
            print(f"{appid}: saved {saved} screenshots -> {d}")
        except Exception as ex:
            print(f"{appid}: ERROR {ex}")
        time.sleep(1.0)


if __name__ == "__main__":
    main()
