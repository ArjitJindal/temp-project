/* eslint-disable @typescript-eslint/no-var-requires */
import { Card, DatePicker, Empty, Spin, Tabs } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker/generatePicker';
import moment, { Moment } from 'moment';
import { Column } from '@ant-design/charts';
import { useEffect, useState } from 'react';
import { RangeValue } from 'rc-picker/lib/interface';
import { useLocalStorageState } from 'ahooks';
import styles from '../style.module.less';
import { momentCalc } from '../utils/utils';
import { DefaultApiGetDashboardStatsTransactionsRequest } from '@/apis/types/ObjectParamAPI';
import { useApi } from '@/api';
import {
  AsyncResource,
  failed,
  getOr,
  init,
  isLoading,
  loading,
  map,
  success,
} from '@/utils/asyncResource';
import { DashboardStatsTransactionsCountData } from '@/apis';

// FIXME: import doesn't work
// const toPng = require('html-to-image').toPng;
// const autoTable = require('jspdf-autotable').default;
// const jsPDF = require('jspdf');

type RangePickerValue = RangePickerProps<moment.Moment>['value'];
export type timeframe = 'YEAR' | 'MONTH' | 'WEEK' | 'DAY' | null;
const { TabPane } = Tabs;

export type TransactionsStats = {
  id: string;
  totalTransactions: number;
  flaggedTransactions: number;
  stoppedTransactions: number;
}[];

// function saveToFile(blob: Blob, filename: string) {
//   const a = document.createElement('a');
//   const url = window.URL.createObjectURL(blob);
//   a.href = url;
//   a.download = filename;
//   a.click();
//   window.URL.revokeObjectURL(url);
// }

// function getDateRange(rangePickerValue: RangePickerValue) {
//   if (!rangePickerValue) {
//     return null;
//   }
//   const fromDate = rangePickerValue[0] as moment.Moment;
//   const toDate = rangePickerValue[1] as moment.Moment;
//   return `${fromDate.format('YYYYMMDD')}-${toDate.format('YYYYMMDD')}`;
// }

// function exportToCsv(header: string[], exportData: any[], rangePickerValue: RangePickerValue) {
//   const data = [[header, ...exportData].map((row) => row.join(',')).join('\n')];
//   saveToFile(
//     new Blob(data, { type: 'octet/stream' }),
//     `flagright-stopped-transactions-${getDateRange(rangePickerValue)}.csv`,
//   );
// }

// async function exportToPdf(header: any[], exportData: any[], rangePickerValue: RangePickerValue) {
//   const doc = new jsPDF.jsPDF();
//   const chart = document.getElementById('sales-card')!;
//   const ratio = chart.clientHeight / chart.clientWidth;
//   const chartImage = await toPng(chart);
//   const chartImageX = 10;
//   const chartImageY = 10;
//   const chartWidth = doc.internal.pageSize.getWidth() - 2 * chartImageX;
//   const chartHeight = chartWidth * ratio;
//   doc.addImage(chartImage, 'PNG', chartImageX, chartImageY, chartWidth, chartHeight);
//   autoTable(doc, {
//     startY: chartImageY + chartHeight + 10,
//     headStyles: { fillColor: '#6294FA' },
//     styles: { cellPadding: 1 },
//     head: [header],
//     body: exportData,
//   });
//
//   doc.save(`flagright-stopped-transactions-${getDateRange(rangePickerValue)}.pdf`);
// }

const TransactionsChartCard = () => {
  const [dateRange, setDateRange] = useState<RangeValue<Moment>>([
    moment().subtract(1, 'year'),
    moment(),
  ]);

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
  }, [api, dateRange, timeWindowType]);

  const data = getOr(transactionsCountData, []);
  const [activeTab, setActiveTab] = useLocalStorageState(
    'dashboard-analytics-active-tab',
    'totalTransactions',
  );

  return (
    <Card bordered={false} bodyStyle={{ padding: 0 }} id="sales-card">
      <div className={styles.salesCard}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarExtraContent={
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
          tabBarStyle={{ marginBottom: 24 }}
        >
          {[
            { title: 'Total Transactions', key: 'totalTransactions' },
            { title: 'Suspended Transactions', key: 'suspendedTransactions' },
            { title: 'Blocked Transactions', key: 'stoppedTransactions' },
            { title: 'Flagged Transactions', key: 'flaggedTransactions' },
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
                      forceFit
                      data={data.map((item) => {
                        const y = item[key] ?? 0;
                        let x = item._id;
                        if (x.match(/^\d{4}-\d{2}-\d{2}$/)) {
                          x = moment(x, 'YYYY-MM-DD').format('MM/DD');
                        } else if (x.match(/^\d{4}-\d{2}$/)) {
                          x = moment(x, 'YYYY-MM').format('YYYY/MM');
                        } else if (x.match(/^\d{4}-\d{2}-\d{2}T\d{2}$/)) {
                          x = moment(x, 'YYYY-MM-DDTHH').format('MM/DD HH:mm');
                        }
                        return {
                          x,
                          y,
                        };
                      })}
                      xField="x"
                      yField="y"
                      xAxis={{
                        visible: true,
                        label: {
                          autoRotate: false,
                          autoHide: true,
                          rotate: -Math.PI / 6,
                          style: {
                            textAlign: 'right',
                            textBaseline: 'bottom',
                          },
                        },
                        title: {
                          visible: false,
                        },
                      }}
                      yAxis={{
                        visible: true,
                        title: {
                          visible: false,
                        },
                      }}
                      meta={{
                        y: {
                          alias: 'Transaction Count',
                        },
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
