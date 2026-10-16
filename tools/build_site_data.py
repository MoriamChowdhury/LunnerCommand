"""
MOONIX - build src/data/siteScience.json from NASA LOLA illumination maps.

Run ONCE on your computer (it is a data-processing tool, not part of the game):

    python tools/build_site_data.py

What it does
  1. Reads the 6 landing sites (latitude / longitude) from src/data/lunarSites.ts,
     so the site list stays in ONE place.
  2. Converts each latitude / longitude to a pixel in the NASA south-polar map.
  3. Reads the real values around that pixel from two NASA maps:
        - average Sun illumination   (AVGVISIB_65S_240M_201608.tiff)
        - average Earth visibility   (AVGVISIB_65S_240M_201608_EARTH.tiff)
  4. Writes small statistics per site to src/data/siteScience.json.

Important facts (put these in the game's "data sources" page)
  - Values are LONG-TERM AVERAGES (simulated over the ~18.6 year lunar nutation
    cycle), NOT the value for one month.
  - "Earth visible" counts Earth as visible if ANY part of its disc is above the
    horizon, so it is slightly optimistic for real radio links.
  - Cite: Mazarico et al. (2011), Icarus 211, pp. 1066-1081.
  - Source: NASA PGDA, https://pgda.gsfc.nasa.gov/products/69
"""

import argparse
import json
import math
import re
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.warp import transform as warp_transform
from rasterio.windows import Window

MOON_RADIUS_M = 1737400.0

SUN_FILE = "AVGVISIB_65S_240M_201608.tiff"
EARTH_FILE = "AVGVISIB_65S_240M_201608_EARTH.tiff"

# How far from each named centre to look for the best spot (km).
# About the feature's radius + 10 km, so the rim is inside the search circle.
# Diameters (IAU/USGS names): Shackleton 21 km, Cabeus 100 km, Haworth 51 km,
# Shoemaker 51 km, de Gerlache 32 km. Malapert is a massif, not a crater.
SEARCH_KM_BY_SITE = {
    "shackleton": 20.0,
    "cabeus": 60.0,
    "haworth": 36.0,
    "shoemaker": 36.0,
    "de-gerlache": 26.0,
    "malapert": 15.0,
}
DEFAULT_SEARCH_KM = 25.0

# "On the crater": best spot within the feature's own RADIUS (rim included).
# Crater floors are often permanently dark, the sunlight is on the rim, so
# 10 km is too small for big craters. Radius = IAU/USGS diameter / 2:
# Shackleton 21 km, Cabeus 100 km, Haworth 51 km, Shoemaker 51 km,
# de Gerlache 32 km. Malapert is a massif, so 15 km is used.
# The game's Sunlight / Earth link / Site Index use this spot.
NEAR_KM_BY_SITE = {
    "shackleton": 10.5,
    "cabeus": 50.0,
    "haworth": 25.5,
    "shoemaker": 25.5,
    "de-gerlache": 16.0,
    "malapert": 15.0,
}
DEFAULT_NEAR_KM = 15.0

CITATION = "Mazarico, E., et al. (2011), Icarus 211, 1066-1081"
SOURCE_URL = "https://pgda.gsfc.nasa.gov/products/69"


# ---------------------------------------------------------------- sites

SITE_PATTERN = re.compile(
    r"id:\s*'([^']+)'.*?"
    r"name:\s*'([^']+)'.*?"
    r"latitude:\s*'([\d.]+)\s*°\s*([NS])'.*?"
    r"longitude:\s*'([\d.]+)\s*°\s*([EW])'",
    re.DOTALL,
)


