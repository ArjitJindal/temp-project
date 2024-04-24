export type IBANBankInfo = {
  bankName?: string
  bic?: string
  branchCode?: string
  address?: string
  zip?: string
  city?: string
  country?: string
  state?: string
}

export type IBANApiHistory = {
  createdAt: number
  request: {
    iban: string
  }
  response: IBANBankInfo
  rawResponse: object
  source: string
}
