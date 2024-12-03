import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import UserSearchButton from '../../UserSearchButton';
import s from './styles.module.less';
import { useApi } from '@/api';
import { Alert } from '@/apis';
import Modal from '@/components/library/Modal';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import TransactionsTable, {
  transactionParamsToRequest,
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { useCursorQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import InformationIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import COLORS from '@/components/ui/colors';
import { RULE_ACTIONS } from '@/apis/models-custom/RuleAction';

type Props = {
  alert: Alert;
  caseUserId: string;
  visible: boolean;
  setVisible: (visible: boolean) => void;
};

const DisplayCheckedTransactions = (props: Props) => {
  const { alert, caseUserId, visible: isModalVisible, setVisible: setIsModalVisible } = props;
  const [params, setParams] = useState<TransactionsTableParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [['timestamp', 'descend']],
  });
  const ruleActionOptions = RULE_ACTIONS.map((action) => {
    return { value: action, label: action };
  });
  const api = useApi();

  const queryResult = useCursorQuery(
    TRANSACTIONS_LIST({ ...params, caseUserId }),
    async ({ from }) => {
      const hitDirections = props.alert.ruleHitMeta?.hitDirections;
      return await api.getTransactionsList({
        ...transactionParamsToRequest(params),
        start: from || params.from,
        ...(hitDirections?.length === 1
          ? {
              filterDestinationUserId: hitDirections?.includes('DESTINATION')
                ? caseUserId
                : undefined,
              filterOriginUserId: hitDirections?.includes('ORIGIN') ? caseUserId : undefined,
            }
          : { filterUserId: caseUserId }),
        filterRuleInstancesExecuted: [alert.ruleInstanceId],
      });
    },
  );
  const count = useMemo(() => {
    const [count, limit] =
      queryResult.data?.kind === 'SUCCESS'
        ? [queryResult.data.value.count, queryResult.data.value.limit]
        : [0, 0];
    return count > limit ? `${limit}+` : `${count}`;
  }, [queryResult.data]);

  return (
    <Modal
      title={`Transactions checked (${count})`}
      isOpen={isModalVisible}
      onCancel={() => setIsModalVisible(false)}
      width="XL"
      hideFooter
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
            <div className={s.headerContent}>Rule name</div>
            <div className={s.content}>{alert.ruleName}</div>
          </div>
          <div className={s.header} style={{ width: 'calc(50% - 20px)' }}>
            <div className={s.headerContent}>Rule description</div>
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
                  userId={params.userId ?? null}
                  onConfirm={(userId) => {
                    setParams((state) => ({
                      ...state,
                      userId: userId ?? undefined,
                    }));
                  }}
                />
              ),
            },
            {
              key: 'transactionStatusFilter',
              title: 'Status',
              renderer: {
                kind: 'select',
                mode: 'MULTIPLE',
                displayMode: 'select',
                options: ruleActionOptions,
              },
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
