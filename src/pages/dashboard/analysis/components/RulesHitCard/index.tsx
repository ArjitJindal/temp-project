/* eslint-disable @typescript-eslint/no-var-requires */
import { Card, Col, DatePicker, Row } from 'antd';
import { useCallback, useState } from 'react';
import { RangeValue } from 'rc-picker/lib/interface';
import moment, { Moment } from 'moment';
import _ from 'lodash';
import { Link } from 'react-router-dom';
import RulesHitBreakdown from '../RulesHitBreakdownChart';
import header from '../dashboardutils';
import style from '../../style.module.less';
import { DashboardStatsRulesCountData } from '@/apis';
import { useApi } from '@/api';
import { RequestTable } from '@/components/RequestTable';
import { makeUrl } from '@/utils/routing';
import Button from '@/components/ui/Button';
import { getRuleInstanceDisplay, getRuleInstanceDisplayId } from '@/pages/rules/utils';
import { TableColumn, TableData } from '@/components/ui/Table/types';
import { RuleInstanceMap, RulesMap } from '@/utils/rules';

export default function RuleHitCard() {
  const api = useApi();

  const [dateRange, setDateRange] = useState<RangeValue<Moment>>([
    moment().subtract(1, 'week'),
    moment(),
  ]);
  const [rules, setRules] = useState<RulesMap>({});
  const [ruleInstances, setRuleInstances] = useState<RuleInstanceMap>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [rulesHitData, setRulesHitData] = useState<DashboardStatsRulesCountData[] | []>([]);

  const columns: TableColumn<DashboardStatsRulesCountData>[] = [
    {
      title: 'Rule ID',
      render: (_, stat) => {
        return <div>{getRuleInstanceDisplayId(stat.ruleId, stat.ruleInstanceId)}</div>;
      },
      width: 50,
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

  const request = useCallback(async (): Promise<TableData<DashboardStatsRulesCountData>> => {
    const [rules, ruleInstances] = await Promise.all([api.getRules({}), api.getRuleInstances()]);
    setRules(_.keyBy(rules, 'id'));
    setRuleInstances(_.keyBy(ruleInstances, 'id'));
    let startTimestamp = moment().subtract(1, 'day').valueOf();
    let endTimestamp = Date.now();

    const [start, end] = dateRange ?? [];
    if (start != null && end != null) {
      startTimestamp = start.startOf('day').valueOf();
      endTimestamp = end.endOf('day').valueOf();
    }
    const [result] = await Promise.all([
      api.getDashboardStatsRuleHit({
        startTimestamp,
        endTimestamp,
      }),
    ]);
    setRulesHitData(result.data);
    setLoading(false);
    return {
      success: true,
      total: result.data.length,
      items: result.data,
    };
  }, [api, dateRange]);

  return (
    <Card bordered={false} bodyStyle={{ padding: 0 }}>
      <Row>
        <Col span={12}>
          <RequestTable<DashboardStatsRulesCountData>
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
            request={request}
            defaultSize={'small'}
            pagination={false}
            options={{
              density: false,
              setting: false,
              reload: true,
            }}
          />
        </Col>
        <Col span={12}>
          <RulesHitBreakdown
            loading={loading}
            data={rulesHitData}
            ruleInstances={ruleInstances}
            rules={rules}
          />{' '}
        </Col>
      </Row>
    </Card>
  );
}
