import React, { useMemo } from 'react';
import SubHeader from './SubHeader';
import { HeaderMenu, RiskScore } from './HeaderMenu';
import { Comment, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import CommentButton from '@/components/CommentButton';
import { useApi } from '@/api';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import Id from '@/components/ui/Id';
import { getUserName } from '@/utils/api/users';
import { USERS_ITEM_RISKS_DRS, USERS_ITEM_RISKS_KRS } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import { sortByDate } from '@/components/ui/RiskScoreDisplay';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { AsyncResource, all, map } from '@/utils/asyncResource';

interface Props {
  headerStickyElRef?: React.RefCallback<HTMLDivElement>;
  user: InternalConsumerUser | InternalBusinessUser;
  onNewComment: (newComment: Comment) => void;
}

export default function Header(props: Props) {
  const { user, headerStickyElRef, onNewComment } = props;
  const userId = user.userId;

  const api = useApi();

  const drsQueryResult = useQuery(USERS_ITEM_RISKS_DRS(userId), () => api.getDrsValue({ userId }));
  const kycQueryResult = useQuery(USERS_ITEM_RISKS_KRS(userId), () => api.getKrsValue({ userId }));

  const drsRiskScore: AsyncResource<RiskScore> = useMemo(
    () =>
      map(drsQueryResult.data, (v) => {
        const values = v.map((x) => ({
          score: x.drsScore,
          manualRiskLevel: x?.manualRiskLevel,
          createdAt: x.createdAt,
          components: x.components,
          riskLevel: x.derivedRiskLevel,
        }));
        return sortByDate(values)[values.length - 1];
      }),
    [drsQueryResult.data],
  );

  const kycRiskScore: AsyncResource<RiskScore> = useMemo(
    () =>
      map(kycQueryResult.data, (v) => ({
        score: v.krsScore,
        riskLevel: v.riskLevel,
        components: v.components,
        createdAt: v.createdAt,
      })),
    [kycQueryResult.data],
  );

  const riskScoresDetails = all([drsRiskScore, kycRiskScore]);
  return (
    <EntityHeader
      stickyElRef={headerStickyElRef}
      chips={[<Id alwaysShowCopy>{userId}</Id>]}
      breadcrumbItems={[
        {
          title: 'Users',
          to: '/users',
        },
        {
          title: getUserName(user),
        },
      ]}
      buttons={[
        <CommentButton
          onSuccess={onNewComment}
          submitRequest={async (commentFormValues) => {
            if (userId == null) {
              throw new Error(`User ID is not defined`);
            }
            const commentData = {
              Comment: { body: commentFormValues.comment, files: commentFormValues.files },
            };
            return await api.postUserComments({
              userId: userId,
              ...commentData,
            });
          }}
          requiredPermissions={['users:user-comments:write']}
        />,
        <AsyncResourceRenderer resource={riskScoresDetails}>
          {([drsRiskScore, kycRiskScore]) => {
            return (
              <HeaderMenu
                user={user}
                riskScores={{
                  kycRiskScore,
                  drsRiskScore,
                }}
              />
            );
          }}
        </AsyncResourceRenderer>,
      ]}
      subHeader={<SubHeader onNewComment={onNewComment} user={user} />}
    />
  );
}
