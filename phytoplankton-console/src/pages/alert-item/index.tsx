import { useParams } from 'react-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Header from './components/Header';
import AlertDetails from './components/AlertDetails';
import { Authorized } from '@/components/utils/Authorized';
import PageWrapper from '@/components/PageWrapper';
import * as Card from '@/components/ui/Card';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM } from '@/utils/queries/keys';
import { Alert, Comment } from '@/apis';
import { useApi } from '@/api';
import { useUpdateAlertItemCommentsData, useUpdateAlertQueryData } from '@/utils/api/alerts';
import { notFound } from '@/utils/errors';

function AlertItemPage() {
  const { id: alertId } = useParams<'id'>() as { id: string };

  const api = useApi();
  const queryClient = useQueryClient();

  const alertQueryResults = useQuery(ALERT_ITEM(alertId), async (): Promise<Alert> => {
    try {
      return await api.getAlert({ alertId });
    } catch (error: any) {
      if (error?.code === 404) {
        notFound(`Alert with ID "${alertId}" not found`);
      }
      throw error;
    }
  });

  const updateAlertQueryData = useUpdateAlertQueryData();
  const updateAlertItemCommentsData = useUpdateAlertItemCommentsData();

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
    updateAlertItemCommentsData(groupId, (comments) => {
      return [...(comments ?? []), newComment];
    });
  };

  const onReload = () => {
    queryClient.invalidateQueries({ queryKey: ALERT_ITEM(alertId) });
  };

  const [headerStickyElRef, setHeaderStickyElRef] = useState<HTMLDivElement | null>(null);

  const alertItemRes = alertQueryResults.data;

  return (
    <PageWrapper
      header={
        <Card.Root>
          <Header
            headerStickyElRef={setHeaderStickyElRef}
            alertItemRes={alertItemRes}
            onReload={onReload}
            onCommentAdded={handleCommentAdded}
          />
        </Card.Root>
      }
      disableHeaderPadding
    >
      <AsyncResourceRenderer resource={alertItemRes}>
        {(alertItem) => (
          <AlertDetails alertItem={alertItem} headerStickyElRef={headerStickyElRef} />
        )}
      </AsyncResourceRenderer>
    </PageWrapper>
  );
}

export default function CaseManagementItemPageWrapper() {
  return (
    <Authorized minRequiredResources={['read:::case-management/case-details/*']}>
      <AlertItemPage />
    </Authorized>
  );
}
