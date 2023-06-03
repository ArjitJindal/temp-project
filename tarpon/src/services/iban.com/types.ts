// API Reference: https://www.iban.com/validation-api

export type IBANApiHistory = {
  type: 'IBAN_VALIDATION'
  createdAt: number
  request: {
    iban: string
  }
  response: IBANValidationResponse
}

export type IBANValidationCode =
  | '001' // Validation Success	IBAN Check digit is correct
  | '002' // Validation Success	Account Number check digit is correct
  | '003' // Validation Success	IBAN Length is correct
  | '004' // Validation Success	Account Number check digit is not performed for this bank or branch
  | '005' // Validation Success	IBAN structure is correct
  | '006' // Validation Success	IBAN does not contain illegal characters
  | '007' // Validation Success	Country supports IBAN standard
  | '201' // Validation Failed	Account Number check digit not correct
  | '202' // Validation Failed	IBAN Check digit not correct
  | '203' // Validation Failed	IBAN Length is not correct
  | '205' // Validation Failed	IBAN structure is not correct
  | '206' // Validation Failed	IBAN contains illegal characters
  | '207' // Validation Failed	Country does not support IBAN standard
  | '301' // Account Error	    API Key is invalid
  | '302' // Account Error	    Subscription expired
  | '303' // Account Error    	No queries available
  | '304' // Account Error	    You have no access to this API
  | '305' // Account Error	    IP Address not allowed
export type IBANValidation = {
  code: IBANValidationCode
  message: string
}
export type IBANValidationResponse = {
  bank_data?: {
    bic?: string
    branch?: string
    bank?: string
    address?: string
    city?: string
    state?: string
    zip?: string
    phone?: string
    fax?: string
    www?: string
    email?: string
    country?: string
    country_iso?: string
    account?: string
    bank_code?: string
    branch_code?: string
  }
  sepa_data?: {
    SCT?: 'YES' | 'NO'
    SDD?: 'YES' | 'NO'
    COR1?: 'YES' | 'NO'
    B2B?: 'YES' | 'NO'
    SCC?: 'YES' | 'NO'
  }
  validations?: {
    chars?: IBANValidation
    account?: IBANValidation
    iban?: IBANValidation
    structure?: IBANValidation
    length?: IBANValidation
    country_support?: IBANValidation
  }
  errors?: IBANValidation[]
}
