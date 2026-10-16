import siteScienceFile from './siteScience.json'

export type LunarSite = {
  id: string
  code: string
  name: string
  region: string

  latitude: string
  longitude: string

  sunlight: number
  communication: number
  score: number

  /* where the NASA values were read: best spot AT the crater */
  spotKm: number
  searchKm: number

  /* the dark crater floor: average within ~10 km of the centre */
  floorSun: number
  floorEarth: number

  temperature: string
  ice: string
  terrain: string
  risk: string

  description: string
}

/* =========================================================
   REAL NASA VALUES (made by tools/build_site_data.py)
   Sunlight and Earth link come from NASA LRO / LOLA polar
   illumination maps: long-term AVERAGES. The game uses the best
   spot ON each crater, within its own radius, rim included
   ("near_spot"). Crater floors are often permanently dark, so the
   floor average (centre, ~10 km) is shown next to it. They are
   not monthly values and
   not a landing-site decision. Run `python tools/build_site_data.py` to rebuild.
   ========================================================= */

type SpotStats = { mean: number | null }

type SpotInfo = {
  sun: SpotStats
  earth: SpotStats
  distance_from_centre_km: number
  search_radius_km: number
}

type SiteScienceFile = {
  citation?: string
  source_url?: string
  sites: Record<
    string,
    {
      sun: SpotStats
      earth: SpotStats
      near_spot: SpotInfo
      best_spot: SpotInfo
    }
  >
}

const science = siteScienceFile as unknown as SiteScienceFile

export const SITE_SCIENCE_SOURCE = {
  citation: science.citation ?? 'Mazarico et al. (2011), Icarus 211, 1066-1081',
  url: science.source_url ?? 'https://pgda.gsfc.nasa.gov/products/69',
}

function pick(id: string, which: 'near_spot' | 'best_spot') {
  const found = science.sites?.[id]?.[which]

  if (!found || found.sun.mean == null || found.earth.mean == null) {
    throw new Error(
      `siteScience.json has no "${which}" data for "${id}". ` +
        'Run: python tools/build_site_data.py'
    )
  }

  return found
}

const sunOf = (id: string) => Math.round(pick(id, 'near_spot').sun.mean as number)
const earthOf = (id: string) => Math.round(pick(id, 'near_spot').earth.mean as number)
const spotKm = (id: string) => pick(id, 'near_spot').distance_from_centre_km
const searchKm = (id: string) => pick(id, 'near_spot').search_radius_km
const floorSunOf = (id: string) => Math.round(science.sites?.[id]?.sun?.mean ?? 0)
const floorEarthOf = (id: string) => Math.round(science.sites?.[id]?.earth?.mean ?? 0)

/* Real long-term sunlight near the south pole is far lower than the old
   hand-typed values, so the levels used by the equipment advice are set
   for that range. */
export const SUN_GOOD = 45
export const SUN_USABLE = 30

