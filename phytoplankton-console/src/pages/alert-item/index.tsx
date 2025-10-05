import { useParams } from 'react-router';
import { useState } from 'react';
import Header from './components/Header';
import AlertDetails from './components/AlertDetails';
import { Authorized } from '@/components/utils/Authorized';
import PageWrapper from '@/components/PageWrapper';
import * as Card from '@/components/ui/Card';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useAlert } from '@/hooks/api';
import { Comment } from '@/apis';
import { useUpdateAlertItemCommentsData, useUpdateAlertQueryData } from '@/utils/api/alerts';

function AlertItemPage() {
  const { id: alertId } = useParams<'id'>() as { id: string };

  const alertQueryResults = useAlert(alertId);

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
    alertQueryResults.refetch();
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
