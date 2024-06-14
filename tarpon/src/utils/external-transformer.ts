import { CommentResponse } from '@/@types/openapi-public-management/CommentResponse'
import { Comment } from '@/@types/openapi-internal/Comment'
export const getExternalComment = (comment: Comment): CommentResponse => {
  return {
    commentId: comment.id ?? '',
    body: comment.body,
    createdTimestamp: comment.createdAt,
    files: comment.files?.map((file) => ({
      filename: file.filename,
      size: file.size,
      downloadLink: file.downloadLink ?? '',
    })),
    updatedTimestamp: comment.updatedAt,
  }
}
