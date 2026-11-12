# MOONIX

**Beyond Earth. Into the Unknown.**

MOONIX is an interactive lunar mission planner and simulation game. It helps students, teachers and planners compare landing sites near the Moon's south pole, see how the Sun and Earth move relative to the horizon through the year, and learn how sunlight and Earth contact decide whether a lander survives.

Built by **Team Lunar Odyssey** for the **NASA Space Apps Challenge 2026**, challenge: **Lunar Landing Site Navigator**.




---

## The problem

Missions to the Moon's south pole face extreme lighting and communication limits. Some places get sunlight for weeks, others stay dark forever, and Earth can be hidden behind the horizon. Existing tools can be hard to use. MOONIX turns real NASA illumination and sky data into something anyone can explore: pick a site, pick a month, and see what it means for power and for the radio link to Earth.

## What you can do in MOONIX

**1. Choose a landing site**
- Six south pole sites: Shackleton, Cabeus, Haworth, Shoemaker, Malapert Massif and de Gerlache.
- Sunlight %, Earth-link %, ice, temperature and risk for each site.
- A Site Index, the average of Sun % and Earth-link %.
- Rim or Floor: the rim is the best-lit spot on the crater; the floor is the crater centre, often permanently dark but where ice can survive.
- Every number is labeled **NASA-based**, **Game estimate** or **Needs checking**.

**2. Build the lander**
- Nine modules: solar array, battery, relay antenna, thermal shield, storm shelter, ice drill, science lab, terrain vehicle and nuclear power unit.
- A $500M budget and a 1,500 kg mass limit.
- Live Mission Readiness score, site-based recommendations, and Auto-configure.
- Voice commands, for example "install solar".

**3. Mission Control**
- Pick a launch month and see the Sun and Earth height against the horizon (NASA JPL Horizons data for 2027).
- Monthly Sun and Earth numbers, a power forecast, and alerts for radio blackout, low power, cold and radiation.
- On a dark crater floor the sky chart is replaced by the NASA average, so it does not mislead.
- LUNA / CAPCOM voice assistant and a GO / NO-GO poll.

**4. Land and learn**
- Animated descent from 100 km with a live check of Power, Earth link and Crew safety.
- Success gives stars, science points and a first-try bonus (saved in the browser).
- Failure shows what went wrong and which affordable fix would help. The Repair Bay lets you fix the lander and try again.
- Results report, four lessons, Mission Replay and a Mission Journal.

**5. Honest data**
- A **Data Sources** button on every screen separates NASA data, our method, game estimates and limits.

---

## Data sources

| Data | Used for | Source |
|---|---|---|
| LRO/LOLA polar illumination: average solar illumination and average Earth visibility, 65°S–90°S, 240 m/pixel (`AVGVISIB_65S_240M_201608`, `AVGVISIB_65S_240M_201608_EARTH`) | Sunlight % and Earth-link % at each site and crater floor | https://pgda.gsfc.nasa.gov/products/69 |
| NASA JPL Horizons | Sun and Earth height in the sky at each site, for 2027 | https://ssd.jpl.nasa.gov/horizons/ |
| IAU / USGS Gazetteer of Planetary Nomenclature | Site names and coordinates | https://planetarynames.wr.usgs.gov/ |

**Citation for the illumination maps:** Mazarico, E., et al. (2011), *Illumination conditions of the lunar polar regions using LOLA topography*, Icarus 211, 1066–1081, doi:10.1016/j.icarus.2010.10.030.

More detail is in [`DATA_SOURCES.md`](DATA_SOURCES.md).

### How the monthly numbers are made

1. The LOLA maps give long-term **averages** (hourly steps over 18.6 years), including shadows from mountains. They are not monthly values.
2. JPL Horizons gives the **season pattern** for each month, for a flat horizon.
3. We scale that pattern so its yearly average equals the NASA LOLA value, and cap it at 100%.

This is a simple model made by our team. It is not an official NASA product.

### What is a game estimate (not NASA data)

- Signal strength, oxygen, fuel, crew, radiation and the temperature panels (marked SIMULATED).
- Monthly solar activity.
- Terrain, landing risk, costs, mass, and the power, radio and safety needs.
- Extra rules on a dark crater floor: colder, riskier landing, more ice, and a science bonus.

---

## Limits

- The sky chart assumes a **flat horizon**. Mountains and crater walls are not included, so the real sky can be darker.
- On a crater floor the walls hide most of the sky, so the game shows the NASA average instead of a chart.
- The NASA Earth-visibility map counts Earth as visible if any part of its disc is visible, so it can be slightly optimistic for real radio links.
- MOONIX is for learning. It is **not mission-planning software**.

---

## Run it locally

**Requirements:** Node.js 18 or newer.

```bash
git clone <your-repository-link>
cd <repository-folder>
npm install
npm run dev
```

Then open the address shown in the terminal (usually http://localhost:5173).

Build for production:

```bash
npm run build
npm run preview
```

---

## Rebuild the data (optional)

The prepared data files are already included in `src/data/`:

- `siteScience.json`: sunlight and Earth-link values from the NASA LOLA maps.
- `launchWindowsScience.json`: monthly Sun and Earth values from NASA JPL Horizons, for 2027.

To rebuild them:

```bash
python tools/build_site_data.py
python tools/build_window_data.py
```

`build_site_data.py` needs the two LOLA GeoTIFF files from the NASA page above. List the Python packages you used in `tools/requirements.txt`.

---

## Tech

React 19, TypeScript, Vite and Tailwind CSS. There is no backend. Progress (the first-try bonus and the Mission Journal) is saved in the browser's local storage.

## Project structure

```
src/
  components/   Screens and the Data Sources panel
  data/         Sites, equipment, launch windows, mission engine, saved progress
tools/          Python scripts that prepare the NASA data
public/         Static files
DATA_SOURCES.md Full list of data sources and methods
```

---

## Use of AI

We used AI tools while building this project, and we checked and edited everything they produced.

- **ChatGPT (OpenAI):** Coding assistance, debugging, technical guidance, and problem-solving.
- **Claude (Anthropic):** Code development, implementation assistance, and AI voice integration.


---

## Team

**Team Lunar Odyssey**: 

.Moriam Chowdhury - Team Leader & Game Logic Developer 

.Khadija Akter - Frontend Developer

. Sabiha Ferdousi Saba  - Data Scientist 

.Jannatul Mowa Somaya - Video Editor & Presentation Lead

. Noshin Nawar - UI/UX Designer

. Nahida sultana - Script Writer & Narrative Lead

## License

Licensed under the **Apache License 2.0**. See [`LICENSE`](LICENSE).

NASA data is used under NASA's open data policies. Thanks to NASA, the LOLA team and the JPL Horizons team for making this data public.