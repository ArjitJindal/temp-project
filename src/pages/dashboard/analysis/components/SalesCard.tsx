/* eslint-disable @typescript-eslint/no-var-requires */
import { Button, Card, Col, DatePicker, Dropdown, Menu, Row, Tabs } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker/generatePicker';
import type moment from 'moment';
import { EllipsisOutlined } from '@ant-design/icons';
import { Column } from '@ant-design/charts';
import type { MenuInfo } from 'rc-menu/lib/interface';

import numeral from 'numeral';
import { useCallback } from 'react';
import type { DataItem } from '../data.d';
import styles from '../style.less';

// FIXME: import doesn't work
const toPng = require('html-to-image').toPng;
const autoTable = require('jspdf-autotable').default;
const jsPDF = require('jspdf');

type RangePickerValue = RangePickerProps<moment.Moment>['value'];
export type TimeType = 'today' | 'week' | 'month' | 'year';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const rankingListData: { title: string; total: number }[] = [
  {
    title: `Proof of funds`,
    total: 323,
  },
  {
    title: `High Risk Country`,
    total: 216,
  },
  {
    title: `TC40 Hit`,
    total: 33,
  },
  {
    title: `UN Sactions Hit`,
    total: 32,
  },
  {
    title: `PEP Hit`,
    total: 31,
  },
  {
    title: `High Frequency User`,
    total: 12,
  },
  {
    title: `Account inactive for more than 12 months`,
    total: 3,
  },
];

