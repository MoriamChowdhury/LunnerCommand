# Moonix: Data Sources and Honest Limits

Moonix is an **educational game**, not a mission-planning tool. This file lists
which numbers come from NASA data and which are game design, so nothing is
hidden. The game also shows these labels on screen:
**NASA-BASED**, **GAME ESTIMATE**, **NEEDS CHECKING**.

## 1. What is real NASA data

| In the game | Source | How we used it |
|---|---|---|
| **Sunlight %** and **Earth link %** of each site | NASA LRO / LOLA polar illumination maps, [PGDA product 69](https://pgda.gsfc.nasa.gov/products/69): `AVGVISIB_65S_240M_201608` (Sun) and `..._EARTH` (Earth). Mazarico et al. (2011), *Icarus* 211, 1066-1081. | Best spot on each crater (inside its own radius, rim included), averaged over about 1 km. |
| **Monthly Sun / Earth** in the 12 launch windows | [NASA JPL Horizons](https://ssd.jpl.nasa.gov/api/horizons.api) (positions of the Sun and Earth seen from a point on the Moon, every hour of 2027) | Counted the % of each month above the horizon, then scaled so the yearly average equals the LOLA value above. |
| **Site coordinates** | IAU / USGS Gazetteer of Planetary Nomenclature | Checked and corrected by hand. |
| **Site Index** | Our own formula | Average of the Sun % and Earth link % above. |

Current values (best spot on the crater, long-term average):

| Site | Sun % | Earth link % | Spot distance from centre |
|---|---|---|---|
| Shackleton | 47 | 56 | 10.0 km (limit 10.5) |
| Cabeus | 51 | 100 | 40.9 km (limit 50) |
| Haworth | 30 | 67 | 23.8 km (limit 25.5) |
| Shoemaker | 31 | 54 | 25.2 km (limit 25.5) |
| Malapert | 51 | 100 | 4.9 km (limit 15) |
| de Gerlache | 49 | 61 | 15.9 km (limit 16) |

The raw results are in `src/data/siteScience.json` and
`src/data/launchWindowsScience.json`. The game reads these files directly.

## 2. What is a game estimate (not NASA data)

- Terrain, risk, temperature and ice labels (`NEEDS CHECKING` / `GAME ESTIMATE` on screen)
- Equipment costs, masses and effects, the budget, and all pass/fail thresholds
- Solar activity per month (nobody can predict it month by month)
- The Site Index levels (OPTIMAL 70, FAVORABLE 55, VIABLE 45) and the Descent Readiness bars
- All story text, crew, voices and the lessons shown after a mission

## 3. Limits you should know

1. **Long-term averages.** The LOLA maps give the average over about 18.6 years, not a value for one month.
2. **The "best spot" is not a safe landing site.** Slopes, rocks and landing safety are **not** checked. Crater floors are often permanently dark, so the game uses the sunniest spot on the crater, rim included.
3. **Earth link counts "any part of the Earth's disc"**, so it is slightly optimistic.
4. **Monthly values assume a flat horizon** (no mountains). We scale them to the LOLA terrain average, which is a simple game model. Real months would differ.
5. **Resolution is 240 m per pixel.** Small features are not captured.
6. **Water ice is not modelled from data yet.** Possible future sources: LCROSS, LEND, Diviner (temperature), LOLA 5 m slopes.

## 4. Rebuilding the data (optional)

Needs Python 3 with `rasterio` and `numpy` in a virtual environment inside `tools/`
(not part of the game).

```bash
# from the project folder, Git Bash on Windows
python -m venv tools/.venv
source tools/.venv/Scripts/activate     # on Mac/Linux: source tools/.venv/bin/activate
pip install rasterio numpy

# 1. download the two TIFF files from the PGDA link above into tools/raw/
python tools/build_site_data.py          # writes src/data/siteScience.json
python tools/build_window_data.py        # writes src/data/launchWindowsScience.json (needs internet)
```

`tools/raw/` and `tools/.venv/` are not committed to git (see `.gitignore`).