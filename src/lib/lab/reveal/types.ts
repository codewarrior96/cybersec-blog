export interface RevealEvent {
  level: number
  levelTitle: string
  flag: string
  nextLevelTitle: string | null
}

export type RevealStatus = 'pending' | 'revealed' | 'consumed'
