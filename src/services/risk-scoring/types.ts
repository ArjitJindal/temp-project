export type KrsItem = {
  createdAt: number
  krsScore: number
  userId: string
  PartitionKeyID: string
  SortKeyID: string
}

export type ArsItem = {
  createdAt: number
  arsScore: number
  transactionId: string
  originUserId?: string
  destinationUserId?: string
  PartitionKeyID: string
  SortKeyID: string
}

export type DrsItem = {
  createdAt: number
  drsScore: number
  userId: string
  transactionId: string
  PartitionKeyID: string
  SortKeyID: string
}
