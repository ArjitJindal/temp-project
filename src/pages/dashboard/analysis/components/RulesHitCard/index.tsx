/* eslint-disable @typescript-eslint/no-var-requires */
import { Card, Col, DatePicker, Row } from 'antd';
import { useState } from 'react';
import { RangeValue } from 'rc-picker/lib/interface';
import moment, { Moment } from 'moment';
import _ from 'lodash';
import { Link } from 'react-router-dom';
import RulesHitBreakdown from '../RulesHitBreakdownChart';
import { header } from '../dashboardutils';
import style from '../../style.module.less';
import { DashboardStatsRulesCountData } from '@/apis';
import { useApi } from '@/api';
import { makeUrl } from '@/utils/routing';
import Button from '@/components/ui/Button';
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
      title: 'Hit Count',
      dataIndex: 'hitCount',
      width: 50,
      render: (_, entity) => {
        let startTimestamp;
        let endTimestamp;
        const [start, end] = dateRange ?? [];
        if (start != null && end != null) {
          startTimestamp = start.startOf('day').valueOf();
          endTimestamp = end.endOf('day').valueOf();
        }
        return (
          <Link
            to={makeUrl(
              '/case-management',
              {},
              {
                rulesHitFilter: rules[entity.ruleId].id,
                timestamp: `${startTimestamp},${endTimestamp}`,
              },
            )}
          >
            {entity.hitCount?.toLocaleString()}
          </Link>
        );
      },
      exportData: (entity) => {
        return entity.hitCount;
      },
    },
    {
      title: 'Actions',
      width: 50,
      render: (_, stat) => {
        return (
          <Link
            to={makeUrl(
              '/case-management/transaction',
              {},
              {
                rulesHitFilter: rules[stat.ruleId].id,
              },
            )}
          >
            <Button analyticsName="View user cases" size="small" type="ghost">
              View Cases
            </Button>
          </Link>
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
        <Col span={12}>
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
        <Col span={12}>
          <RulesHitBreakdown
            loading={rulesHitResult.data.kind === 'LOADING'}
            data={rulesHitResult.data.kind === 'SUCCESS' ? rulesHitResult.data?.value.items : []}
            ruleInstances={ruleInstances}
            rules={rules}
          />{' '}
        </Col>
      </Row>
    </Card>
  );
}
