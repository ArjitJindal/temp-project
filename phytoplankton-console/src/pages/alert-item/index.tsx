import { useParams } from 'react-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Header from './components/Header';
import AlertDetails from './components/AlertDetails';
import { Authorized } from '@/components/utils/Authorized';
import PageWrapper from '@/components/PageWrapper';
import * as Card from '@/components/ui/Card';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { isLoading } from '@/utils/asyncResource';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM } from '@/utils/queries/keys';
import { Alert, Comment } from '@/apis';
import { useApi } from '@/api';
import { useUpdateAlertQueryData } from '@/utils/api/alerts';

function AlertItemPage() {
  const { id: alertId } = useParams<'id'>() as { id: string };

  const api = useApi();
  const queryClient = useQueryClient();

  const alertQueryResults = useQuery(
    ALERT_ITEM(alertId),
    (): Promise<Alert> => api.getAlert({ alertId }),
  );

  const updateAlertQueryData = useUpdateAlertQueryData();

  const handleCommentAdded = async (newComment: Comment, groupId: string) => {
    updateAlertQueryData(groupId, (alertItem) => {
      if (alertItem == null) {
        return alertItem;
      }
      return {
        ...alertItem,
        comments: [...(alertItem?.comments ?? []), newComment],
      };
    });
  };

  const onReload = () => {
    alertQueryResults.refetch();
    queryClient.invalidateQueries({ queryKey: ALERT_ITEM(alertId) });
  };

  const [headerStickyElRef, setHeaderStickyElRef] = useState<HTMLDivElement | null>(null);

  return (
    <AsyncResourceRenderer resource={alertQueryResults.data}>
      {(alertItem) => (
        <PageWrapper
          header={
            <Card.Root>
              <Header
                isLoading={isLoading(alertQueryResults.data)}
                headerStickyElRef={setHeaderStickyElRef}
                alertItem={alertItem}
                onReload={onReload}
                onCommentAdded={handleCommentAdded}
              />
            </Card.Root>
          }
          disableHeaderPadding
        >
          <AlertDetails alertItem={alertItem} headerStickyElRef={headerStickyElRef} />
        </PageWrapper>
      )}
    </AsyncResourceRenderer>
  );
}

export default function CaseManagementItemPageWrapper() {
  return (
    <Authorized required={['case-management:case-details:read']} showForbiddenPage>
      <AlertItemPage />
    </Authorized>
  );
}
