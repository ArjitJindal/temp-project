import { Comment } from '../openapi-internal/Comment'
import { FileInfo } from '../openapi-internal/FileInfo'
import { SanctionsDetails } from '../openapi-internal/SanctionsDetails'

export interface AlertCommentsInternal extends Comment {
  alertId: string
}

export interface AlertCommentFileInternal extends FileInfo {
  alertId: string
  commentId: string
}

export interface SanctionsDetailsInternal extends SanctionsDetails {
  alertId: string
}

export interface AlertTransactionIdsInternal extends Record<string, any> {
  alertId: string
  transactionIds: string[]
}
