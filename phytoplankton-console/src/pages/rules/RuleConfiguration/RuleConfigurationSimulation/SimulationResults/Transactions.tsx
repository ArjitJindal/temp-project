import { useState } from 'react';
import { startCase } from 'lodash';
import s from './index.module.less';
import { useApi } from '@/api';
import { SimulationBeaconHit, SimulationBeaconTransactionResult } from '@/apis';
import * as Card from '@/components/ui/Card';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import {
  DATE,
  MONEY,
  PAYMENT_METHOD,
  RULE_ACTION_STATUS,
  STRING,
  TRANSACTION_ID,
  TRANSACTION_TYPE,
} from '@/components/library/Table/standardDataTypes';
import Tag from '@/components/library/Tag';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import Link from '@/components/ui/Link';
import { H4 } from '@/components/ui/Typography';
import { getUserLink } from '@/utils/api/users';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { SIMULATION_JOB_ITERATION_RESULT } from '@/utils/queries/keys';
import { CommonParams } from '@/components/library/Table/types';
import { dayjs } from '@/utils/dayjs';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';

interface SimulationTransactionsHitProps {
  taskId: string;
}

interface TableParams extends CommonParams {
  transactionId?: string;
  userId?: string;
  originPaymentMethod?: string;
  destinationPaymentMethod?: string;
  transactionType?: string;
  hit?: string;
  timestamp?: string[];
}

