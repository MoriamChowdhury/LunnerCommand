/* =========================================================
   MOONIX — EQUIPMENT DATA
   Budget + mass are the two constraints the player juggles.
   ========================================================= */

export type EquipmentCategory =
  | 'power'
  | 'comms'
  | 'protection'
  | 'life'
  | 'science'
  | 'mobility'

export type EquipmentStats = {
  power: number
  comms: number
  safety: number
  science: number
}

export type EquipmentItem = {
  id: string
  code: string
  name: string
  shortName: string
  category: EquipmentCategory
  icon: string
  color: string

  /* millions of USD */
  cost: number
  /* kilograms */
  mass: number

  stats: EquipmentStats

  /* output scales with the site's sunlight % */
  sunDependent?: boolean

  tagline: string
  description: string
  realWorld: string

  voiceAliases: string[]
}

export const EQUIPMENT_BUDGET = 500
export const MASS_LIMIT = 1500

export const equipmentCategories: {
  id: EquipmentCategory
  label: string
  color: string
}[] = [
  { id: 'power', label: 'POWER', color: '#e5bd72' },
  { id: 'comms', label: 'COMMS', color: '#72e8ff' },
  { id: 'protection', label: 'PROTECTION', color: '#8db9ff' },
  { id: 'life', label: 'LIFE SUPPORT', color: '#73e2a5' },
  { id: 'science', label: 'SCIENCE', color: '#b99cff' },
  { id: 'mobility', label: 'MOBILITY', color: '#e5a36c' },
]

