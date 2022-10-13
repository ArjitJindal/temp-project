import React from 'react';
import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import TransactionDetailsCard from './components/TransactionDetailsCard';
import Header from './components/Header';
import RulesHitCard from './components/RulesHitCard';
import { Case } from '@/apis';
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

function CaseManagementItemPage() {
  const { id: caseId } = useParams<'id'>() as { id: string };
  const i18n = useI18n();
  const api = useApi();
  const queryClient = useQueryClient();
  const backUrl = useBackUrl();

  const queryResults = useQuery(
    CASES_ITEM(caseId),
    (): Promise<Case> =>
      api.getCase({
        caseId,
      }),
  );

  const handleCaseUpdate = (caseItem: Case) => {
    queryClient.setQueryData(CASES_ITEM(caseId), caseItem);
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
          {(caseItem) => {
            if (caseItem.caseTransactions == null || caseItem.caseTransactions.length === 0) {
              throw new Error(`Case doesn't have transactions`);
            }
            if (caseItem.caseTransactions.length > 1) {
              console.warn('Case have more than one transaction, it is not supported for a moment');
            }
            const [transaction] = caseItem.caseTransactions;
            return (
              <>
                <Card.Section>
                  <Header
                    caseItem={caseItem}
                    onReload={() => {
                      queryResults.refetch();
                    }}
                  />
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
                    caseId={caseItem.caseId}
                    comments={caseItem.comments ?? []}
                    onCommentsUpdate={(newComments) => {
                      handleCaseUpdate({ ...caseItem, comments: newComments });
                    }}
                  />
                </Card.Section>
              </>
            );
          }}
        </AsyncResourceRenderer>
      </Card.Root>
    </PageWrapper>
  );
}
export default CaseManagementItemPage;
