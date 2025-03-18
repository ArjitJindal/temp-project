import React, { useMemo, useState } from 'react';
import { getRiskLevelFromScore } from '@flagright/lib/utils/risk';
import { Typography } from 'antd';
import { InternalTransactionEvent, RiskLevel } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  DATE_TIME,
  FLOAT,
  ID,
  RISK_LEVEL,
  TRANSACTION_STATE,
} from '@/components/library/Table/standardDataTypes';
import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_EVENTS_FIND } from '@/utils/queries/keys';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { CommonParams, TableColumn } from '@/components/library/Table/types';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { getOr } from '@/utils/asyncResource';
import AuditLogModal from '@/pages/auditlog/components/AuditLogModal';
import Tooltip from '@/components/library/Tooltip';

interface Props {
  transactionId: string;
}

interface Params extends CommonParams {}

export default function TransactionEventsTable(props: Props) {
  const { transactionId } = props;
  const [params, setParams] = useState<Params>({
    pageSize: DEFAULT_PAGE_SIZE,
    page: 1,
    sort: [],
  });

  const api = useApi();

  const riskClassificationQuery = useRiskClassificationScores();
  const riskClassificationValues = getOr(riskClassificationQuery, []);

  const queryResults = usePaginatedQuery(
    TRANSACTIONS_EVENTS_FIND(transactionId, params),
    (params) =>
      api.getTransactionEvents({
        transactionId,
        page: params.page,
        pageSize: params.pageSize,
      }),
  );
  const columns: TableColumn<InternalTransactionEvent>[] = useMemo(() => {
    const helper = new ColumnHelper<InternalTransactionEvent>();
    return helper.list([
      helper.simple({
        title: 'Event ID',
        key: 'eventId',
        type: ID,
        defaultWidth: 200,
      }),
      helper.simple({
        title: 'Transaction state',
        key: 'transactionState',
        type: TRANSACTION_STATE,
      }),
      helper.simple({
        title: 'Event time',
        key: 'timestamp',
        type: DATE_TIME,
      }),
      helper.simple({
        title: 'Description',
        key: 'eventDescription',
        defaultWidth: 300,
      }),
      helper.simple({
        title: 'Reason',
        key: 'reason',
        defaultWidth: 300,
      }),
      helper.simple<'riskScoreDetails.trsScore'>({
        title: 'TRS score',
        key: 'riskScoreDetails.trsScore',
        type: FLOAT,
      }),
      helper.derived({
        title: 'TRS level',
        type: RISK_LEVEL,
        value: (entity): RiskLevel | undefined => {
          return getRiskLevelFromScore(
            riskClassificationValues,
            entity.riskScoreDetails?.trsScore || null,
          );
        },
      }),
      helper.derived({
        title: 'Changes',
        value: (item) => item,
        exporting: false,
        type: {
          render: (item) => {
            if (!(item?.updatedTransactionAttributes || item?.metaData)) {
              return (
                <Tooltip title="No changes were made to the transaction details.">
                  <Typography.Text type={'secondary'}>View Changes</Typography.Text>
                </Tooltip>
              );
            }
            return (
              <AuditLogModal
                data={{
                  type: 'Transaction',
                  oldImage: {},
                  newImage: item.updatedTransactionAttributes || {},
                  showNotChanged: false,
                  showOldImage: false,
                  metaData: item.metaData,
                }}
              />
            );
          },
        },
      }),
    ]);
  }, [riskClassificationValues]);

  return (
    <QueryResultsTable<InternalTransactionEvent, Params>
      queryResults={queryResults}
      rowKey="eventId"
      params={params}
      onChangeParams={setParams}
      columns={columns}
      pagination
      toolsOptions={false}
    />
  );
}
