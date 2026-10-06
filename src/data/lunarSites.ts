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

  temperature: string
  ice: string
  terrain: string
  risk: string

  description: string
}

export const lunarSites: LunarSite[] = [
  {
    id: 'shackleton',
    code: 'MX-01',
    name: 'Shackleton Crater',
    region: 'South Pole Region',

    latitude: '89.9° S',
    longitude: '0.0° E',

    sunlight: 82,
    communication: 91,
    score: 88,

    temperature: '-60°C',
    ice: 'HIGH',
    terrain: 'STABLE',
    risk: 'LOW',

    description:
      'A strategically located crater near the lunar south pole with strong illumination potential, accessible terrain, and promising water-ice resources.',
  },

  {
    id: 'cabeus',
    code: 'MX-02',
    name: 'Cabeus Crater',
    region: 'Permanently Shadowed Region',

    latitude: '84.9° S',
    longitude: '35.7° W',

    sunlight: 46,
    communication: 78,
    score: 76,

    temperature: '-180°C',
    ice: 'VERY HIGH',
    terrain: 'MODERATE',
    risk: 'MEDIUM',

    description:
      'Cabeus Crater contains significant water-ice potential within permanently shadowed regions, but extreme thermal conditions increase operational complexity.',
  },

  {
    id: 'haworth',
    code: 'MX-03',
    name: 'Haworth Crater',
    region: 'South Pole Highlands',

    latitude: '87.4° S',
    longitude: '5.0° E',

    sunlight: 74,
    communication: 88,
    score: 84,

    temperature: '-100°C',
    ice: 'HIGH',
    terrain: 'STABLE',
    risk: 'LOW',

    description:
      'Haworth Crater provides a strong balance between solar illumination, communication access, and potential lunar ice resources.',
  },

  {
    id: 'shoemaker',
    code: 'MX-04',
    name: 'Shoemaker Crater',
    region: 'South Pole Basin',

    latitude: '88.1° S',
    longitude: '50.1° E',

    sunlight: 68,
    communication: 83,
    score: 81,

    temperature: '-120°C',
    ice: 'MEDIUM',
    terrain: 'STABLE',
    risk: 'MEDIUM',

    description:
      'Shoemaker Crater offers relatively stable terrain and useful illumination conditions, making it a viable candidate for a lunar scientific outpost.',
  },

  {
    id: 'malapert',
    code: 'MX-05',
    name: 'Malapert Massif',
    region: 'South Pole Highlands',

    latitude: '85.9° S',
    longitude: '0.0° E',

    sunlight: 91,
    communication: 95,
    score: 93,

    temperature: '-70°C',
    ice: 'MEDIUM',
    terrain: 'EXCELLENT',
    risk: 'LOW',

    description:
      'Malapert Massif provides exceptional line-of-sight communication and strong solar exposure, offering favorable conditions for sustained lunar operations.',
  },

  {
    id: 'de-gerlache',
    code: 'MX-06',
    name: 'de Gerlache Crater',
    region: 'Lunar South Pole',

    latitude: '88.5° S',
    longitude: '87.0° W',

    sunlight: 79,
    communication: 86,
    score: 86,

    temperature: '-90°C',
    ice: 'HIGH',
    terrain: 'MODERATE',
    risk: 'LOW',

    description:
      'de Gerlache Crater combines favorable illumination with potential water-ice deposits and useful terrain for future exploration missions.',
  },
]