export const SimulationTransactionsHit = (props: SimulationTransactionsHitProps) => {
  const { taskId } = props;
  const [params, setParams] = useState<TableParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [['timestamp', 'descend']],
  });
  const api = useApi();
  const transactionResults = usePaginatedQuery(
    SIMULATION_JOB_ITERATION_RESULT(taskId, params),
    async (paginationParams) => {
      const { timestamp, ...restParams } = params;
      const response = await api.getSimulationTaskIdResult({
        taskId,
        ...restParams,
        page: paginationParams.page || params.page,
        pageSize: params.pageSize,
        filterType: 'BEACON_TRANSACTION',
        filterTransactionId: params.transactionId,
        filterHitStatus: params.hit,
        filterStartTimestamp: timestamp ? dayjs(timestamp[0]).valueOf() : undefined,
        filterEndTimestamp: timestamp ? dayjs(timestamp[1]).valueOf() : undefined,
        filterOriginPaymentMethod: params.originPaymentMethod,
        filterDestinationPaymentMethod: params.destinationPaymentMethod,
        filterTransactionType: params.transactionType,
        filterUserId: params.userId,
      });
      return {
        items: response.items as SimulationBeaconTransactionResult[],
        total: response.total,
      };
    },
  );

  const helper = new ColumnHelper<SimulationBeaconTransactionResult>();

  const columns = helper.list([
    helper.simple<'transactionId'>({
      key: 'transactionId',
      title: 'Transaction ID',
      filtering: true,
      pinFilterToLeft: true,
      type: TRANSACTION_ID(),
    }),
    helper.simple<'hit'>({
      key: 'hit',
      title: 'Simulation status',
      type: {
        render: (value: SimulationBeaconHit | undefined) => {
          return (
            <Tag color={value === 'HIT' ? 'red' : 'green'}>
              {startCase(value?.split('_').join(' ').toLowerCase() ?? '')}
            </Tag>
          );
        },
        autoFilterDataType: {
          displayMode: 'list',
          kind: 'select',
          mode: 'SINGLE',
          options: [
            { value: 'HIT', label: 'Hit' },
            { value: 'MISS', label: 'Miss' },
          ],
        },
      },
      filtering: true,
    }),
    helper.simple<'timestamp'>({
      key: 'timestamp',
      title: 'Timestamp',
      type: DATE,
      filtering: true,
      sorting: true,
    }),
    helper.simple<'transactionType'>({
      key: 'transactionType',
      title: 'Transaction type',
      type: TRANSACTION_TYPE,
      filtering: true,
    }),
    helper.simple<'action'>({
      key: 'action',
      title: 'Action',
      type: RULE_ACTION_STATUS,
      filtering: true,
    }),
    helper.simple<'originUser.userId'>({
      key: 'originUser.userId',
      title: 'Origin user ID',
      type: {
        render: (userId, { item: entity }) => {
          const user = entity.originUser;
          if (!user) {
            return <>-</>;
          }

          return (
            <Link to={getUserLink({ type: user.userType, userId: user.userId }) ?? '#'}>
              {userId}
            </Link>
          );
        },
        link: (userId, entity) => {
          const user = entity.originUser;
          if (!user) {
            return '#';
          }
          return getUserLink({ type: user.userType, userId: user.userId }) ?? '#';
        },
      },
    }),
    helper.simple<'originUser.userName'>({
      key: 'originUser.userName',
      title: 'Origin user name',
      type: STRING,
    }),
    helper.simple<'originPaymentDetails.paymentMethod'>({
      key: 'originPaymentDetails.paymentMethod',
      title: 'Origin payment method',
      type: PAYMENT_METHOD,
      filtering: true,
    }),
    helper.derived({
      id: 'originAmountDetails',
      title: 'Origin amount',
      value: (entity) => {
        return {
          amountValue: entity.originAmountDetails?.transactionAmount ?? 0,
          amountCurrency: entity.originAmountDetails?.transactionCurrency ?? 'USD',
        };
      },
      type: {
        ...MONEY,
        stringify: (val) => {
          return String(val?.amountValue ?? '-');
        },
      },
      sorting: true,
    }),
    helper.simple<'originPaymentDetails.paymentMethodId'>({
      key: 'originPaymentDetails.paymentMethodId',
      title: 'Origin payment method ID',
      type: STRING,
    }),
    helper.simple<'destinationUser.userId'>({
      key: 'destinationUser.userId',
      title: 'Destination user ID',
      type: {
        render: (userId, { item: entity }) => {
          const user = entity.destinationUser;
          if (!user) {
            return <>-</>;
          }
          return (
            <Link to={getUserLink({ type: user.userType, userId: user.userId }) ?? '#'}>
              {userId}
            </Link>
          );
        },
        link: (userId, entity) => {
          const user = entity.destinationUser;
          if (!user) {
            return '#';
          }
          return getUserLink({ type: user.userType, userId: user.userId }) ?? '#';
        },
      },
    }),
    helper.simple<'destinationUser.userName'>({
      key: 'destinationUser.userName',
      title: 'Destination user name',
      type: STRING,
    }),
    helper.simple<'destinationPaymentDetails.paymentMethod'>({
      key: 'destinationPaymentDetails.paymentMethod',
      title: 'Destination payment method',
      type: PAYMENT_METHOD,
      filtering: true,
    }),
    helper.derived({
      id: 'destinationAmountDetails',
      title: 'Destination amount',
      value: (entity) => {
        return {
          amountValue: entity.destinationAmountDetails?.transactionAmount ?? 0,
          amountCurrency: entity.destinationAmountDetails?.transactionCurrency ?? 'USD',
        };
      },
      type: {
        ...MONEY,
        stringify: (val) => {
          return String(val?.amountValue ?? '-');
        },
      },
      sorting: true,
    }),
    helper.simple<'destinationPaymentDetails.paymentMethodId'>({
      key: 'destinationPaymentDetails.paymentMethodId',
      title: 'Destination payment method ID',
      type: STRING,
    }),
  ]);

  return (
    <Card.Root className={s.card}>
      <Card.Section>
        <H4>Simulated transactions</H4>
        <QueryResultsTable<SimulationBeaconTransactionResult, TableParams>
          columns={columns}
          queryResults={transactionResults}
          params={params}
          onChangeParams={setParams}
          rowKey="transactionId"
          fitHeight
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
          ]}
        />
      </Card.Section>
    </Card.Root>
  );
};
