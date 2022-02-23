import { ACHDetails } from '../openapi-public/aCHDetails'
import { CardDetails } from '../openapi-public/cardDetails'
import { IBANDetails } from '../openapi-public/iBANDetails'
import { UPIDetails } from '../openapi-public/uPIDetails'

export type PaymentDetails = CardDetails | IBANDetails | ACHDetails | UPIDetails
