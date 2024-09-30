// Objective: Define the list of valid acronyms

export const ACRONYMS: ReadonlyArray<string> = [
  'ACH',
  'UPI',
  'IBAN',
  'SWIFT',
  'IFSC',
  'MICR',
  'RTGS',
  'NEFT',
  'IMPS',
  'CFT',
  'AML',
  'KYC',
  'PEP',
  'QA',
  'NRIC',
]

export function isValidAcronyms(input: string): input is string {
  return ACRONYMS.indexOf(input) !== -1
}
