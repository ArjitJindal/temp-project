import { useMemo, useState } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import UserSearchButton from '../../UserSearchButton';
import s from './styles.module.less';
import { Alert } from '@/apis';
import Modal from '@/components/library/Modal';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import InformationIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import COLORS from '@/components/ui/colors';
import { RULE_ACTIONS } from '@/apis/models-custom/RuleAction';
import { usePaginatedTransactionList } from '@/utils/api/transactions';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Link from '@/components/ui/Link';

type Props = {
  alert: Alert;
  caseUserId: string;
  visible: boolean;
  setVisible: (visible: boolean) => void;
};

const DisplayCheckedTransactions = (props: Props) => {
  const { alert, caseUserId, visible: isModalVisible, setVisible: setIsModalVisible } = props;
  const settings = useSettings();
  const [params, setParams] = useState<TransactionsTableParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [['timestamp', 'descend']],
  });
  const ruleActionOptions = RULE_ACTIONS.map((action) => {
    return { value: action, label: action };
  });
  const hitDirections = alert.ruleHitMeta?.hitDirections;
  const newParams: TransactionsTableParams = {
    ...params,
    filterRuleInstancesExecuted: [alert.ruleInstanceId],
  };
  if (hitDirections?.length === 1) {
    newParams.direction = hitDirections?.includes('DESTINATION') ? 'incoming' : 'outgoing';
  } else {
    newParams.direction = 'all';
  }
  newParams.userId = caseUserId;
  const { queryResult } = usePaginatedTransactionList(newParams);

  const count = useMemo(() => {
    const [count, limit] =
      queryResult.data?.kind === 'SUCCESS'
        ? [queryResult.data.value.total ?? 0, queryResult.data.value.items.length]
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
      <div className={s.root}>
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
        />
        <p className={s.info}>
          <InformationIcon height={12} width={12} /> This may show the transactions from closed
          cases for the same {settings.userAlias}.
        </p>
      </div>
    </Modal>
  );
};

export default DisplayCheckedTransactions;
