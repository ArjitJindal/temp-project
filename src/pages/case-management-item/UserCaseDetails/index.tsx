import React from 'react';
import CommentsCard, { CommentGroup } from './CommentsCard';
import AlertsCard from './AlertsCard';
import InsightsCard from './InsightsCard';
import { UI_SETTINGS } from './ui-settings';
import { Case, Comment as ApiComment } from '@/apis';
import UserDetails from '@/pages/users-item/UserDetails';
import { usePageViewTracker } from '@/utils/tracker';
import { useScrollToFocus } from '@/utils/hooks';
import { useQueries } from '@/utils/queries/hooks';
import { ALERT_ITEM_COMMENTS } from '@/utils/queries/keys';
import { all, AsyncResource, map } from '@/utils/asyncResource';
import { QueryResult } from '@/utils/queries/types';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useApi } from '@/api';

interface Props {
  caseItem: Case;
  updateCollapseState: (key: string, value: boolean) => void;
  onReload: () => void;
}

function UserCaseDetails(props: Props) {
  const { caseItem } = props;
  const user = caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined;
  usePageViewTracker('User Case Details');
  useScrollToFocus();

  const alertIds = (caseItem.alerts ?? [])
    .map(({ alertId }) => alertId)
    .filter((alertId): alertId is string => typeof alertId === 'string');
  const alertCommentsRes = useAlertsComments(alertIds);

  return (
    <>
      <UserDetails
        user={user}
        isEmbedded={true}
        hideHistory={true}
        hideInsights={true}
        updateCollapseState={props.updateCollapseState}
        onReload={props.onReload}
        showCommentEditor={false}
        uiSettings={UI_SETTINGS}
      />
      <AlertsCard
        caseItem={caseItem}
        updateCollapseState={props.updateCollapseState}
        title={UI_SETTINGS.cards.ALERTS.title}
        collapsableKey={UI_SETTINGS.cards.ALERTS.key}
      />
      {user?.userId && (
        <InsightsCard
          userId={user.userId}
          updateCollapseState={props.updateCollapseState}
          title={UI_SETTINGS.cards.TRANSACTION_INSIGHTS.title}
          collapsableKey={UI_SETTINGS.cards.TRANSACTION_INSIGHTS.key}
        />
      )}
      <AsyncResourceRenderer resource={alertCommentsRes}>
        {(alertCommentsGroups) => (
          <CommentsCard
            id={caseItem.caseId}
            comments={[
              ...alertCommentsGroups,
              {
                title: 'Other comments',
                type: 'CASE',
                id: caseItem.caseId ?? '-',
                comments: caseItem.comments ?? [],
              },
            ]}
            updateCollapseState={props.updateCollapseState}
            title={UI_SETTINGS.cards.COMMENTS.title}
            collapsableKey={UI_SETTINGS.cards.COMMENTS.key}
          />
        )}
      </AsyncResourceRenderer>
    </>
  );
}

function useAlertsComments(alertIds: string[]): AsyncResource<CommentGroup[]> {
  const api = useApi();

  const results = useQueries<ApiComment[]>({
    queries: alertIds.map((alertId) => ({
      queryKey: ALERT_ITEM_COMMENTS(alertId),
      queryFn: async (): Promise<ApiComment[]> => {
        const alert = await api.getAlert({
          alertId: alertId,
        });
        return alert.comments ?? [];
      },
    })),
  });

  const commentsResources: AsyncResource<CommentGroup>[] = results.map(
    (x: QueryResult<ApiComment[]>, i): AsyncResource<CommentGroup> => {
      const alertId = alertIds[i];
      return map(x.data, (comments: ApiComment[]) => ({
        title: `Alert: ${alertId}`,
        id: alertId ?? '',
        type: 'ALERT',
        comments,
      }));
    },
  );

  return all(commentsResources);
}

export default UserCaseDetails;
