import { ACHDetails } from '../openapi/ACHDetails'
import { CardDetails } from '../openapi/cardDetails'
import { IBANDetails } from '../openapi/IBANDetails'
import { UPIDetails } from '../openapi/UPIDetails'

export type PaymentDetails = CardDetails | IBANDetails | ACHDetails | UPIDetails
