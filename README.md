# Moonix

**An educational lunar mission game** built for the NASA Space Apps Challenge 2026
(*CLPS Lunar Mission Browser*), by Team Lunar Odyssey.

You compare lunar south pole landing sites and launch months, then outfit a lander
so its **power**, **Earth link** and **crew safety** survive the mission.
The Sun and Earth numbers come from real NASA data. See
[DATA_SOURCES.md](DATA_SOURCES.md) for what is real, what is a game estimate,
and the limits.

## How the game works

1. **Site:** pick one of 6 south pole sites (Shackleton, Cabeus, Haworth, Shoemaker, Malapert, de Gerlache).
2. **Equipment:** choose modules within a budget and mass limit.
3. **Launch window:** pick a month. Each site has its own real Sun and Earth pattern for that month.
4. **Mission:** the computer checks power, Earth link and safety, then lands or aborts.
5. **Results:** report card, lessons learned and a journal.

Try it: Shackleton in **March** has no direct sunlight, so no equipment kit within the budget can win. In **October** it has strong sunlight and a well-chosen lander wins.

## Run it

```bash
npm install
npm run dev
```

Build for production: `npm run build`.

Built with React, Vite and TypeScript. There is **no backend**; progress is saved in the browser (`localStorage`).

## Data and tools

The game imports two small JSON files made from NASA data:

- `src/data/siteScience.json`: Sun % and Earth link % per site (NASA LRO/LOLA)
- `src/data/launchWindowsScience.json`: monthly Sun and Earth geometry (NASA JPL Horizons)

The Python scripts that make them are in `tools/` (optional, not part of the game).
How to rebuild them is explained in [DATA_SOURCES.md](DATA_SOURCES.md).

## Honest note

Moonix is for learning, not for planning real missions. Values are long-term
averages, landing safety (slopes and rocks) is not modelled, and several labels
on screen (such as terrain, risk, temperature and ice) are game estimates.