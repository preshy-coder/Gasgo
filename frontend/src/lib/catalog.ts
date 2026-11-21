// Shared lists: common cylinder sizes and the gas equipment shops can sell.
import type { AccessoryKind } from '../types'

/** Common cylinder sizes in kg, always shown to customers. Vendors can also sell other sizes. */
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
