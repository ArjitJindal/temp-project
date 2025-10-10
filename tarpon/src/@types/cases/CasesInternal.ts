import { Comment } from '../openapi-internal/Comment'
import { FileInfo } from '../openapi-internal/FileInfo'
import { InternalUser } from '../openapi-internal/InternalUser'
import { PaymentDetails } from '../tranasction/payment-type'
import { Address } from '../openapi-public/Address'

export interface CaseCommentsInternal extends Comment {
  caseId: string
}

export interface CaseCommentFileInternal extends FileInfo {
  caseId: string
  commentId: string
}

export type CaseSubject =
  | { type: 'USER'; user: InternalUser }
  | { type: 'PAYMENT'; paymentDetails: PaymentDetails }
  | { type: 'ADDRESS'; address: Address }
  | { type: 'EMAIL'; email: string }
  | { type: 'NAME'; name: string }
