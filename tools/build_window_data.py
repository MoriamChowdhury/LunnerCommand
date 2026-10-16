"""
build_window_data.py  -  real monthly Sun and Earth visibility for each Moonix site.
Asks NASA JPL Horizons (public, free, no key) where the Sun and Earth are in the
sky of a point on the Moon, every hour for one year, then counts the % of each
month that each is above the horizon.
FLAT HORIZON: no mountains or crater walls, so real values can be lower.
Needs only Python 3. Output: src/data/launchWindowsScience.json
"""
import argparse
import calendar
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
SUN_RADIUS_DEG = 0.267      # upper limb of the Sun
EARTH_RADIUS_DEG = 0.95     # Earth's disc as seen from the Moon
MONTHS = {m: i for i, m in enumerate(calendar.month_abbr) if m}


def ask_horizons(body, lon_east, lat, year):
    params = {
        "format": "text",
        "COMMAND": f"'{body}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon_east:.4f},{lat:.4f},0'",
        "START_TIME": f"'{year}-01-01 00:00'",
        "STOP_TIME": f"'{year + 1}-01-01 00:00'",
        "STEP_SIZE": "'60 min'",
        "QUANTITIES": "'4'",
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
        "CAL_FORMAT": "'CAL'",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "moonix-student-project"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode("utf-8", errors="replace")


def parse_elevations(text):
    if "$$SOE" not in text:
        raise RuntimeError("Horizons did not return data. Its message was:\n" + text[:1500])
    block = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    rows = []
    for line in block.strip().splitlines():
        m = re.search(r"(\d{4})-([A-Za-z]{3})-(\d{2})", line)
        if not m:
            continue
        nums = []
        for f in line.split(",")[1:]:
            try:
                nums.append(float(f))
            except ValueError:
                pass
        if len(nums) < 2:
            continue
        rows.append((MONTHS[m.group(2).title()], nums[1]))
    if not rows:
        raise RuntimeError("Could not read any rows. First lines:\n" + block[:600])
    return rows


def monthly_percent(rows, limb_deg):
    up = [0] * 13
    tot = [0] * 13
    for month, el in rows:
        tot[month] += 1
        if el > -limb_deg:
            up[month] += 1
    return [round(100.0 * up[m] / tot[m], 1) if tot[m] else None for m in range(1, 13)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--science", default="src/data/siteScience.json")
    ap.add_argument("--out", default="src/data/launchWindowsScience.json")
    ap.add_argument("--year", type=int, default=2027)
    args = ap.parse_args()

    sci = json.loads(Path(args.science).read_text(encoding="utf-8"))
    out = {
        "generated_by": "tools/build_window_data.py",
        "what_this_is": (
            "Percent of each month that the Sun / Earth is above the horizon at the "
            "site's game spot, FLAT horizon (no terrain), from NASA JPL Horizons."
        ),
        "year": args.year,
        "source": "NASA JPL Horizons (ssd.jpl.nasa.gov/api/horizons.api)",
        "sites": {},
    }

    for sid, d in sci["sites"].items():
        spot = d["near_spot"]
        lat, lon = spot["latitude"], spot["longitude_east"]
        print(f"Asking Horizons for {d['name']} ({lat}, {lon}) ...", flush=True)
        sun_rows = parse_elevations(ask_horizons("10", lon, lat, args.year))
        time.sleep(1)
        earth_rows = parse_elevations(ask_horizons("399", lon, lat, args.year))
        time.sleep(1)
        sun = monthly_percent(sun_rows, SUN_RADIUS_DEG)
        earth = monthly_percent(earth_rows, EARTH_RADIUS_DEG)
        out["sites"][sid] = {
            "name": d["name"],
            "latitude": lat,
            "longitude_east": lon,
            "sun_by_month": sun,
            "earth_by_month": earth,
            "sun_year_mean": round(sum(sun) / 12, 1),
            "earth_year_mean": round(sum(earth) / 12, 1),
            "lola_sun_mean": spot["sun"]["mean"],
            "lola_earth_mean": spot["earth"]["mean"],
        }

    Path(args.out).write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")

    names = [m for m in calendar.month_abbr if m]
    print(f"\nWrote {args.out}\n\nSUN % of month above a flat horizon ({args.year})")
    print(f"{'site':<20}" + "".join(f"{n:>6}" for n in names) + f"{'year':>7}{'LOLA':>7}")
    for sid, v in out["sites"].items():
        print(f"{v['name']:<20}" + "".join(f"{x:6.0f}" for x in v["sun_by_month"])
              + f"{v['sun_year_mean']:7.0f}{v['lola_sun_mean']:7.0f}")
    print(f"\nEARTH % of month above a flat horizon ({args.year})")
    print(f"{'site':<20}" + "".join(f"{n:>6}" for n in names) + f"{'year':>7}{'LOLA':>7}")
    for sid, v in out["sites"].items():
        print(f"{v['name']:<20}" + "".join(f"{x:6.0f}" for x in v["earth_by_month"])
              + f"{v['earth_year_mean']:7.0f}{v['lola_earth_mean']:7.0f}")
    print("\nLOLA = long-term average WITH terrain (from siteScience.json). "
          "Flat-horizon values should be equal or higher.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.exit(f"\nERROR: {e}")