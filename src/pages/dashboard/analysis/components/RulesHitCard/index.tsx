/* eslint-disable @typescript-eslint/no-var-requires */
import { Card, Col, DatePicker, Row } from 'antd';
import { useState } from 'react';
import { RangeValue } from 'rc-picker/lib/interface';
import moment, { Moment } from 'moment';
import _ from 'lodash';
import { Link } from 'react-router-dom';
import { header } from '../dashboardutils';
import style from '../../style.module.less';
import { DashboardStatsRulesCountData } from '@/apis';
import { useApi } from '@/api';
import { makeUrl } from '@/utils/routing';
import { getRuleInstanceDisplay, getRuleInstanceDisplayId } from '@/pages/rules/utils';
import { TableColumn } from '@/components/ui/Table/types';
import { useRules } from '@/utils/rules';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { HITS_PER_USER_STATS } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';

export default function RuleHitCard() {
  const api = useApi();

  const [dateRange, setDateRange] = useState<RangeValue<Moment>>([
    moment().subtract(1, 'week'),
    moment(),
  ]);
  const { rules, ruleInstances } = useRules();

  const columns: TableColumn<DashboardStatsRulesCountData>[] = [
    {
      title: 'Rule ID',
      render: (_, stat) => {
        return <div>{getRuleInstanceDisplayId(stat.ruleId, stat.ruleInstanceId)}</div>;
      },
      width: 50,
      exportData: (stat) => {
        return getRuleInstanceDisplayId(stat.ruleId, stat.ruleInstanceId);
      },
    },
    {
      title: 'Rule Name',
      render: (_, stat) => {
        return (
          <div>
            {getRuleInstanceDisplay(stat.ruleId, stat.ruleInstanceId, rules, ruleInstances)}
          </div>
        );
      },
      width: 150,
      exportData: (stat) => {
        return getRuleInstanceDisplay(stat.ruleId, stat.ruleInstanceId, rules, ruleInstances);
      },
    },
    {
      title: 'Rules Hit',
      dataIndex: 'hitCount',
      width: 50,
      render: (_, entity) => {
        return <>{entity.hitCount?.toLocaleString()}</>;
      },
      exportData: (entity) => {
        return entity.hitCount;
      },
    },
    {
      title: 'Open Cases',
      width: 100,
      render: (dom, entity) => {
        return (
          <>
            <div>
              <Link
                to={makeUrl(
                  '/case-management/transaction',
                  {},
                  {
                    rulesHitFilter: entity.ruleInstanceId,
                  },
                )}
              >
                {entity.openTransactionCasesCount} Transaction Cases
              </Link>
            </div>
            <Link
              to={makeUrl(
                '/case-management/user',
                {},
                {
                  rulesHitFilter: entity.ruleInstanceId,
                },
              )}
            >
              {entity.openUserCasesCount} User Cases
            </Link>
          </>
        );
      },
    },
  ];

  const rulesHitResult = usePaginatedQuery(HITS_PER_USER_STATS(dateRange), async () => {
    let startTimestamp = moment().subtract(1, 'day').valueOf();
    let endTimestamp = Date.now();

    const [start, end] = dateRange ?? [];
    if (start != null && end != null) {
      startTimestamp = start.startOf('day').valueOf();
      endTimestamp = end.endOf('day').valueOf();
    }
    const result = await api.getDashboardStatsRuleHit({
      startTimestamp,
      endTimestamp,
    });

    return {
      total: result.data.length,
      items: result.data,
    };
  });

  return (
    <Card bordered={false} bodyStyle={{ padding: 0 }}>
      <Row>
        <Col span={24}>
          <QueryResultsTable<DashboardStatsRulesCountData>
            form={{
              labelWrap: true,
            }}
            headerTitle={header('Top Rule Hits by Count')}
            search={false}
            columns={columns}
            className={style.table}
            scroll={{ x: 1300 }}
            toolBarRender={() => [
              <DatePicker.RangePicker value={dateRange} onChange={setDateRange} />,
            ]}
            queryResults={rulesHitResult}
            defaultSize={'small'}
            pagination={false}
            options={{
              density: false,
              setting: false,
              reload: true,
            }}
            rowKey="ruleId"
          />
        </Col>
      </Row>
    </Card>
  );
}
