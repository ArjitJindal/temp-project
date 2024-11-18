import React from 'react';
import { getFlatSanctionsDetails } from './helpers';
import ApprovalDetails from './RuleAndCaseDetails';
import ScreeningMatchList from '@/components/ScreeningMatchList';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import { TRANSACTIONS_ITEM } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { InternalTransaction } from '@/apis';

interface Props {
  transactionId: string;
}

export default function ExpandedRowRenderer(props: Props) {
  const { transactionId } = props;
  const settings = useSettings();
  const api = useApi();
  const queryResult = useQuery(TRANSACTIONS_ITEM(transactionId), () =>
    api.getTransaction({ transactionId }),
  );

  return (
    <AsyncResourceRenderer<InternalTransaction> resource={queryResult.data}>
      {(transaction) => {
        if (settings.isPaymentApprovalEnabled && transaction?.status === 'SUSPEND') {
          return <ApprovalDetails transaction={transaction} action={'SUSPEND'} />;
        }

        return <ScreeningMatchList details={getFlatSanctionsDetails(transaction)} />;
      }}
    </AsyncResourceRenderer>
  );
}
