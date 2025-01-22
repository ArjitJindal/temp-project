import { useState } from 'react';
import { getRiskLevelFromScore } from '@flagright/lib/utils/risk';
import { Typography } from 'antd';
import s from './index.module.less';
import { useApi } from '@/api';
import { InternalUserEvent, RiskLevel, SortOrder } from '@/apis';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { DATE_TIME, FLOAT, ID, RISK_LEVEL } from '@/components/library/Table/standardDataTypes';
import { CommonParams } from '@/components/library/Table/types';
import { useQuery } from '@/utils/queries/hooks';
import { USER_EVENTS_LIST } from '@/utils/queries/keys';
import * as Card from '@/components/ui/Card';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { getOr } from '@/utils/asyncResource';
import AuditLogModal from '@/pages/auditlog/components/AuditLogModal';

type Props = {
  userId: string;
};

export const UserEvents = (props: Props) => {
  const { userId } = props;
  const helper = new ColumnHelper<InternalUserEvent>();
  const api = useApi();
  const [params, setParams] = useState<CommonParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [['timestamp', 'descend']],
  });

  const riskClassificationQuery = useRiskClassificationScores();
  const riskClassificationValues = getOr(riskClassificationQuery, []);

  const queryResults = useQuery(
    USER_EVENTS_LIST({
      userId,
    }),
    async () => {
      return await api.getEventsList({
        userId: userId,
        page: params.page,
        pageSize: params.pageSize,
        sortField: params.sort[0]?.[0],
        sortOrder: params.sort[0]?.[1] as SortOrder,
      });
    },
  );

  const columns = helper.list([
    helper.simple({
      title: 'Event ID',
      key: 'eventId',
      type: ID,
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
    }),
    helper.simple({
      title: 'KRS score',
      key: 'riskScoreDetails.kycRiskScore',
      type: FLOAT,
    }),
    helper.derived<RiskLevel>({
      title: 'KRS level',
      type: RISK_LEVEL,
      value: (entity): RiskLevel | undefined => {
        return getRiskLevelFromScore(
          riskClassificationValues,
          entity.riskScoreDetails?.kycRiskScore || null,
        );
      },
    }),
    helper.simple({
      title: 'CRA score',
      key: 'riskScoreDetails.craRiskScore',
      type: FLOAT,
    }),
    helper.derived<RiskLevel>({
      title: 'CRA level',
      type: RISK_LEVEL,
      value: (entity): RiskLevel | undefined => {
        return getRiskLevelFromScore(
          riskClassificationValues,
          entity.riskScoreDetails?.craRiskScore || null,
        );
      },
    }),
    helper.derived({
      title: 'Actions',
      value: (item) => item,
      exporting: false,
      type: {
        render: (item) => {
          if (!item?.updatedConsumerUserAttributes && !item?.updatedBusinessUserAttributes) {
            return <Typography.Text type={'secondary'}>View Changes</Typography.Text>;
          }
          return (
            <AuditLogModal
              data={{
                type: 'User',
                oldImage: {},
                newImage: item.updatedConsumerUserAttributes
                  ? item.updatedConsumerUserAttributes
                  : item.updatedBusinessUserAttributes ?? {},
                showNotChanged: false,
                showOldImage: false,
              }}
            />
          );
        },
      },
    }),
  ]);
  return (
    <Card.Root className={s.userEventsRoot}>
      <QueryResultsTable
        columns={columns}
        queryResults={queryResults}
        params={params}
        onChangeParams={setParams}
        rowKey="eventId"
      />
    </Card.Root>
  );
};