export const lunarSites: LunarSite[] = [
  {
    id: 'shackleton',
    code: 'MX-01',
    name: 'Shackleton Crater',
    region: 'South Pole Region',

    latitude: '89.7° S',
    longitude: '129.8° E',

    sunlight: sunOf('shackleton'),
    communication: earthOf('shackleton'),
    spotKm: spotKm('shackleton'),
    searchKm: searchKm('shackleton'),
    floorSun: floorSunOf('shackleton'),
    floorEarth: floorEarthOf('shackleton'),
    score: Math.round((sunOf('shackleton') + earthOf('shackleton')) / 2),

    temperature: '-60°C',
    ice: 'HIGH',
    terrain: 'STABLE',
    risk: 'LOW',

    description:
      'Shackleton sits almost exactly on the south pole. Its rim has some of the best sunlight near the pole, while its floor stays in permanent shadow. A well-known target for future surface missions.',
  },

  {
    id: 'cabeus',
    code: 'MX-02',
    name: 'Cabeus Crater',
    region: 'Permanently Shadowed Region',

    latitude: '84.9° S',
    longitude: '35.5° W',

    sunlight: sunOf('cabeus'),
    communication: earthOf('cabeus'),
    spotKm: spotKm('cabeus'),
    searchKm: searchKm('cabeus'),
    floorSun: floorSunOf('cabeus'),
    floorEarth: floorEarthOf('cabeus'),
    score: Math.round((sunOf('cabeus') + earthOf('cabeus')) / 2),

    temperature: '-180°C',
    ice: 'VERY HIGH',
    terrain: 'MODERATE',
    risk: 'MEDIUM',

    description:
      'Cabeus lies in the cold, mostly shadowed south polar region, far from the brightest ridges near the pole. Its dark floor is a scientific target, but sunlight and operations there are harder.',
  },

  {
    id: 'haworth',
    code: 'MX-03',
    name: 'Haworth Crater',
    region: 'South Pole Highlands',

    latitude: '86.9° S',
    longitude: '4.0° W',

    sunlight: sunOf('haworth'),
    communication: earthOf('haworth'),
    spotKm: spotKm('haworth'),
    searchKm: searchKm('haworth'),
    floorSun: floorSunOf('haworth'),
    floorEarth: floorEarthOf('haworth'),
    score: Math.round((sunOf('haworth') + earthOf('haworth')) / 2),

    temperature: '-100°C',
    ice: 'HIGH',
    terrain: 'STABLE',
    risk: 'LOW',

    description:
      'Haworth is a large crater near the south pole with a shadowed floor. Sunlight and Earth contact vary a lot across the crater, so the exact landing spot matters.',
  },

  {
    id: 'shoemaker',
    code: 'MX-04',
    name: 'Shoemaker Crater',
    region: 'South Pole Basin',

    latitude: '88.1° S',
    longitude: '44.9° E',

    sunlight: sunOf('shoemaker'),
    communication: earthOf('shoemaker'),
    spotKm: spotKm('shoemaker'),
    searchKm: searchKm('shoemaker'),
    floorSun: floorSunOf('shoemaker'),
    floorEarth: floorEarthOf('shoemaker'),
    score: Math.round((sunOf('shoemaker') + earthOf('shoemaker')) / 2),

    temperature: '-120°C',
    ice: 'MEDIUM',
    terrain: 'STABLE',
    risk: 'MEDIUM',

    description:
      'Shoemaker is a large, deeply shadowed crater close to the pole. Sunlight is limited, so a lander here needs good power planning, such as a battery.',
  },

  {
    id: 'malapert',
    code: 'MX-05',
    name: 'Malapert Massif',
    region: 'South Pole Highlands',

    latitude: '85.9° S',
    longitude: '0.0° E',

    sunlight: sunOf('malapert'),
    communication: earthOf('malapert'),
    spotKm: spotKm('malapert'),
    searchKm: searchKm('malapert'),
    floorSun: floorSunOf('malapert'),
    floorEarth: floorEarthOf('malapert'),
    score: Math.round((sunOf('malapert') + earthOf('malapert')) / 2),

    temperature: '-70°C',
    ice: 'MEDIUM',
    terrain: 'EXCELLENT',
    risk: 'LOW',

    description:
      'Malapert Massif is a high mountain near the south pole. From its top Earth is visible almost all the time, which makes it a strong site for communication.',
  },

  {
    id: 'de-gerlache',
    code: 'MX-06',
    name: 'de Gerlache Crater',
    region: 'Lunar South Pole',

    latitude: '88.5° S',
    longitude: '87.1° W',

    sunlight: sunOf('de-gerlache'),
    communication: earthOf('de-gerlache'),
    spotKm: spotKm('de-gerlache'),
    searchKm: searchKm('de-gerlache'),
    floorSun: floorSunOf('de-gerlache'),
    floorEarth: floorEarthOf('de-gerlache'),
    score: Math.round((sunOf('de-gerlache') + earthOf('de-gerlache')) / 2),

    temperature: '-90°C',
    ice: 'HIGH',
    terrain: 'MODERATE',
    risk: 'LOW',

    description:
      'de Gerlache is a large crater near the pole with shadowed areas inside. Its rim offers some sunlight, but conditions change a lot from spot to spot.',
  },
]

/* =========================================================
   DATA STATUS
   Honest labels: which values come from NASA / IAU sources and
   which are Moonix game estimates. Step 3 replaces estimates
   with real NASA values, one field at a time.
   ========================================================= */

export type DataStatus = 'nasa' | 'estimate' | 'check'

export type SiteField =
  | 'coordinates'
  | 'sunlight'
  | 'communication'
  | 'score'
  | 'temperature'
  | 'ice'
  | 'terrain'
  | 'risk'

export const DATA_STATUS: Record<SiteField, DataStatus> = {
  /* checked against the IAU / USGS Gazetteer of Planetary Nomenclature */
  coordinates: 'nasa',

  /* NASA LRO/LOLA long-term averages at the crater (best spot on the crater, rim included) */
  sunlight: 'nasa',
  communication: 'nasa',

  /* site index = average of the two NASA values (sun + Earth link) */
  score: 'nasa',

  /* hand-typed game values, not yet taken from a dataset */
  terrain: 'estimate',
  risk: 'estimate',

  /* likely too simple or overconfident: needs real data */
  temperature: 'check',
  ice: 'check',
}

export const STATUS_LABEL: Record<DataStatus, string> = {
  nasa: 'NASA-BASED',
  estimate: 'GAME ESTIMATE',
  check: 'NEEDS CHECKING',
}