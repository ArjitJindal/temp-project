import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import TransactionDetailsCard from './components/TransactionDetailsCard';
import Header from './components/Header';
import RulesHitCard from './components/RulesHitCard';
import { ApiException, TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import { AsyncResource, failed, init, loading, success } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { makeUrl } from '@/utils/routing';
import * as Card from '@/components/ui/Card';
import TransactionEventsCard from '@/pages/transactions-item/TransactionEventsCard';
import UserDetailsCard from '@/pages/case-management-item/components/UserDetailsCard';

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
  const { id: transactionId } = useParams<'id'>();
  const [currentCase, setCurrentCase] = useState<AsyncResource<TransactionCaseManagement>>(init());
  const api = useApi();

  useEffect(() => {
    if (transactionId == null) {
      setCurrentCase(failed(`Transaction id is not specified`));
      return;
    }
    setCurrentCase(loading());
    let isCanceled = false;
    api
      .getTransaction({
        transactionId,
      })
      .then((transaction) => {
        if (isCanceled) {
          return;
        }
        setCurrentCase(success(transaction));
      })
      .catch((e) => {
        if (isCanceled) {
          return;
        }
        // todo: i18n
        let message = 'Unknown error';
        if (e instanceof ApiException && e.code === 404) {
          message = `Unable to find transaction by id "${transactionId}"`;
        } else if (e instanceof Error && e.message) {
          message = e.message;
        }
        setCurrentCase(failed(message));
      });
    return () => {
      isCanceled = true;
    };
  }, [transactionId, api]);

  const i18n = useI18n();

  return (
    <PageWrapper
      backButton={{
        title: i18n('menu.case-management.item.back-button'),
        url: makeUrl('/case-management'),
      }}
    >
      <Card.Root>
        <AsyncResourceRenderer resource={currentCase}>
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
              </Card.Section>
            </>
          )}
        </AsyncResourceRenderer>
      </Card.Root>
    </PageWrapper>
  );
}
export default CaseManagementItemPage;
