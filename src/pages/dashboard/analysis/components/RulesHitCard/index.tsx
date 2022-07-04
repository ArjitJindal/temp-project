/* eslint-disable @typescript-eslint/no-var-requires */
import { Card, DatePicker } from 'antd';
import ProTable, { ActionType } from '@ant-design/pro-table';
import React, { useEffect, useRef, useState } from 'react';
import { ProColumns, RequestData } from '@ant-design/pro-table/lib/typing';
import { RangeValue } from 'rc-picker/lib/interface';
import moment, { Moment } from 'moment';
import _ from 'lodash';
import { DashboardStatsRulesCountData, Rule } from '@/apis';
import { useApi } from '@/api';

export default function RuleHitCard() {
  const api = useApi();

  const [dateRange, setDateRange] = useState<RangeValue<Moment>>(null);
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
    },
    {
      title: 'Rule Name',
      render: (_, stat) => {
        return <div>{rules[stat.ruleId].name}</div>;
      },
    },
    {
      title: 'Hit Count',
      dataIndex: 'hitCount',
    },
  ];

  return (
    <Card bordered={false} bodyStyle={{ padding: 0 }}>
      <ProTable<DashboardStatsRulesCountData>
        actionRef={actionRef}
        form={{
          labelWrap: true,
        }}
        headerTitle="Top rules by hit count"
        search={false}
        columns={columns}
        toolBarRender={() => [<DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
        request={async (): Promise<RequestData<DashboardStatsRulesCountData>> => {
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
