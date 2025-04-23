import { Comment } from '../openapi-internal/Comment'
import { FileInfo } from '../openapi-internal/FileInfo'

export interface AlertCommentsInternal extends Comment {
  alertId: string
}

export interface AlertCommentFileInternal extends FileInfo {
  alertId: string
  commentId: string
}
