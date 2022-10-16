import React from 'react';
import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import Header from './components/Header';
import { Case } from '@/apis';
import { useApi } from '@/api';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { makeUrl } from '@/utils/routing';
import * as Card from '@/components/ui/Card';
import { useBackUrl } from '@/utils/backUrl';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { CASES_ITEM } from '@/utils/queries/keys';
import TransactionCaseDetails from '@/pages/case-management-item/TransactionCaseDetails';
import UserCaseDetails from '@/pages/case-management-item/UserCaseDetails';

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
          {(caseItem) => (
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
                {caseItem.caseType === 'TRANSACTION' && (
                  <TransactionCaseDetails caseItem={caseItem} onCaseUpdate={handleCaseUpdate} />
                )}
                {caseItem.caseType === 'USER' && (
                  <UserCaseDetails caseItem={caseItem} onCaseUpdate={handleCaseUpdate} />
                )}
              </Card.Section>
            </>
          )}
        </AsyncResourceRenderer>
      </Card.Root>
    </PageWrapper>
  );
}
export default CaseManagementItemPage;
