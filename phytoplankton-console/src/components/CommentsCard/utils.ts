import { CommentWithReplies } from '.';
import { Comment } from '@/apis';

export const getCommentsWithReplies = (comments: Comment[]): CommentWithReplies[] => {
  const parentComments: Comment[] = comments.filter((comment) => !comment.parentId);
  const replies = comments.filter((comment) => comment.parentId);
  const commentsWithReplies: CommentWithReplies[] = parentComments.map((comment) => {
    return {
      ...comment,
      replies: replies.filter((reply) => reply.parentId === comment.id),
    };
  });
  return commentsWithReplies;
};
