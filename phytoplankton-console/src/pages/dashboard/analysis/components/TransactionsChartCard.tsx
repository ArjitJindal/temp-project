/* eslint-disable @typescript-eslint/no-var-requires */
import { Card, Empty, Tabs } from 'antd';
import { Column } from '@ant-design/charts';
import React, { useEffect, useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { useLocalStorageState } from 'ahooks';
import { each, groupBy } from 'lodash';
import { Annotation } from '@antv/g2plot';
import styles from '../style.module.less';
import { header } from './dashboardutils';
import { getRuleActionColorForDashboard } from '@/utils/rules';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs, YEAR_MONTH_DATE_FORMAT } from '@/utils/dayjs';
import { useApi } from '@/api';
import { AsyncResource, failed, getOr, init, loading, success } from '@/utils/asyncResource';
import { DashboardStatsTransactionsCountData } from '@/apis';
import { useRiskActionLabel } from '@/components/AppWrapper/Providers/SettingsProvider';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { escapeHtml } from '@/utils/browser';

type StatsKey = keyof DashboardStatsTransactionsCountData;
const TOTAL_TRANSACTIONS_KEY: StatsKey = 'totalTransactions';
const FLAGGED_TRANSACTIONS_KEY: StatsKey = 'flaggedTransactions';
const STOPPED_TRANSACTIONS_KEY: StatsKey = 'stoppedTransactions';
const SUSPENDED_TRANSACTIONS_KEY: StatsKey = 'suspendedTransactions';

export type timeframe = 'YEAR' | 'MONTH' | 'WEEK' | 'DAY' | null;
const { TabPane } = Tabs;