export const equipmentList: EquipmentItem[] = [
  {
    id: 'solar',
    code: 'EQ-01',
    name: 'Vertical Solar Array',
    shortName: 'Solar array',
    category: 'power',
    icon: '☀',
    color: '#e5bd72',
    cost: 150,
    mass: 420,
    stats: { power: 32, comms: 0, safety: 0, science: 0 },
    sunDependent: true,
    tagline: 'Tall mast array built for a low polar Sun.',
    description:
      'At the south pole the Sun skims the horizon, so panels stand vertical and rotate to track it. Output depends directly on how much of the lunar day your site is illuminated.',
    realWorld:
      "NASA's Vertical Solar Array Technology (VSAT) project is developing tall, deployable arrays designed specifically for lunar south pole lighting.",
    voiceAliases: ['solar', 'solar array', 'solar panel', 'panel', 'panels', 'array'],
  },
  {
    id: 'battery',
    code: 'EQ-02',
    name: 'Energy Storage Bank',
    shortName: 'Battery bank',
    category: 'power',
    icon: '▮',
    color: '#e5bd72',
    cost: 100,
    mass: 360,
    stats: { power: 20, comms: 0, safety: 5, science: 0 },
    tagline: 'Keeps the outpost alive through the dark.',
    description:
      'Stores surplus energy for periods of shadow. Essential at sites with limited illumination, where solar output alone cannot carry the base through darkness.',
    realWorld:
      'Across most of the Moon a lunar night lasts about 14 Earth days, which makes long-duration energy storage one of the hardest problems in surface operations.',
    voiceAliases: ['battery', 'batteries', 'battery bank', 'storage', 'fuel cell', 'energy storage'],
  },
  {
    id: 'comms',
    code: 'EQ-03',
    name: 'Lunar Relay Antenna',
    shortName: 'Relay antenna',
    category: 'comms',
    icon: '⌁',
    color: '#72e8ff',
    cost: 80,
    mass: 110,
    stats: { power: 0, comms: 30, safety: 8, science: 0 },
    tagline: 'Holds the link when Earth dips below the horizon.',
    description:
      'From the south pole, Earth hangs low and is often blocked by terrain. A relay-capable antenna keeps data and voice flowing to mission control.',
    realWorld:
      "NASA's Lunar Communications Relay and Navigation Systems (LCRNS) project plans relay services for south pole missions for exactly this reason.",
    voiceAliases: ['comms', 'communication', 'communications', 'relay', 'antenna', 'radio'],
  },
  {
    id: 'thermal',
    code: 'EQ-04',
    name: 'Thermal Control Shield',
    shortName: 'Thermal shield',
    category: 'protection',
    icon: '⬡',
    color: '#8db9ff',
    cost: 120,
    mass: 280,
    stats: { power: 4, comms: 0, safety: 20, science: 0 },
    tagline: 'Multi-layer insulation for extreme cold.',
    description:
      'Protects crew and electronics from brutal temperature swings and reduces the energy needed for heating, which slightly improves the power budget.',
    realWorld:
      "Permanently shadowed craters near the pole are among the coldest places measured in the solar system, with NASA's LRO recording temperatures below −230 °C.",
    voiceAliases: ['thermal', 'thermal shield', 'heat shield', 'heat', 'insulation'],
  },
  {
    id: 'shelter',
    code: 'EQ-05',
    name: 'Radiation Storm Shelter',
    shortName: 'Storm shelter',
    category: 'protection',
    icon: '△',
    color: '#8db9ff',
    cost: 110,
    mass: 390,
    stats: { power: 0, comms: 0, safety: 22, science: 0 },
    tagline: 'A shielded refuge during solar storms.',
    description:
      'A compact, heavily shielded module the crew can retreat to during a solar particle event. The biggest single boost to crew safety.',
    realWorld:
      'With no thick atmosphere or global magnetic field, the lunar surface is exposed to solar particle events and galactic cosmic rays.',
    voiceAliases: ['shelter', 'storm shelter', 'radiation', 'habitat', 'storm'],
  },
  {
    id: 'water',
    code: 'EQ-06',
    name: 'Ice Extraction Drill',
    shortName: 'Ice drill',
    category: 'life',
    icon: '◇',
    color: '#73e2a5',
    cost: 90,
    mass: 240,
    stats: { power: 0, comms: 0, safety: 10, science: 18 },
    tagline: 'Turns buried ice into water, oxygen and fuel.',
    description:
      'Drills into regolith and heats it to release water. That water can be split into oxygen for the crew and hydrogen for rocket fuel. Far more valuable at ice-rich sites.',
    realWorld:
      "In 2009 NASA's LCROSS mission impacted Cabeus crater and detected water in the plume, which is key evidence for polar ice.",
    voiceAliases: ['water', 'ice', 'drill', 'ice drill', 'extraction', 'isru'],
  },
  {
    id: 'lab',
    code: 'EQ-07',
    name: 'Mobile Science Lab',
    shortName: 'Science lab',
    category: 'science',
    icon: '✦',
    color: '#b99cff',
    cost: 200,
    mass: 520,
    stats: { power: -10, comms: 0, safety: 0, science: 35 },
    tagline: 'Maximum science, but it is power hungry.',
    description:
      'Analyzes samples on site instead of waiting for return to Earth. It gives the largest science return but continuously draws power from the base.',
    realWorld:
      'Studying polar volatiles such as water ice is one of the top science priorities for Artemis surface missions.',
    voiceAliases: ['lab', 'laboratory', 'science lab'],
  },
  {
    id: 'rover',
    code: 'EQ-08',
    name: 'Lunar Terrain Vehicle',
    shortName: 'Terrain vehicle',
    category: 'mobility',
    icon: '◎',
    color: '#e5a36c',
    cost: 140,
    mass: 610,
    stats: { power: -6, comms: 0, safety: 8, science: 15 },
    tagline: 'Extends range to sunlit ridges and dark craters.',
    description:
      'Lets the crew travel between sunlit ridges and shadowed craters, reaching more samples and giving a fast evacuation option. Heavy, and it needs charging.',
    realWorld:
      "NASA's Lunar Terrain Vehicle (LTV) program is developing a rover that Artemis astronauts can drive around the south pole region.",
    voiceAliases: ['rover', 'vehicle', 'terrain vehicle', 'buggy', 'ltv'],
  },
]
