import { useMemo } from 'react';
import { maxBy, orderBy } from 'lodash';
import { Resource } from '@flagright/lib/utils';
import s from './index.module.less';
import Comment from './Comment';
import { getCommentsWithReplies } from './utils';
import * as Card from '@/components/ui/Card';
import { CommentType, useAuth0User, useHasResources } from '@/utils/user-utils';
import { Comment as ApiComment } from '@/apis';
import { P } from '@/components/ui/Typography';
import { Mutation } from '@/utils/queries/types';
import { map, getOr, AsyncResource } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { adaptMutationVariables } from '@/utils/queries/mutations/helpers';
import { FormValues as CommentEditorFormValues } from '@/components/CommentEditor';

export interface CommentWithReplies extends ApiComment {
  replies?: ApiComment[];
}
export interface CommentGroup {
  title?: string;
  id: string;
  comments: ApiComment[];
}

interface Props {
  id?: string;
  title?: string;
  commentsQuery: AsyncResource<CommentGroup[]>;
  deleteCommentMutation: Mutation<unknown, unknown, { commentId: string; groupId: string }>;
  handleAddComment: (
    commentFormValues: CommentEditorFormValues,
    groupId: string,
  ) => Promise<ApiComment>;
  onCommentAdded?: (
    newComment: ApiComment,
    commentType: CommentType,
    groupId: string,
    personId?: string,
  ) => void;
  writeResources: Resource[];
}

export default function CommentsCard(props: Props) {
  const { commentsQuery, deleteCommentMutation, handleAddComment, onCommentAdded, writeResources } =
    props;

  const user = useAuth0User();
  const currentUserId = user.userId ?? undefined;
  const orderedCommentsRes = useMemo(() => {
    return map(commentsQuery, (comments) => {
      return orderBy(
        comments,
        [
          (x) => {
            const comments = x.comments;
            const latestComment = maxBy(comments, (x) => x.updatedAt);
            return latestComment ? latestComment.updatedAt : 0;
          },
          (x) => x.title,
        ],
        ['desc', 'asc'],
      );
    });
  }, [commentsQuery]);

  const totalCommentsLength = getOr(commentsQuery, []).reduce(
    (acc, group) => acc + group.comments.length,
    0,
  );

  return (
    <>
      <Card.Root>
        <Card.Section>
          {totalCommentsLength === 0 ? (
            <div>No comments yet</div>
          ) : (
            <div className={s.root}>
              <AsyncResourceRenderer resource={orderedCommentsRes}>
                {(updatedComments) => {
                  const nonEmptyGroups = updatedComments.filter(
                    (group) => group.comments.length > 0,
                  );
                  return nonEmptyGroups.map((group) => {
                    const adaptedMutation = adaptMutationVariables(
                      deleteCommentMutation,
                      (variables: { commentId: string }) => {
                        return { ...variables, groupId: group.id };
                      },
                    );
                    const commentsWithReplies = getCommentsWithReplies(group.comments);

                    if (nonEmptyGroups.length < 2 && !group.title) {
                      return (
                        <Comments
                          comments={commentsWithReplies}
                          deleteCommentMutation={adaptedMutation}
                          currentUserId={currentUserId}
                          writeResources={writeResources}
                          hanldeAddComment={(commentFormValues) =>
                            handleAddComment(commentFormValues, group.id)
                          }
                          onCommentAdded={(newComment) =>
                            onCommentAdded?.(newComment, CommentType.COMMENT, group.id)
                          }
                          key="comments-component"
                        />
                      );
                    }
                    return (
                      <div className={s.group} key={group.title}>
                        <P bold>{group.title}</P>
                        <Comments
                          comments={commentsWithReplies}
                          deleteCommentMutation={adaptedMutation}
                          currentUserId={currentUserId}
                          hanldeAddComment={(commentFormValues) =>
                            handleAddComment(commentFormValues, group.id)
                          }
                          onCommentAdded={(newComment) =>
                            onCommentAdded?.(newComment, CommentType.COMMENT, group.id)
                          }
                          writeResources={writeResources}
                        />
                      </div>
                    );
                  });
                }}
              </AsyncResourceRenderer>
            </div>
          )}
        </Card.Section>
      </Card.Root>
    </>
  );
}

function Comments(props: {
  comments: CommentWithReplies[];
  currentUserId: string;
  deleteCommentMutation: Mutation<unknown, unknown, { commentId: string }>;
  writeResources: Resource[];
  hanldeAddComment: (commentFormValues: CommentEditorFormValues) => Promise<ApiComment>;
  onCommentAdded: (newComment: ApiComment, commentType: CommentType) => void;
}) {
  const {
    comments,
    currentUserId,
    deleteCommentMutation,
    writeResources,
    hanldeAddComment,
    onCommentAdded,
  } = props;

  const hasCommentWritePermission = useHasResources(writeResources);
  return (
    <div className={s.comments}>
      {comments.map((comment) => (
        <Comment
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          deleteCommentMutation={deleteCommentMutation}
          hasCommentWritePermission={hasCommentWritePermission}
          handleAddComment={hanldeAddComment}
          onCommentAdded={onCommentAdded}
        />
      ))}
    </div>
  );
}
