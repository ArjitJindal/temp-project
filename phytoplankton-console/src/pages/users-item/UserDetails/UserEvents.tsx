import { useState } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { getRiskLevelFromScore } from '@flagright/lib/utils/risk';
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
import AuditLogModal from '@/pages/auditlog/components/AuditLogModal';
import Tooltip from '@/components/library/Tooltip';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { processTagsRecursively } from '@/utils/object';

type Props = {
  userId: string;
};

const UserEventActions = ({ item }: { item: InternalUserEvent | undefined }) => {
  const settings = useSettings();

  const newImage = processTagsRecursively({
    ...(item?.updatedConsumerUserAttributes || item?.updatedBusinessUserAttributes || {}),
    isKrsLocked: item?.isKrsLocked,
  });

  if (
    !item?.updatedConsumerUserAttributes &&
    !item?.updatedBusinessUserAttributes &&
    item?.isKrsLocked === null
  ) {
    return (
      <Tooltip title={`No changes were made to the ${settings.userAlias} details.`}>
        <span className={s.secondaryText}>View Changes</span>
      </Tooltip>
    );
  }

  return (
    <AuditLogModal
      data={{
        type: firstLetterUpper(settings.userAlias),
        oldImage: {},
        newImage: newImage,
        showNotChanged: false,
        showOldImage: false,
      }}
    />
  );
};

export const UserEvents = (props: Props) => {
  const { userId } = props;
  const helper = new ColumnHelper<InternalUserEvent>();
  const api = useApi();
  const settings = useSettings();
  const configRiskLevelAliasArray = settings?.riskLevelAlias || [];
  const [params, setParams] = useState<CommonParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [['timestamp', 'descend']],
  });

  const riskClassificationValues = useRiskClassificationScores();

  const queryResults = useQuery(
    USER_EVENTS_LIST({
      userId,
      params,
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
          configRiskLevelAliasArray,
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
          configRiskLevelAliasArray,
        );
      },
    }),
    helper.derived({
      title: 'Actions',
      value: (item) => item,
      exporting: false,
      type: {
        render: (item) => <UserEventActions item={item} />,
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
