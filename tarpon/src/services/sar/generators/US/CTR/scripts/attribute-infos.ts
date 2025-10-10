// Original fincen schema hiearchy (https://bsaefiling.fincen.treas.gov/docs/XMLUserGuide_FinCENCTR.pdf)
//  - Party (Transmitter) // only one
//  - Party (Transmitter contact) // only one
//  - Party (Financial institution) // only one
//  - Party (Assistance contact) // only one
//  - Party.1 (Transaction location) // atleast one
//  - Party.N (Transaction location) // atleast one
//  - CurrencyTransactionActivity // only one

// Flagright fincen schema
// General Details
//  - Party (Transmitter) // only one
//  - Party (Transmitter contact) // only one
//  - Party (Financial institution) // only one
//  - Party (Assistance contact) // only one
// Transaction Details
//  - Transaction location
//    - Party.1 (Transaction location) // atleast one
//    - Party.N (Transaction location) // atleast one
// - CurrencyTransactionActivity // only one

export const AttributeInfos = {}
