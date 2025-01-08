import React from 'react';
import SubHeader from './SubHeader';
import { Alert, Case, Comment } from '@/apis';
import { useApi } from '@/api';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import { CASES_ITEM } from '@/utils/queries/keys';
import { getAlertUrl, getCaseUrl } from '@/utils/routing';
import { useQuery } from '@/utils/queries/hooks';
import CommentButton from '@/components/CommentButton';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';

interface Props {
  isLoading: boolean;
  alertItem: Alert;
  onReload: () => void;
  onCommentAdded: (newComment: Comment, groupId: string) => void;
  headerStickyElRef?: React.RefCallback<HTMLDivElement>;
}

export default function Header(props: Props) {
  const { isLoading, alertItem, headerStickyElRef, onCommentAdded } = props;
  const { caseId } = alertItem;
  const caseQueryResults = useQuery(CASES_ITEM(caseId ?? ''), (): Promise<Case> => {
    if (caseId == null) {
      throw new Error(`Alert case id could not be empty`);
    }
    return api.getCase({ caseId });
  });
  const api = useApi();
  return (
    <EntityHeader
      stickyElRef={headerStickyElRef}
      breadcrumbItems={[
        {
          title: 'Cases',
          to: '/case-management/cases',
        },
        {
          title: alertItem.caseId ?? 'Unknown case',
          to: alertItem.caseId ? getCaseUrl(alertItem.caseId) : undefined,
        },
        {
          title: alertItem.alertId ?? 'Unknown alert',
          to:
            alertItem.caseId && alertItem.alertId
              ? getAlertUrl(alertItem.caseId, alertItem.alertId, true)
              : undefined,
        },
      ]}
      buttons={[
        <CommentButton
          key={'comment'}
          disabled={isLoading}
          onSuccess={(newComment) => {
            onCommentAdded(newComment, alertItem.alertId ?? '');
          }}
          submitRequest={async (commentFormValues) => {
            if (alertItem.alertId == null) {
              throw new Error(`Alert ID is not defined`);
            }
            return await api.createAlertsComment({
              alertId: alertItem.alertId ?? '',
              CommentRequest: {
                body: sanitizeComment(commentFormValues.comment),
                files: commentFormValues.files,
              },
            });
          }}
          requiredPermissions={['case-management:case-overview:write']}
        />,
      ]}
      subHeader={<SubHeader caseItemRes={caseQueryResults.data} alertItem={alertItem} />}
    />
  );
}
