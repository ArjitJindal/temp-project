/* eslint-disable @typescript-eslint/no-var-requires */
import { Card, DatePicker, Row, Col } from 'antd';
import { ActionType } from '@ant-design/pro-table';
import { useEffect, useRef, useState } from 'react';
import { ProColumns, RequestData } from '@ant-design/pro-table/lib/typing';
import { RangeValue } from 'rc-picker/lib/interface';
import type { ResizeCallbackData } from 'react-resizable';
import moment, { Moment } from 'moment';
import _ from 'lodash';
import { Link } from 'react-router-dom';
import RulesHitBreakdown from '../RulesHitBreakdownChart';
import header from '../dashboardutils';
import style from '../../style.module.less';
import { DashboardStatsRulesCountData, Rule } from '@/apis';
import { useApi } from '@/api';
import Table, { ResponsePayload } from '@/components/ui/Table';
import ResizableTitle from '@/utils/table-utils';
import { makeUrl } from '@/utils/routing';
import Button from '@/components/ui/Button';
import handleResize from '@/components/ui/Table/utils';

export default function RuleHitCard() {
  const api = useApi();

  const [dateRange, setDateRange] = useState<RangeValue<Moment>>([
    moment().subtract(1, 'week'),
    moment(),
  ]);
  const [rules, setRules] = useState<{ [key: string]: Rule }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [rulesHitData, setRulesHitData] = useState<DashboardStatsRulesCountData[] | []>([]);

  const [updatedColumnWidth, setUpdatedColumnWidth] = useState<{
    [key: number]: number;
  }>({});

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
      width: 300,
    },
    {
      title: 'Rule Name',
      render: (_, stat) => {
        return <div>{rules[stat.ruleId].name}</div>;
      },
      width: 300,
    },
    {
      title: 'Hit Count',
      dataIndex: 'hitCount',
      width: 300,
    },
    {
      title: 'Actions',
      width: 400,
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

  const mergeColumns: ProColumns<DashboardStatsRulesCountData>[] = columns.map((col, index) => ({
    ...col,
    width: updatedColumnWidth[index] || col.width,
    onHeaderCell: (column) => ({
      width: (column as ProColumns<DashboardStatsRulesCountData>).width,
      onResize: handleResize(index, setUpdatedColumnWidth),
    }),
  }));

  return (
    <Card bordered={false} bodyStyle={{ padding: 0 }}>
      <Row>
        <Col span={12}>
          <Table<DashboardStatsRulesCountData>
            actionRef={actionRef}
            form={{
              labelWrap: true,
            }}
            components={{
              header: {
                cell: ResizableTitle,
              },
            }}
            headerTitle={header('Top Rule Hits by Count')}
            search={false}
            columns={mergeColumns}
            className={style.table}
            scroll={{ x: 1300 }}
            toolBarRender={() => [
              <DatePicker.RangePicker value={dateRange} onChange={setDateRange} />,
            ]}
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
              setRulesHitData(result.data);
              setLoading(false);
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
        </Col>
        <Col span={12}>
          <RulesHitBreakdown loading={loading} data={rulesHitData} />{' '}
        </Col>
      </Row>
    </Card>
  );
}