def read_sites(ts_file: Path):
    """Read id, name, latitude, longitude from lunarSites.ts.
    Latitude: south is negative. Longitude: east is positive, west negative."""
    text = ts_file.read_text(encoding="utf-8")
    sites = []
    for sid, name, lat, ns, lon, ew in SITE_PATTERN.findall(text):
        lat = float(lat) * (-1 if ns == "S" else 1)
        lon = float(lon) * (-1 if ew == "W" else 1)
        sites.append({"id": sid, "name": name, "lat": lat, "lon": lon})
    if not sites:
        sys.exit(f"No sites found in {ts_file}. Is the path right?")
    return sites


# ----------------------------------------------------------- projection

GEO = CRS.from_string(f"+proj=longlat +R={MOON_RADIUS_M} +no_defs")
POLAR = CRS.from_string(
    f"+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 "
    f"+R={MOON_RADIUS_M} +units=m +no_defs"
)


def to_map_xy(lat: float, lon: float):
    """lat/lon (degrees) -> x, y in metres in the NASA south polar map."""
    xs, ys = warp_transform(GEO, POLAR, [lon], [lat])
    x, y = xs[0], ys[0]

    # independent check with the textbook formula (polar stereographic,
    # true scale at the pole): rho = 2 R tan(theta / 2)
    theta = math.radians(lat + 90.0)
    rho = 2 * MOON_RADIUS_M * math.tan(theta / 2)
    hx = rho * math.sin(math.radians(lon))
    hy = rho * math.cos(math.radians(lon))
    if abs(hx - x) > 1.0 or abs(hy - y) > 1.0:
        sys.exit(
            "Projection check FAILED: PROJ and the hand formula disagree "
            f"({x:.1f},{y:.1f}) vs ({hx:.1f},{hy:.1f}). Stop and tell Claude."
        )
    return x, y


# -------------------------------------------------------------- sampling

def sample_site(src, x, y, radius_km):
    scale = src.scales[0] if src.scales and src.scales[0] else 1.0
    nodata = src.nodata

    row, col = src.index(x, y)
    r_px = int(round(radius_km * 1000.0 / src.res[0]))
    size = 2 * r_px + 1
    r0, c0 = row - r_px, col - r_px
    if r0 < 0 or c0 < 0 or r0 + size > src.height or c0 + size > src.width:
        sys.exit("Site window falls outside the map. Reduce --radius-km.")

    raw = src.read(1, window=Window(c0, r0, size, size))

    yy, xx = np.ogrid[-r_px : r_px + 1, -r_px : r_px + 1]
    circle = (xx * xx + yy * yy) <= r_px * r_px
    valid = circle & (raw >= 0)
    if nodata is not None:
        valid &= raw != nodata

    values = raw[valid].astype(np.float64) * scale * 100.0  # percent of time
    if values.size == 0:
        sys.exit("No valid pixels around a site (all no-data).")
    if values.max() > 100.5:
        sys.exit(
            f"Unexpected scaling: max {values.max():.1f} % is above 100 %. "
            "Stop and tell Claude."
        )

    center_raw = raw[r_px, r_px]
    center = None
    if center_raw >= 0 and center_raw != nodata:
        center = float(center_raw) * scale * 100.0

    def r1(v):
        return None if v is None else round(float(v), 1)

    return {
        "row": int(row),
        "col": int(col),
        "pixels": int(values.size),
        "center": r1(center),
        "mean": r1(values.mean()),
        "median": r1(np.median(values)),
        "p10": r1(np.percentile(values, 10)),
        "p90": r1(np.percentile(values, 90)),
        "max": r1(values.max()),
        # share of nearby pixels with exactly 0 % (never lit / never visible)
        "zero_share": r1((values == 0).mean() * 100.0),
    }


