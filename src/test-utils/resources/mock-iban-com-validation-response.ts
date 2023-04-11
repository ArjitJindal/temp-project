export const MOCK_IBAN_COM_VALIDATION_RESPONSE = {
  bank_data: {
    bic: 'BUKBGB22XXX',
    branch: 'CHELTENHAM',
    bank: 'BARCLAYS BANK UK PLC',
    address: '',
    city: 'Leicester',
    state: null,
    zip: 'LE87 2BB',
    phone: '0345 7345345',
    fax: null,
    www: null,
    email: null,
    country: 'United Kingdom',
    country_iso: 'GB',
    account: '55555555',
    bank_code: 'BUKB',
    branch_code: '202015',
  },
  sepa_data: {
    SCT: 'YES',
    SDD: 'YES',
    COR1: 'YES',
    B2B: 'YES',
    SCC: 'NO',
  },
  validations: {
    chars: {
      code: '006',
      message: 'IBAN does not contain illegal characters',
    },
    account: {
      code: '002',
      message: 'Account Number check digit is correct',
    },
    iban: {
      code: '001',
      message: 'IBAN Check digit is correct',
    },
    structure: {
      code: '005',
      message: 'IBAN structure is correct',
    },
    length: {
      code: '003',
      message: 'IBAN Length is correct',
    },
    country_support: {
      code: '007',
      message: 'Country supports IBAN standard',
    },
  },
  errors: [],
}
