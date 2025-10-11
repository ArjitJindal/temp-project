import { useState } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import SanctionDetailSelect from '../SanctionDetailSelect';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import DisplayCheckedTransactions from '@/pages/transactions/components/TransactionsTable/DisplayCheckedTransactions';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useAlertTransactionList } from '@/hooks/api/alerts';
import type { TransactionTableItem } from '@/apis';
import { FIXED_API_PARAMS } from '@/pages/case-management-item/CaseDetails/InsightsCard';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { Alert, PaymentMethod, SanctionsDetails, SanctionsDetailsEntityType } from '@/apis';
import { SelectionAction } from '@/components/library/Table/types';

interface Props {
  alert: Alert;
  caseUserId: string;
  selectedTransactionIds?: string[];
  onTransactionSelect?: (alertId: string, transactionIds: string[]) => void;
  escalatedTransactionIds?: string[];
  fitHeight?: boolean;
  selectionActions?: SelectionAction<TransactionTableItem, TransactionsTableParams>[];
}

export default function TransactionsTab(props: Props) {
  const {
    caseUserId,
    alert,
    escalatedTransactionIds,
    onTransactionSelect,
    selectedTransactionIds,
    selectionActions,
    fitHeight,
  } = props;
  const sanctionDetails = alert?.ruleHitMeta?.sanctionsDetails ?? [];
  const settings = useSettings();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [params, setParams] = useState<TransactionsTableParams>(DEFAULT_PARAMS_STATE);
  const [sanctionsDetailsFilter, setSanctionsDetailsFilter] = useState<
    SanctionsDetails | undefined
  >(sanctionDetails[0]);
  const escalationEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');
  const sarEnabled = useFeatureEnabled('SAR');
  const mapEntityTypeToTransactionMethod: Partial<
    Record<
      SanctionsDetailsEntityType,
      PaymentMethod[] // Using an array as some methods map to the same entity type
    >
  > = {
    NAME_ON_CARD: ['CARD'],
    BANK_ACCOUNT_HOLDER_NAME: ['GENERIC_BANK_ACCOUNT', 'IBAN'],
    PAYMENT_NAME: ['SWIFT', 'UPI', 'WALLET', 'CHECK', 'ACH', 'IBAN', 'NPP'],
    PAYMENT_BENEFICIARY_NAME: ['ACH'],
  };

  const filterSanctionsHitIds = sanctionsDetailsFilter
    ? sanctionsDetailsFilter.sanctionHitIds
    : undefined;
  const filterSanctionsHitId = sanctionsDetailsFilter?.hitContext?.paymentMethodId
    ? undefined
    : filterSanctionsHitIds?.[0];
  const filterPaymentMethodId = sanctionsDetailsFilter?.hitContext?.paymentMethodId;
  const originMethodFilter: PaymentMethod[] = [];
  const destinationMethodFilter: PaymentMethod[] = [];
  if (alert.ruleId === 'R-169' && sanctionsDetailsFilter?.entityType) {
    const entityType = sanctionsDetailsFilter.entityType;
    const methods = mapEntityTypeToTransactionMethod[entityType] ?? [];

    if (alert.ruleHitMeta?.hitDirections?.includes('ORIGIN')) {
      destinationMethodFilter.push(...methods);
    }
    if (alert.ruleHitMeta?.hitDirections?.includes('DESTINATION')) {
      originMethodFilter.push(...methods);
    }
  }
  const transactionsResponse = useAlertTransactionList(
    alert.alertId,
    { ...params, filterSanctionsHitId, filterPaymentMethodId },
    { fixedParams: FIXED_API_PARAMS, enabled: !!alert.alertId },
  );

  return (
    <>
      {sanctionsDetailsFilter && (
        <SanctionDetailSelect
          sanctionDetails={sanctionDetails}
          selectedItem={sanctionsDetailsFilter}
          setSelectedItem={setSanctionsDetailsFilter}
          marginBottom
        />
      )}
      <TransactionsTable
        escalatedTransactions={escalatedTransactionIds}
        selectedIds={selectedTransactionIds}
        selectionInfo={
          selectionActions?.length
            ? {
                entityCount: selectedTransactionIds?.length ?? 0,
                entityName: 'transaction',
              }
            : undefined
        }
        selectionActions={selectionActions}
        onSelect={
          onTransactionSelect
            ? (transactionIds) => {
                if (!alert.alertId) {
                  // message.fatal('Unable to select transactions, alert id is empty');
                  return;
                }
                onTransactionSelect?.(alert.alertId, transactionIds);
              }
            : undefined
        }
        queryResult={transactionsResponse}
        params={params}
        onChangeParams={setParams}
        showCheckedTransactionsButton={true}
        isModalVisible={isModalVisible}
        setIsModalVisible={setIsModalVisible}
        alert={alert}
        fitHeight={fitHeight}
        extraFilters={[
          {
            key: 'userId',
            title: `${firstLetterUpper(settings.userAlias)} ID`,
            showFilterByDefault: true,
            renderer: ({ params, setParams }) => (
              <UserSearchButton
                title={`${firstLetterUpper(settings.userAlias)} ID`}
                userId={params.userId ?? null}
                params={params}
                onConfirm={setParams}
                filterType="id"
              />
            ),
          },
          {
            key: 'userName',
            title: `${firstLetterUpper(settings.userAlias)} name`,
            showFilterByDefault: true,
            renderer: ({ params, setParams }) => (
              <UserSearchButton
                title={`${firstLetterUpper(settings.userAlias)} name`}
                userId={params.userId ?? null}
                params={params}
                onConfirm={setParams}
                filterType="name"
              />
            ),
          },
          {
            title: 'Account name',
            key: 'filterPaymentDetailName',
            renderer: { kind: 'string' },
            showFilterByDefault: false,
          },
        ]}
        canSelectRow={(row) => {
          if (!escalationEnabled && !sarEnabled) {
            return false;
          }
          const alertClosed = alert?.alertStatus === 'CLOSED';
          const transactionEscalated = escalatedTransactionIds?.includes(row.content.transactionId);
          if (alertClosed || transactionEscalated) {
            return false;
          }
          return true;
        }}
      />
      {isModalVisible && alert && (
        <DisplayCheckedTransactions
          visible={isModalVisible}
          setVisible={setIsModalVisible}
          alert={alert}
          caseUserId={caseUserId}
        />
      )}
    </>
  );
}
