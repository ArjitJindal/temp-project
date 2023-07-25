import React from 'react';
import { getFlatSanctionsDetails } from './helpers';
import ApprovalDetails from './RuleAndCaseDetails';
import ScreeningMatchList from '@/components/ScreeningMatchList';
import { InternalTransaction } from '@/apis';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  transaction: InternalTransaction;
}

export default function ExpandedRowRenderer(props: Props) {
  const { transaction } = props;
  const settings = useSettings();
  if (settings.isPaymentApprovalEnabled && transaction.status === 'SUSPEND') {
    return <ApprovalDetails transaction={transaction} action={'SUSPEND'} />;
  }

  return <ScreeningMatchList details={getFlatSanctionsDetails(transaction)} />;
}