def _disc_mean(values, valid, k):
    """Mean of `values` over a (2k+1) x (2k+1) square around every pixel,
    using only valid pixels. Returns (mean, count) arrays (valid area only)."""
    v = np.where(valid, values, 0.0)
    c = valid.astype(np.float64)

    def box(a):
        p = np.pad(a, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
        s = 2 * k + 1
        return p[s:, s:] - p[:-s, s:] - p[s:, :-s] + p[:-s, :-s]

    total, count = box(v), box(c)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = total / count
    return mean, count


def find_best_spot(sun, earth, x, y, search_km, objective, others=(), spot_km=1.0):
    """Search within `search_km` of a site for the best-lit nearby spot.

    objective "both": maximise the average of Sun % and Earth % (power + radio)
    objective "sun" : maximise Sun % only
    Each candidate is judged by its mean over ~`spot_km` around it, so one
    isolated bright pixel cannot win.
    `others` = map x, y of the OTHER sites' centres: a candidate only counts if
    it is nearer to this site's centre than to any other site's centre, so two
    sites can never end up with the same spot.
    Returns the chosen x, y (metres)."""
    res = sun.res[0]
    k = max(1, int(round(spot_km * 1000.0 / res)))
    r_px = int(round(search_km * 1000.0 / res))
    row, col = sun.index(x, y)
    half = r_px + k
    r0, c0, size = row - half, col - half, 2 * half + 1
    if r0 < 0 or c0 < 0 or r0 + size > sun.height or c0 + size > sun.width:
        sys.exit("Search window falls outside the map. Reduce --search-km.")
    win = Window(c0, r0, size, size)

    def pct(src):
        raw = src.read(1, window=win)
        ok = raw >= 0
        if src.nodata is not None:
            ok &= raw != src.nodata
        return raw.astype(np.float64) * src.scales[0] * 100.0, ok

    s_val, s_ok = pct(sun)
    e_val, e_ok = pct(earth)
    s_mean, s_cnt = _disc_mean(s_val, s_ok, k)
    e_mean, e_cnt = _disc_mean(e_val, e_ok, k)

    # grids are shrunk by k on each side: index (i, j) -> window pixel (i+k, j+k)
    n = size - 2 * k
    yy, xx = np.ogrid[-r_px : r_px + 1, -r_px : r_px + 1]
    inside = (xx * xx + yy * yy) <= r_px * r_px
    full = (s_cnt >= 0.9 * (2 * k + 1) ** 2) & (e_cnt >= 0.9 * (2 * k + 1) ** 2)
    score = s_mean if objective == "sun" else (s_mean + e_mean) / 2.0

    # map coordinates (metres) of every candidate pixel centre
    t = sun.transform
    cx = t.c + (c0 + k + np.arange(n) + 0.5) * res
    cy = t.f - (r0 + k + np.arange(n) + 0.5) * res
    GX, GY = np.meshgrid(cx, cy)
    d_own = np.hypot(GX - x, GY - y)
    nearest_is_own = np.ones_like(d_own, dtype=bool)
    for ox, oy in others:
        nearest_is_own &= d_own <= np.hypot(GX - ox, GY - oy)

    score = np.where(inside & full & nearest_is_own, score, -np.inf)
    if not np.isfinite(score).any():
        sys.exit("No usable spot found near a site. Tell Claude.")
    i, j = np.unravel_index(np.argmax(score), score.shape)

    brow, bcol = r0 + i + k, c0 + j + k
    bx, by = sun.xy(brow, bcol)  # centre of the chosen pixel
    return bx, by


def map_xy_to_latlon(x, y):
    lons, lats = warp_transform(POLAR, GEO, [x], [y])
    return lats[0], lons[0]


def source_info(src, filename):
    t = src.tags()
    clean = lambda k: str(t.get(k, "")).strip('"')
    return {
        "file": filename,
        "product_id": clean("PRODUCT_ID"),
        "dataset_id": clean("DATA_SET_ID"),
        "instrument": clean("INSTRUMENT_NAME"),
        "producer": clean("PRODUCER_INSTITUTION_NAME"),
        "topography_start": clean("START_TIME"),
        "topography_stop": clean("STOP_TIME"),
        "product_created": clean("PRODUCT_CREATION_TIME"),
        "pixel_size_m": src.res[0],
        "scale": src.scales[0],
    }


# ------------------------------------------------------------------ main

def main():
    here = Path(__file__).resolve().parent
    project = here.parent

    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--raw-dir", default=str(here / "raw"))
    ap.add_argument("--sites-file", default=str(project / "src/data/lunarSites.ts"))
    ap.add_argument("--out", default=str(project / "src/data/siteScience.json"))
    ap.add_argument("--radius-km", type=float, default=10.0,
                    help="look at pixels within this distance of each site")
    ap.add_argument("--search-km", type=float, default=None,
                    help="use ONE search distance for every site "
                         "(default: a different distance per site, see SEARCH_KM_BY_SITE)")
    ap.add_argument("--objective", choices=["both", "sun"], default="both",
                    help="best spot = highest (Sun+Earth)/2 [both] or Sun only [sun]")
    args = ap.parse_args()

    raw_dir = Path(args.raw_dir)
    sun_path = raw_dir / SUN_FILE
    earth_path = raw_dir / EARTH_FILE
    for p in (sun_path, earth_path):
        if not p.exists():
            sys.exit(f"Missing file: {p}")

    sites = read_sites(Path(args.sites_file))
    result = {
        "generated_by": "tools/build_site_data.py",
        "what_this_is": (
            "Long-term AVERAGE percent of time, from NASA LRO/LOLA polar "
            "illumination maps. Not a value for one specific month."
        ),
        "radius_km": args.radius_km,
        "citation": CITATION,
        "source_url": SOURCE_URL,
        "sources": {},
        "sites": {},
    }

    with rasterio.open(sun_path) as sun, rasterio.open(earth_path) as earth:
        if sun.shape != earth.shape or sun.transform != earth.transform:
            sys.exit("The two maps do not have the same grid. Wrong files?")
        result["sources"] = {
            "sun": source_info(sun, SUN_FILE),
            "earth": source_info(earth, EARTH_FILE),
        }

        centres = {s["id"]: to_map_xy(s["lat"], s["lon"]) for s in sites}

        for s in sites:
            x, y = centres[s["id"]]
            others = [c for sid, c in centres.items() if sid != s["id"]]

            # best-lit nearby spot (a crater centre is usually a dark floor)
            search_km = (
                args.search_km
                if args.search_km is not None
                else SEARCH_KM_BY_SITE.get(s["id"], DEFAULT_SEARCH_KM)
            )
            bx, by = find_best_spot(
                sun, earth, x, y, search_km, args.objective, others
            )
            blat, blon = map_xy_to_latlon(bx, by)
            dist_km = math.hypot(bx - x, by - y) / 1000.0

            near_km = NEAR_KM_BY_SITE.get(s["id"], DEFAULT_NEAR_KM)
            nx, ny = find_best_spot(
                sun, earth, x, y, near_km, args.objective, others
            )
            nlat, nlon = map_xy_to_latlon(nx, ny)
            near_dist_km = math.hypot(nx - x, ny - y) / 1000.0

            result["sites"][s["id"]] = {
                "name": s["name"],
                "latitude": s["lat"],
                "longitude_east": s["lon"],
                "map_x_m": round(x, 1),
                "map_y_m": round(y, 1),
                # statistics around the named feature's centre
                "sun": sample_site(sun, x, y, args.radius_km),
                "earth": sample_site(earth, x, y, args.radius_km),
                # best spot AT the crater (within NEAR_KM): used by the game
                "near_spot": {
                    "how_chosen": (
                        f"highest {'Sun %' if args.objective == 'sun' else 'average of Sun % and Earth %'} "
                        f"within {near_km} km (the crater's own radius) of the site centre, judged over ~1 km"
                    ),
                    "latitude": round(nlat, 3),
                    "longitude_east": round(nlon, 3),
                    "search_radius_km": near_km,
                    "distance_from_centre_km": round(near_dist_km, 1),
                    "sun": sample_site(sun, nx, ny, 1.0),
                    "earth": sample_site(earth, nx, ny, 1.0),
                },
                # best spot in a wider area (maybe a ridge far from the centre)
                "best_spot": {
                    "how_chosen": (
                        f"highest {'Sun %' if args.objective == 'sun' else 'average of Sun % and Earth %'} "
                        f"within {search_km} km of the site centre, judged over ~1 km"
                    ),
                    "latitude": round(blat, 3),
                    "longitude_east": round(blon, 3),
                    "search_radius_km": search_km,
                    "distance_from_centre_km": round(dist_km, 1),
                    "sun": sample_site(sun, bx, by, 1.0),
                    "earth": sample_site(earth, bx, by, 1.0),
                },
            }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n",
                   encoding="utf-8")

    # --- readable table
    print(f"\nWrote {out}  (radius {args.radius_km} km around each site)\n")
    head = f"{'site':<22}{'SUN %':>34}   {'EARTH %':>34}"
    sub = f"{'':<22}{'center':>8}{'mean':>7}{'p90':>7}{'dark':>7}   {'center':>8}{'mean':>7}{'p90':>7}{'none':>7}"
    print(head)
    print(sub)
    fmt = lambda v: "   n/a" if v is None else f"{v:7.1f}"
    for sid, d in result["sites"].items():
        su, ea = d["sun"], d["earth"]
        print(
            f"{d['name']:<22}"
            f"{fmt(su['center']):>8}{fmt(su['mean'])}{fmt(su['p90'])}{fmt(su['zero_share'])}   "
            f"{fmt(ea['center']):>8}{fmt(ea['mean'])}{fmt(ea['p90'])}{fmt(ea['zero_share'])}"
        )
    print("\ndark = % of nearby pixels never lit; none = % never in view of Earth")

    print(f"\nBEST NEARBY SPOT (objective: {args.objective})\n")
    print(f"{'site':<22}{'lat':>8}{'lon E':>9}{'km':>6}{'of max':>8}{'SUN %':>8}{'EARTH %':>9}")
    for sid, d in result["sites"].items():
        b = d["best_spot"]
        print(
            f"{d['name']:<22}{b['latitude']:8.2f}{b['longitude_east']:9.2f}"
            f"{b['distance_from_centre_km']:6.1f}"
            f"{b['search_radius_km']:8.0f}"
            f"{fmt(b['sun']['mean'])}{fmt(b['earth']['mean']):>9}"
        )
    print("\nON THE CRATER (best spot within the crater's own radius, used by the game)\n")
    print(f"{'site':<22}{'km':>6}{'of max':>8}{'SUN %':>8}{'EARTH %':>9}")
    for sid, d in result["sites"].items():
        n = d["near_spot"]
        print(
            f"{d['name']:<22}{n['distance_from_centre_km']:6.1f}"
            f"{n['search_radius_km']:8.1f}"
            f"{fmt(n['sun']['mean'])}{fmt(n['earth']['mean']):>9}"
        )
    spots = [(sid, d["best_spot"]) for sid, d in result["sites"].items()]
    for a in range(len(spots)):
        for b in range(a + 1, len(spots)):
            la1, lo1 = math.radians(spots[a][1]["latitude"]), math.radians(spots[a][1]["longitude_east"])
            la2, lo2 = math.radians(spots[b][1]["latitude"]), math.radians(spots[b][1]["longitude_east"])
            # great-circle distance on the Moon (haversine), in km
            h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
            km = 2 * MOON_RADIUS_M / 1000.0 * math.asin(math.sqrt(h))
            if km < 2.0:
                print(f"\nWARNING: {spots[a][0]} and {spots[b][0]} have almost the same best spot ({km:.1f} km apart).")

    print("\n(km = distance of the chosen spot from the named centre; "
          "of max = the search limit used.\n If km is close to 'of max', the best "
          "spot may lie even further out.)")


if __name__ == "__main__":
    main()