import React, { useCallback, useMemo, useState } from 'react';
import { Tag } from 'antd';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { AllParams, TableColumn, TableData } from '@/components/library/Table/types';
import { QueryResult } from '@/utils/queries/types';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { TableSearchParams } from '@/pages/case-management/types';
import { makeExtraFilters } from '@/pages/case-management/helpers';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import { ALERT_ID, DATE, RULE_NATURE } from '@/components/library/Table/standardDataTypes';
import { useAlertQuery } from '@/pages/case-management/common';
import { ChecklistStatus } from '@/apis';
import { useRuleOptions } from '@/utils/rules';

export type AlertTableParams = AllParams<TableSearchParams> & {
  filterQaStatus?: ChecklistStatus;
  filterOutQaStatus?: ChecklistStatus[];
};

interface Props {
  params: AlertTableParams;
  onChangeParams?: (newState: AlertTableParams) => void;
  isEmbedded?: boolean;
  hideAlertStatusFilters?: boolean;
  hideUserFilters?: boolean;
  caseId?: string;
  escalatedTransactionIds?: string[];
  expandTransactions?: boolean;
  hideAssignedToFilter?: boolean;
  extraColumns?: TableColumn<TableAlertItem>[];
}

export default function QaTable(props: Props) {
  const {
    params: externalParams,
    onChangeParams,
    isEmbedded = false,
    hideUserFilters = false,
    hideAssignedToFilter,
  } = props;
  const isPulseEnabled = useFeatureEnabled('PULSE');
  const [internalParams, setInternalParams] = useState<AlertTableParams | null>(null);
  const params = useMemo(() => internalParams ?? externalParams, [externalParams, internalParams]);

  const queryResults: QueryResult<TableData<TableAlertItem>> = useAlertQuery(params);

  const helper = new ColumnHelper<TableAlertItem>();
  const columns = helper.list([
    helper.simple<'alertId'>({
      title: 'Alert ID',
      key: 'alertId',
      icon: <StackLineIcon />,
      showFilterByDefault: true,
      filtering: true,
      type: ALERT_ID,
    }),
    helper.simple<'ruleQaStatus'>({
      title: 'QA Status',
      key: 'ruleQaStatus',
      type: {
        render: (status) => {
          if (status) {
            return <>{status}</>;
          }
          return <>'-'</>;
        },
      },
    }),
    helper.simple<'ruleName'>({
      title: 'Rule name',
      key: 'ruleName',
    }),
    helper.simple<'ruleDescription'>({
      title: 'Rule description',
      key: 'ruleDescription',
    }),
    helper.simple<'ruleNature'>({
      title: 'Rule nature',
      key: 'ruleNature',
      type: RULE_NATURE,
    }),
    helper.simple<'updatedAt'>({
      title: 'Closed at',
      key: 'updatedAt',
      type: DATE,
      sorting: true,
    }),
    helper.display({
      title: 'Closing Reason',
      enableResizing: false,
      defaultWidth: 200,
      render: (entity) => {
        return (
          <>
            {entity.lastStatusChange?.reason?.map((reason) => (
              <Tag>{reason}</Tag>
            ))}
          </>
        );
      },
    }),
  ]);
  const ruleOptions = useRuleOptions();

  const extraFilters = useMemo(
    () =>
      makeExtraFilters(
        isPulseEnabled,
        ruleOptions,
        hideUserFilters,
        'ALERTS',
        hideAssignedToFilter,
      ),
    [isPulseEnabled, ruleOptions, hideUserFilters, hideAssignedToFilter],
  );

  const handleChangeParams = useCallback(
    (params: AlertTableParams) => {
      if (isEmbedded) {
        setInternalParams(params);
      } else if (onChangeParams) {
        onChangeParams(params);
      }
    },
    [isEmbedded, onChangeParams],
  );

  return (
    <>
      <QueryResultsTable<TableAlertItem, AlertTableParams>
        tableId={isEmbedded ? 'alerts-list-embedded' : 'alerts-list'}
        rowKey={'alertId'}
        fitHeight={isEmbedded ? 500 : true}
        hideFilters={isEmbedded}
        columns={columns}
        queryResults={queryResults}
        params={internalParams ?? params}
        onChangeParams={handleChangeParams}
        extraFilters={extraFilters}
        pagination={isEmbedded ? 'HIDE_FOR_ONE_PAGE' : true}
      />
    </>
  );
}
