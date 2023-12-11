import React, { useMemo } from 'react';
import { maxBy, orderBy } from 'lodash';
import s from './index.module.less';
import Comment from './Comment';
import * as Card from '@/components/ui/Card';
import { useAuth0User } from '@/utils/user-utils';
import { Comment as ApiComment } from '@/apis';
import { P } from '@/components/ui/Typography';
import { Mutation } from '@/utils/queries/types';
import { map, getOr, AsyncResource } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { adaptMutationVariables } from '@/utils/queries/mutations/helpers';

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
}

export default function CommentsCard(props: Props) {
  const { commentsQuery, deleteCommentMutation } = props;
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
                        return { ...variables, groupId: group.id as string };
                      },
                    );
                    if (nonEmptyGroups.length < 2 && !group.title) {
                      return (
                        <Comments
                          comments={group.comments}
                          deleteCommentMutation={adaptedMutation}
                          currentUserId={currentUserId}
                        />
                      );
                    }
                    return (
                      <div className={s.group} key={group.title}>
                        <P bold>{group.title}</P>
                        <div className={s.groupComments}>
                          <Comments
                            comments={group.comments}
                            deleteCommentMutation={adaptedMutation}
                            currentUserId={currentUserId}
                          />
                        </div>
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
  comments: ApiComment[];
  currentUserId: string;
  deleteCommentMutation: Mutation<unknown, unknown, { commentId: string }>;
}) {
  const { comments, currentUserId, deleteCommentMutation } = props;
  return (
    <div className={s.comments}>
      {comments.map((comment) => (
        <Comment
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          deleteCommentMutation={deleteCommentMutation}
        />
      ))}
    </div>
  );
}
