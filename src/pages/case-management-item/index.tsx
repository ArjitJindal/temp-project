import React, { useRef } from 'react';
import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import _ from 'lodash';
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
import Button from '@/components/ui/Button';

export interface ExpandTabsRef {
  expand: () => void;
}

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

  const onReload = () => {
    queryResults.refetch();
  };

  const transactionRef = useRef<ExpandTabsRef>(null);
  const userRef = useRef<ExpandTabsRef>(null);

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
                <Header caseItem={caseItem} onReload={onReload} showCloseButton={false} />
              </Card.Section>
              <Button
                type={'text'}
                onClick={
                  caseItem.caseType === 'TRANSACTION'
                    ? () => transactionRef.current?.expand()
                    : () => userRef.current?.expand()
                }
                analyticsName={'case-management-item-expand-button'}
                style={{
                  width: 'max-content',
                  margin: '1rem 1.5rem',
                  color: '#1890ff',
                  borderColor: '#1890ff',
                }}
              >
                Expand All
              </Button>
              <Card.Section>
                {caseItem.caseType === 'TRANSACTION' && (
                  <TransactionCaseDetails
                    caseItem={caseItem}
                    onCaseUpdate={handleCaseUpdate}
                    ref={transactionRef}
                    onReload={onReload}
                  />
                )}

                {caseItem.caseType === 'USER' && (
                  <UserCaseDetails
                    caseItem={caseItem}
                    onCaseUpdate={handleCaseUpdate}
                    ref={userRef}
                    onReload={onReload}
                  />
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
