import { ACHDetails } from '../openapi-public/ACHDetails'
import { CardDetails } from '../openapi-public/CardDetails'
import { IBANDetails } from '../openapi-public/IBANDetails'
import { UPIDetails } from '../openapi-public/UPIDetails'

export type PaymentDetails = CardDetails | IBANDetails | ACHDetails | UPIDetails
