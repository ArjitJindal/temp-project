/* eslint-disable @typescript-eslint/no-var-requires */
import { Card, DatePicker } from 'antd';
import { ActionType } from '@ant-design/pro-table';
import { useEffect, useRef, useState } from 'react';
import { ProColumns } from '@ant-design/pro-table/es/typing';
import { RangeValue } from 'rc-picker/es/interface';
import moment, { Moment } from 'moment';
import _ from 'lodash';
import { Link } from 'react-router-dom';
import { DashboardStatsRulesCountData, Rule } from '@/apis';
import { useApi } from '@/api';
import Table, { ResponsePayload } from '@/components/ui/Table';
import { makeUrl } from '@/utils/routing';
import Button from '@/components/ui/Button';

export default function RuleHitCard() {
  const api = useApi();

  const [dateRange, setDateRange] = useState<RangeValue<Moment>>([
    moment().subtract(1, 'week'),
    moment(),
  ]);
  const [rules, setRules] = useState<{ [key: string]: Rule }>({});

  const actionRef = useRef<ActionType>();
  useEffect(() => {
    if (actionRef.current) {
      actionRef.current?.reload();
    }
  }, [dateRange]);

  const columns: ProColumns<DashboardStatsRulesCountData>[] = [
    {
      title: 'Rule ID',
      dataIndex: 'ruleId',
      width: '10%',
    },
    {
      title: 'Rule Name',
      render: (_, stat) => {
        return <div>{rules[stat.ruleId].name}</div>;
      },
    },
    {
      title: 'Hit Count',
      width: '25%',
      dataIndex: 'hitCount',
    },
    {
      title: 'Actions',
      width: '25%',
      render: (_, stat) => {
        return (
          <Link
            to={makeUrl(
              '/case-management/all',
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

  return (
    <Card bordered={false} bodyStyle={{ padding: 0 }}>
      <Table<DashboardStatsRulesCountData>
        actionRef={actionRef}
        form={{
          labelWrap: true,
        }}
        headerTitle="Top rules by hit count"
        search={false}
        columns={columns}
        toolBarRender={() => [<DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
        request={async (): Promise<ResponsePayload<DashboardStatsRulesCountData>> => {
          const [rules] = await Promise.all([api.getRules({})]);
          setRules(_.keyBy(rules, 'id'));
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

          return {
            success: true,
            total: result.data.length,
            data: result.data,
          };
        }}
        defaultSize={'small'}
        pagination={false}
        options={{
          density: false,
          setting: false,
          reload: true,
        }}
      />
    </Card>
  );
}
