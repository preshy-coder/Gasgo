// Fixed lists vendors and customers pick from, so nobody has to type brand names or sizes.
// The backend must accept exactly these values (same spelling) — keep both lists in sync.
import type { AccessoryKind } from '../types'

/** Gas brands sold in Kenya. Vendors pick theirs from this list and only enter prices. */
export const GAS_BRANDS = [
  'Shell Afrigas',
  'Total Gas',
  'K-Gas',
  'ProGas',
  'Taifa Gas',
  'Hashi Gas',
  'Lake Gas',
  'Ola Mpishi',
  'SupaGas',
  'Hass Gas',
  'Sea Gas',
  'Jatel Gas',
  'Oryx Gas',
  'MenGas',
  'G-Gas',
  'Texgas',
  'City Gas',
  'Salama Gas',
  'Swift Gas',
  'Royal Gas',
  'Jamii Gas',
  'Alfa Gas',
  'Kendy Gas',
  'Kento Gas',
  'Hunkar Gas',
  'Maxgas',
  'Moto Gas',
  'Amaan Gas',
  'Homegas',
  'Topgas',
] as const

/** Cylinder sizes in kg. */
export const GAS_SIZES = [3, 6, 13, 22.5, 35, 50] as const

export interface AccessoryInfo {
  kind: AccessoryKind
  name: string
  description: string
  /** Hose pipes are priced per metre; the customer chooses the length. */
  perMetre?: boolean
}

/** Gas equipment vendors can sell alongside cylinders (the "Market"). */
export const ACCESSORIES: AccessoryInfo[] = [
  {
    kind: 'regulator',
    name: 'Gas regulator',
    description: 'Controls the gas flow from the cylinder',
  },
  {
    kind: 'hose',
    name: 'Gas hose pipe',
    description: 'Priced per metre. The customer picks the length.',
    perMetre: true,
  },
  {
    kind: 'lighter',
    name: 'Gas lighter',
    description: 'Spark lighter for the burner',
  },
  {
    kind: 'grill',
    name: 'Gas grill',
    description: 'Cooking grill / burner top for the cylinder',
  },
]

/** Hose lengths customers can choose, in metres. */
export const HOSE_LENGTHS = [1, 1.5, 2, 3, 5] as const

export const accessoryInfo = (kind: AccessoryKind) => ACCESSORIES.find((a) => a.kind === kind)!

/** "22.5 kg" style label. */
export const sizeLabel = (kg: number) => `${kg} kg`

/** Matches the catalogue spelling ignoring case, spaces and dashes ("kgas" → "K-Gas"). */
export function catalogBrand(input: string): string | undefined {
  const norm = (s: string) => s.replace(/[\s-]/g, '').toLowerCase()
  return GAS_BRANDS.find((b) => norm(b) === norm(input))
}
