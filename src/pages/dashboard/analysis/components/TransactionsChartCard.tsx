/* eslint-disable @typescript-eslint/no-var-requires */
import { Card, DatePicker, Empty, Spin, Tabs } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker/generatePicker';
import moment from 'moment';
import { Column } from '@ant-design/charts';
import { useEffect, useState } from 'react';
import styles from '../style.module.less';
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
export type TimeWindowType = DefaultApiGetDashboardStatsTransactionsRequest['timeframe'];

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
  const [endDate, setEndDate] = useState<moment.Moment | null>(null);
  const [timeWindowType, setTimeWindowType] = useState<TimeWindowType>('YEAR');

  const onChangeEndDate = setEndDate;
  const onSelectTimeWindow = setTimeWindowType;

  const api = useApi();
  const [transactionsCountData, setTransactionsCountData] = useState<
    AsyncResource<DashboardStatsTransactionsCountData[]>
  >(init());
  useEffect(() => {
    let isCanceled = false;
    async function fetch() {
      setTransactionsCountData((state) => loading(getOr(state, null)));
      try {
        const transactionsCountResult = await api.getDashboardStatsTransactions({
          timeframe: timeWindowType,
          endTimestamp: endDate ? endDate.valueOf() : Date.now(),
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
  }, [endDate, timeWindowType, api]);

  const dataResource: AsyncResource<TransactionsStats> = map(transactionsCountData, (value) =>
    value.map((item, i) => ({
      id: item._id,
      totalTransactions: item.totalTransactions ?? 0,
      flaggedTransactions: item.flaggedTransactions ?? 0,
      stoppedTransactions: item.stoppedTransactions ?? 0,
    })),
  );

  const data = getOr(dataResource, []);

  return (
    <Card bordered={false} bodyStyle={{ padding: 0 }} id="sales-card">
      <div className={styles.salesCard}>
        <Tabs
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
                    onClick={() => onSelectTimeWindow(type)}
                  >
                    {title}
                  </a>
                ))}
              </div>
              <DatePicker
                placeholder="Select the period end date"
                value={endDate}
                onChange={onChangeEndDate}
                style={{ width: 256 }}
              />
              {/*<Dropdown*/}
              {/*  overlay={*/}
              {/*    <Menu onClick={() => {}}>*/}
              {/*      <Menu.Item key="csv">Export to CSV</Menu.Item>*/}
              {/*      <Menu.Item key="pdf">Export to PDF</Menu.Item>*/}
              {/*    </Menu>*/}
              {/*  }*/}
              {/*  trigger={['hover']}*/}
              {/*>*/}
              {/*  <Button icon={<EllipsisOutlined />} />*/}
              {/*</Dropdown>*/}
            </div>
          }
          tabBarStyle={{ marginBottom: 24 }}
        >
          {[
            { title: 'Total Transactions', key: 'totalTransactions' },
            { title: 'Blocked Transactions', key: 'stoppedTransactions' },
            { title: 'Flagged Transactions', key: 'flaggedTransactions' },
          ].map(({ title, key }) => (
            <TabPane tab={title} key={key}>
              <Spin spinning={isLoading(dataResource)}>
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
                        const y = item[key];
                        let x = item.id;
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
                          autoHide: false,
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