const TransactionsChartCard = () => {
  type GranularityValuesType = 'HOUR' | 'MONTH' | 'DAY';
  const granularityValues = { HOUR: 'HOUR', MONTH: 'MONTH', DAY: 'DAY' };

  const suspendAlias = useRiskActionLabel('SUSPEND');
  const blockAlias = useRiskActionLabel('BLOCK');
  const flagAlias = useRiskActionLabel('FLAG');
  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'year'),
    dayjs(),
  ]);
  const [granularity, setGranularity] = useState<GranularityValuesType>(
    granularityValues.MONTH as GranularityValuesType,
  );

  const calcGranularity = (type: string): GranularityValuesType => {
    if (type === 'YEAR') {
      return granularityValues.MONTH as GranularityValuesType;
    } else if (type === 'MONTH' || type === 'WEEK') {
      return granularityValues.DAY as GranularityValuesType;
    }
    return granularityValues.HOUR as GranularityValuesType;
  };
  const formatDate = (type: string): string => {
    if (type.match(/^\d{4}-\d{2}-\d{2}$/)) {
      type = dayjs(type, YEAR_MONTH_DATE_FORMAT).format('MM/DD');
    } else if (type.match(/^\d{4}-\d{2}$/)) {
      type = dayjs(type, 'YYYY-MM').format('YYYY/MM');
    } else if (type.match(/^\d{4}-\d{2}-\d{2}T\d{2}$/)) {
      type = dayjs(type, 'YYYY-MM-DDTHH').format('MM/DD HH:mm');
    }
    return type;
  };

  const dayCalc = (val: string) => {
    if (val === 'YEAR') {
      return dayjs().subtract(1, 'year');
    } else if (val === 'MONTH') {
      return dayjs().subtract(1, 'month');
    } else if (val === 'WEEK') {
      return dayjs().subtract(1, 'week');
    }
    return dayjs().subtract(1, 'day');
  };

  const [timeWindowType, setTimeWindowType] = useState<timeframe>('YEAR');
  const api = useApi();
  const [transactionsCountData, setTransactionsCountData] = useState<
    AsyncResource<DashboardStatsTransactionsCountData[]>
  >(init());
  useEffect(() => {
    let isCanceled = false;
    async function fetch() {
      setTransactionsCountData((state) => loading(getOr(state, null)));
      try {
        let startTimestamp = dayjs().subtract(1, 'year').valueOf();
        let endTimestamp = Date.now();

        const [start, end] = dateRange ?? [];
        if (start != null && end != null) {
          startTimestamp = start.startOf('day').valueOf();
          endTimestamp = end.endOf('day').valueOf();
        }
        const transactionsCountResult = await api.getDashboardStatsTransactions({
          startTimestamp,
          endTimestamp,
          granularity: granularity,
        });
        if (isCanceled) {
          return;
        }
        setTransactionsCountData(success(transactionsCountResult.data));
      } catch (e) {
        setTransactionsCountData(failed('Unknown error')); // todo: get actual error message
      }
    }

    fetch().catch((e) => {
      console.error(e);
    });

    return () => {
      isCanceled = true;
    };
  }, [api, dateRange, timeWindowType, granularity]);

  const data = getOr(transactionsCountData, []);
  const [activeTab, setActiveTab] = useLocalStorageState(
    'dashboard-analytics-active-tab',
    'totalTransactions',
  );
  const value: { _id: string; value: number; type: string }[] = [];
  data.map((item) => {
    value.push({
      _id: item._id,
      value: item.stoppedTransactions ?? 0,
      type: `${blockAlias}`,
    });
    value.push({
      _id: item._id,
      value: item.suspendedTransactions ?? 0,
      type: `${suspendAlias}`,
    });
    value.push({
      _id: item._id,
      value: item.flaggedTransactions ?? 0,
      type: `${flagAlias}`,
    });
    value.push({
      _id: item._id,
      value:
        (item.totalTransactions ?? 0) -
        (item.stoppedTransactions ?? 0) -
        (item.suspendedTransactions ?? 0) -
        (item.flaggedTransactions ?? 0),
      type: 'Allow',
    });
  });
  const annotations: Annotation[] | undefined = [];
  each(groupBy(value, '_id'), (values, k) => {
    const value = values.reduce((a, b) => a + b.value, 0);
    annotations.push({
      type: 'text',
      position: [k, value],
      content: escapeHtml(`${value}`),
      style: {
        textAlign: 'center',
        fontSize: 14,
        fill: 'rgba(0,0,0,0.85)',
      },
      offsetY: -10,
    });
  });

  return (
    <Card
      title={header('Transaction Breakdown by Rule Action')}
      extra={
        <div className={styles.salesExtraWrap}>
          <div className={styles.salesExtra}>
            {[
              { type: 'DAY' as const, title: 'Day' },
              { type: 'WEEK' as const, title: 'Week' },
              { type: 'MONTH' as const, title: 'Month' },
              { type: 'YEAR' as const, title: 'Year' },
            ].map(({ type, title }) => (
              <a
                key={type}
                className={type === timeWindowType ? styles.currentDate : ''}
                onClick={() => {
                  setTimeWindowType(type);
                  setDateRange([dayCalc(type), dayjs()]);
                  setGranularity(calcGranularity(type));
                }}
              >
                {title}
              </a>
            ))}
          </div>
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(e) => {
              setDateRange(e);
              setTimeWindowType(null);
            }}
          />
        </div>
      }
      bordered={false}
      bodyStyle={{ padding: 0 }}
      id="sales-card"
    >
      <div className={styles.salesCard}>
        <Tabs
          type="card"
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarStyle={{ marginBottom: 24 }}
        >
          {[
            { title: 'All', key: TOTAL_TRANSACTIONS_KEY },
            { title: `${flagAlias}`, key: FLAGGED_TRANSACTIONS_KEY },
            { title: `${suspendAlias}`, key: SUSPENDED_TRANSACTIONS_KEY },
            { title: `${blockAlias}`, key: STOPPED_TRANSACTIONS_KEY },
          ].map(({ title, key }) => (
            <TabPane tab={title} key={key}>
              <AsyncResourceRenderer resource={transactionsCountData}>
                {(data) => {
                  const preparedData =
                    key !== 'totalTransactions'
                      ? data.map((item) => {
                          const y = item[key] ?? 0;
                          const x = formatDate(item._id);
                          return {
                            x,
                            y,
                          };
                        })
                      : value.map((item) => {
                          const _id = formatDate(item._id);
                          const value = item.value;
                          const type = item.type;
                          return {
                            _id,
                            value,
                            // required because of XSS issue inside of chart library: https://www.notion.so/flagright/Pen-Test-Fix-Cross-site-scripting-stored-62fcbe075a42476aac5963fc18e845f5?pvs=4
                            type: escapeHtml(type),
                          };
                        });
                  return (
                    <div className={styles.salesBar}>
                      {data.length === 0 ? (
                        <Empty
                          className={styles.empty}
                          description="No data available for selected period"
                        />
                      ) : (
                        <Column
                          height={400}
                          isStack={true}
                          data={preparedData}
                          xField={key !== 'totalTransactions' ? 'x' : '_id'}
                          yField={key !== 'totalTransactions' ? 'y' : 'value'}
                          color={({ type }) => {
                            if (key === 'totalTransactions') {
                              if (type === `${escapeHtml(suspendAlias ?? '')}`)
                                return getRuleActionColorForDashboard('SUSPEND');
                              if (type === `${escapeHtml(flagAlias ?? '')}`)
                                return getRuleActionColorForDashboard('FLAG');
                              if (type === `${escapeHtml(blockAlias ?? '')}`)
                                return getRuleActionColorForDashboard('BLOCK');
                              return getRuleActionColorForDashboard('ALLOW');
                            } else if (key === FLAGGED_TRANSACTIONS_KEY)
                              return getRuleActionColorForDashboard('FLAG');
                            else if (key === STOPPED_TRANSACTIONS_KEY)
                              return getRuleActionColorForDashboard('FLAG');
                            return getRuleActionColorForDashboard('SUSPEND');
                          }}
                          xAxis={{
                            label: {
                              autoRotate: false,
                              autoHide: true,
                              rotate: -Math.PI / 6,
                              offsetX: -10,
                              offsetY: 10,
                              style: {
                                textAlign: 'right',
                                textBaseline: 'bottom',
                              },
                            },
                            title: null,
                          }}
                          yAxis={{
                            title: null,
                            label: {
                              formatter: (value) => {
                                return value.toLocaleString();
                              },
                            },
                          }}
                          meta={{
                            y: {
                              alias: 'Transaction Count',
                            },
                          }}
                          seriesField={key !== 'totalTransactions' ? '' : 'type'}
                          annotations={annotations}
                          legend={{
                            layout: 'horizontal',
                            position: 'top-right',
                            reversed: true,
                          }}
                        />
                      )}
                    </div>
                  );
                }}
              </AsyncResourceRenderer>
            </TabPane>
          ))}
        </Tabs>
      </div>
    </Card>
  );
};

export default TransactionsChartCard;
