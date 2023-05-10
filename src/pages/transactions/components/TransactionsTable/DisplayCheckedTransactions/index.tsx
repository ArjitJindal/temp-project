import { useState } from 'react';
import { Link } from 'react-router-dom';
import UserSearchButton from '../../UserSearchButton';
import s from './styles.module.less';
import { useApi } from '@/api';
import { Alert } from '@/apis';
import Modal from '@/components/ui/Modal';
import { DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { useCursorQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { useApiTime } from '@/utils/tracker';
import InformationIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import COLORS from '@/components/ui/colors';
import { dayjs } from '@/utils/dayjs';

type Props = {
  alert: Alert;
  caseUserId: string;
  visible: boolean;
  setVisible: (visible: boolean) => void;
};

const DisplayCheckedTransactions = (props: Props) => {
  const { alert, caseUserId, visible: isModalVisible, setVisible: setIsModalVisible } = props;
  const [count] = useState(0);
  const [params, setParams] = useState<TransactionsTableParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [['timestamp', 'descend']],
  });

  const api = useApi();
  const measure = useApiTime();
  const queryResult = useCursorQuery(
    TRANSACTIONS_LIST({ ...params, caseUserId }),
    async ({ from }) => {
      const {
        pageSize,
        page,
        timestamp,
        transactionId,
        type,
        transactionState,
        originCurrenciesFilter,
        destinationCurrenciesFilter,
        tagKey,
        tagValue,
        originMethodFilter,
        destinationMethodFilter,
      } = params;
      const [sortField, sortOrder] = params.sort[0] ?? [];

      return await measure(
        () =>
          api.getTransactionsList({
            page,
            pageSize,
            _from: from,
            afterTimestamp: timestamp ? dayjs(timestamp[0]).valueOf() : 0,
            beforeTimestamp: timestamp ? dayjs(timestamp[1]).valueOf() : Date.now(),
            filterId: transactionId,
            filterOriginCurrencies: originCurrenciesFilter,
            filterDestinationCurrencies: destinationCurrenciesFilter,
            transactionType: type,
            filterTransactionState: transactionState,
            sortField: sortField ?? undefined,
            sortOrder: sortOrder ?? undefined,
            includeUsers: true,
            filterOriginPaymentMethod: originMethodFilter,
            filterDestinationPaymentMethod: destinationMethodFilter,
            filterTagKey: tagKey,
            filterTagValue: tagValue,
            filterOriginUserId: params.userFilterMode === 'ORIGIN' ? params.userId : undefined,
            filterDestinationUserId:
              params.userFilterMode === 'DESTINATION' ? params.userId : undefined,
            filterUserId: caseUserId,
            filterRuleInstancesHit: [alert.ruleInstanceId],
          }),
        'Transactions List',
      );
    },
  );

  return (
    <Modal
      title={`Transactions checked (${count})`}
      isOpen={isModalVisible}
      onCancel={() => setIsModalVisible(false)}
      width={'calc(100vw - 160px)'}
      hideFooter
      className={s.modal}
    >
      <div>
        <div className={s.container}>
          <div className={s.header} style={{ width: 'calc(25% - 20px)' }}>
            <div className={s.headerContent}>Rule ID</div>
            <div className={s.content} style={{ color: COLORS.brandBlue.base }}>
              <Link to={`/rules/my-rules?focus=${alert.ruleInstanceId}`} target="_blank">
                {alert.ruleId} ({alert.ruleInstanceId})
              </Link>
            </div>
          </div>
          <div className={s.header} style={{ width: 'calc(25% - 20px)' }}>
            <div className={s.headerContent}>Rule Name</div>
            <div className={s.content}>{alert.ruleName}</div>
          </div>
          <div className={s.header} style={{ width: 'calc(50% - 20px)' }}>
            <div className={s.headerContent}>Rule Description</div>
            <div className={s.content}>{alert.ruleDescription}</div>
          </div>
        </div>
        <TransactionsTable
          queryResult={queryResult}
          params={params}
          onChangeParams={setParams}
          extraFilters={[
            {
              key: 'userId',
              title: 'User ID/name',
              renderer: ({ params, setParams }) => (
                <UserSearchButton
                  initialMode={params.userFilterMode ?? 'ALL'}
                  userId={params.userId ?? null}
                  onConfirm={(userId, mode) => {
                    setParams((state) => ({
                      ...state,
                      userId: userId ?? undefined,
                      userFilterMode: mode ?? undefined,
                    }));
                  }}
                />
              ),
            },
          ]}
          alert={alert}
          fitHeight={370}
          paginationBorder
        />
        <p className={s.info}>
          <InformationIcon height={12} width={12} /> This may show the transactions from closed
          cases for the same user.
        </p>
      </div>
    </Modal>
  );
};

export default DisplayCheckedTransactions;
