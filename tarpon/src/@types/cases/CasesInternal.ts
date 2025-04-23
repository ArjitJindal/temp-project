import { Comment } from '../openapi-internal/Comment'
import { FileInfo } from '../openapi-internal/FileInfo'

export interface CaseCommentsInternal extends Comment {
  caseId: string
}

export interface CaseCommentFileInternal extends FileInfo {
  caseId: string
  commentId: string
}
