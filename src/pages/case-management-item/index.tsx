import React from 'react';
import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import TransactionDetailsCard from './components/TransactionDetailsCard';
import Header from './components/Header';
import RulesHitCard from './components/RulesHitCard';
import { TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { makeUrl } from '@/utils/routing';
import * as Card from '@/components/ui/Card';
import TransactionEventsCard from '@/pages/transactions-item/TransactionEventsCard';
import UserDetailsCard from '@/pages/case-management-item/components/UserDetailsCard';
import CommentsCard from '@/pages/case-management-item/components/CommentsCard';
import { useBackUrl } from '@/utils/backUrl';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { CASES_ITEM } from '@/utils/queries/keys';

export type CaseManagementItem = TransactionCaseManagement & {
  index: number;
  transactionId?: string;
  isFirstRow: boolean;
  isLastRow: boolean;
  rowSpan: number;
  ruleName: string | null;
  ruleDescription: string | null;
  rowKey: string;
};

function CaseManagementItemPage() {
  const { id: transactionId } = useParams<'id'>() as { id: string };
  const i18n = useI18n();
  const api = useApi();
  const queryClient = useQueryClient();
  const backUrl = useBackUrl();

  const queryResults = useQuery(
    CASES_ITEM(transactionId),
    (): Promise<TransactionCaseManagement> =>
      api.getTransaction({
        transactionId,
      }),
  );

  const handleTransactionUpdate = (transaction: TransactionCaseManagement) => {
    queryClient.setQueryData(CASES_ITEM(transactionId), transaction);
  };

  return (
    <PageWrapper
      backButton={{
        title: i18n('menu.case-management.item.back-button'),
        url: backUrl ?? makeUrl('/case-management'),
      }}
    >
      <Card.Root>
        <AsyncResourceRenderer resource={queryResults.data}>
          {(transaction) => (
            <>
              <Card.Section>
                <Header transaction={transaction} />
              </Card.Section>
              <Card.Section>
                <TransactionDetailsCard transaction={transaction} />
                <RulesHitCard rulesHit={transaction.hitRules} />
                <TransactionEventsCard events={transaction.events ?? []} />
                <UserDetailsCard
                  title="Origin (Sender) User Details"
                  user={transaction.originUser}
                />
                <UserDetailsCard
                  title="Destination (Receiver) User Details"
                  user={transaction.destinationUser}
                />
                <CommentsCard
                  transactionId={transactionId}
                  comments={transaction.comments ?? []}
                  onCommentsUpdate={(newComments) => {
                    handleTransactionUpdate({ ...transaction, comments: newComments });
                  }}
                />
              </Card.Section>
            </>
          )}
        </AsyncResourceRenderer>
      </Card.Root>
    </PageWrapper>
  );
}
export default CaseManagementItemPage;
