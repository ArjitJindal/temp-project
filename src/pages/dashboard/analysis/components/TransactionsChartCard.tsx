/* eslint-disable @typescript-eslint/no-var-requires */
import { Card, DatePicker, Empty, Spin, Tabs } from 'antd';
import moment, { Moment } from 'moment';
import { Column } from '@ant-design/plots';
import { useEffect, useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { useLocalStorageState } from 'ahooks';
import { each, groupBy } from 'lodash';
import { Annotation } from '@antv/g2plot';
import {
  browserName,
  deviceType,
  browserVersion,
  osName,
  mobileModel,
  mobileVendor,
} from 'react-device-detect';
import styles from '../style.module.less';
import { momentCalc } from '../utils/utils';
import { getRuleActionTitle } from '../../../../utils/rules';
import header from './dashboardutils';
import { useAuth0User } from '@/utils/user-utils';
import { useAnalytics } from '@/utils/segment/context';
import { useApi } from '@/api';
import {
  AsyncResource,
  failed,
  getOr,
  init,
  isLoading,
  loading,
  success,
} from '@/utils/asyncResource';
import { DashboardStatsTransactionsCountData } from '@/apis';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

type StatsKey = keyof DashboardStatsTransactionsCountData;
const TOTAL_TRANSACTIONS_KEY: StatsKey = 'totalTransactions';
const FLAGGED_TRANSACTIONS_KEY: StatsKey = 'flaggedTransactions';
const STOPPED_TRANSACTIONS_KEY: StatsKey = 'stoppedTransactions';
const SUSPENDED_TRANSACTIONS_KEY: StatsKey = 'suspendedTransactions';

export type timeframe = 'YEAR' | 'MONTH' | 'WEEK' | 'DAY' | null;
const { TabPane } = Tabs;

const TransactionsChartCard = () => {
  const settings = useSettings();
  const analytics = useAnalytics();
  const user = useAuth0User();
  type GranularityValuesType = 'HOUR' | 'MONTH' | 'DAY';
  const granularityValues = { HOUR: 'HOUR', MONTH: 'MONTH', DAY: 'DAY' };

  const suspendAlias = getRuleActionTitle(
    settings.ruleActionAliases?.find((item) => item.action === 'SUSPEND')?.alias || 'SUSPEND',
  );
  const blockAlias = getRuleActionTitle(
    settings.ruleActionAliases?.find((item) => item.action === 'BLOCK')?.alias || 'BLOCK',
  );
  const flagAlias = getRuleActionTitle(
    settings.ruleActionAliases?.find((item) => item.action === 'FLAG')?.alias || 'FLAG',
  );
  const [dateRange, setDateRange] = useState<RangeValue<Moment>>([
    moment().subtract(1, 'year'),
    moment(),
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
      type = moment(type, 'YYYY-MM-DD').format('MM/DD');
    } else if (type.match(/^\d{4}-\d{2}$/)) {
      type = moment(type, 'YYYY-MM').format('YYYY/MM');
    } else if (type.match(/^\d{4}-\d{2}-\d{2}T\d{2}$/)) {
      type = moment(type, 'YYYY-MM-DDTHH').format('MM/DD HH:mm');
    }
    return type;
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
        let startTimestamp = moment().subtract(1, 'year').valueOf();
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
      content: `${value}`,
      style: {
        textAlign: 'center',
        fontSize: 14,
        fill: 'rgba(0,0,0,0.85)',
      },
      offsetY: -10,
    });
  });

  const titleName = (activeTab: string) => {
    if (activeTab === 'totalTransactions') return 'Clicked on Total Transactions';
    if (activeTab === 'suspendTransactions') return 'Clicked on Suspended Transactions';
    if (activeTab === 'stopTransactions') return 'Clicked on Stopped Transactions';
    return 'Clicked on Flagged Transactions';
  };

  useEffect(() => {
    analytics.event({
      title: titleName(activeTab),
      tenant: user.tenantName,
      userId: user.userId,
      browserName,
      deviceType,
      browserVersion,
      osName,
      mobileModel,
      mobileVendor,
    });
  }, [activeTab, analytics, user.tenantName, user.userId]);

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
                  setDateRange([momentCalc(type), moment()]);
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
              <Spin spinning={isLoading(transactionsCountData)}>
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
                      data={
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
                                type,
                              };
                            })
                      }
                      xField={key !== 'totalTransactions' ? 'x' : '_id'}
                      yField={key !== 'totalTransactions' ? 'y' : 'value'}
                      color={({ type }) => {
                        if (key === 'totalTransactions') {
                          if (type === `${suspendAlias}`) return '#F5E25A';
                          if (type === `${flagAlias}`) return '#F6A429';
                          if (type === `${blockAlias}`) return '#FF4D4F';
                          return '#1169F9';
                        } else if (key === FLAGGED_TRANSACTIONS_KEY) return '#F6A429';
                        else if (key === STOPPED_TRANSACTIONS_KEY) return '#FF4D4F';
                        return '#F5E25A';
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
              </Spin>
            </TabPane>
          ))}
        </Tabs>
      </div>
    </Card>
  );
};

export default TransactionsChartCard;