function saveToFile(blob: Blob, filename: string) {
  const a = document.createElement('a');
  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

function getDateRange(rangePickerValue: RangePickerValue) {
  if (!rangePickerValue) {
    return null;
  }
  const fromDate = rangePickerValue[0] as moment.Moment;
  const toDate = rangePickerValue[1] as moment.Moment;
  return `${fromDate.format('YYYYMMDD')}-${toDate.format('YYYYMMDD')}`;
}

function exportToCsv(header: string[], exportData: any[], rangePickerValue: RangePickerValue) {
  const data = [[header, ...exportData].map((row) => row.join(',')).join('\n')];
  saveToFile(
    new Blob(data, { type: 'octet/stream' }),
    `flagright-stopped-transactions-${getDateRange(rangePickerValue)}.csv`,
  );
}

async function exportToPdf(header: any[], exportData: any[], rangePickerValue: RangePickerValue) {
  const doc = new jsPDF.jsPDF();
  const chart = document.getElementById('sales-card')!;
  const ratio = chart.clientHeight / chart.clientWidth;
  const chartImage = await toPng(chart);
  const chartImageX = 10;
  const chartImageY = 10;
  const chartWidth = doc.internal.pageSize.getWidth() - 2 * chartImageX;
  const chartHeight = chartWidth * ratio;
  doc.addImage(chartImage, 'PNG', chartImageX, chartImageY, chartWidth, chartHeight);
  autoTable(doc, {
    startY: chartImageY + chartHeight + 10,
    headStyles: { fillColor: '#6294FA' },
    styles: { cellPadding: 1 },
    head: [header],
    body: exportData,
  });

  doc.save(`flagright-stopped-transactions-${getDateRange(rangePickerValue)}.pdf`);
}

const SalesCard = ({
  rangePickerValue,
  salesData,
  isActive,
  handleRangePickerChange,
  loading,
  selectDate,
}: {
  rangePickerValue: RangePickerValue;
  isActive: (key: TimeType) => string;
  salesData: DataItem[];
  loading: boolean;
  handleRangePickerChange: (dates: RangePickerValue, dateStrings: [string, string]) => void;
  selectDate: (key: TimeType) => void;
}) => {
  const onActionsMenuClick = useCallback(
    (event: MenuInfo) => {
      const { key } = event;
      const exportData = salesData.flatMap((data1) => {
        return rankingListData.map((data2, index) => [
          index === 0 ? data1.xValue : '',
          data2.title,
          Math.floor(Math.random() * 1000),
        ]);
      });
      if (key === 'csv') {
        exportToCsv(['Month', 'Rule', 'Hits'], exportData, rangePickerValue);
      } else if (key === 'pdf') {
        exportToPdf(['Month', 'Rule', 'Hits'], exportData, rangePickerValue);
      }
    },
    [rangePickerValue, salesData],
  );
  return (
    <Card loading={loading} bordered={false} bodyStyle={{ padding: 0 }} id="sales-card">
      <div className={styles.salesCard}>
        <Tabs
          tabBarExtraContent={
            <div className={styles.salesExtraWrap}>
              <div className={styles.salesExtra}>
                <a className={isActive('today')} onClick={() => selectDate('today')}>
                  Day
                </a>
                <a className={isActive('week')} onClick={() => selectDate('week')}>
                  Week
                </a>
                <a className={isActive('month')} onClick={() => selectDate('month')}>
                  Month
                </a>
                <a className={isActive('year')} onClick={() => selectDate('year')}>
                  Year
                </a>
              </div>
              <RangePicker
                value={rangePickerValue}
                onChange={handleRangePickerChange}
                style={{ width: 256 }}
              />
              <Dropdown
                overlay={
                  <Menu onClick={onActionsMenuClick}>
                    <Menu.Item key="csv">Export to CSV</Menu.Item>
                    <Menu.Item key="pdf">Export to PDF</Menu.Item>
                  </Menu>
                }
                trigger={['hover']}
              >
                <Button icon={<EllipsisOutlined />} />
              </Dropdown>
            </div>
          }
          size="large"
          tabBarStyle={{ marginBottom: 24 }}
        >
          <TabPane tab="Stopped Transactions" key="stoppedTransactions">
            <Row>
              <Col xl={16} lg={12} md={12} sm={24} xs={24}>
                <div className={styles.salesBar}>
                  <Column
                    height={300}
                    forceFit
                    data={salesData as any}
                    xField="x"
                    yField="y"
                    xAxis={{
                      visible: true,
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
                </div>
              </Col>
              <Col xl={8} lg={12} md={12} sm={24} xs={24}>
                <div className={styles.salesRank}>
                  <h4 className={styles.rankingTitle}>Top Rules Hit</h4>
                  <ul className={styles.rankingList}>
                    {rankingListData.map((item, i) => (
                      <li key={item.title}>
                        <span
                          className={`${styles.rankingItemNumber} ${i < 3 ? styles.active : ''}`}
                        >
                          {i + 1}
                        </span>
                        <span className={styles.rankingItemTitle} title={item.title}>
                          {item.title}
                        </span>
                        <span className={styles.rankingItemValue}>
                          {numeral(item.total).format('0,0')}{' '}
                        </span>
                        Hits
                      </li>
                    ))}
                  </ul>
                </div>
              </Col>
            </Row>
          </TabPane>
          <TabPane tab="Flagged Transactions" key="flagged">
            <Row>
              <Col xl={16} lg={12} md={12} sm={24} xs={24}>
                <div className={styles.salesBar}>
                  <Column
                    height={300}
                    forceFit
                    data={salesData as any}
                    xField="x"
                    yField="y"
                    xAxis={{
                      visible: true,
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
                        alias: '访问量',
                      },
                    }}
                  />
                </div>
              </Col>
              <Col xl={8} lg={12} md={12} sm={24} xs={24}>
                <div className={styles.salesRank}>
                  <h4 className={styles.rankingTitle}>Top Rules Hit</h4>
                  <ul className={styles.rankingList}>
                    {rankingListData.map((item, i) => (
                      <li key={item.title}>
                        <span
                          className={`${styles.rankingItemNumber} ${i < 3 ? styles.active : ''}`}
                        >
                          {i + 1}
                        </span>
                        <span className={styles.rankingItemTitle} title={item.title}>
                          {item.title}
                        </span>
                        <span className={styles.rankingItemValue}>
                          {numeral(item.total).format('0,0')}
                        </span>{' '}
                        Hits
                      </li>
                    ))}
                  </ul>
                </div>
              </Col>
            </Row>
          </TabPane>
        </Tabs>
      </div>
    </Card>
  );
};

export default SalesCard;
