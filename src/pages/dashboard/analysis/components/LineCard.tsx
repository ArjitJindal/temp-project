import { Card, DatePicker, Tabs } from 'antd';
import { Suspense } from 'react';
import type { RangePickerProps } from 'antd/es/date-picker/generatePicker';
import type moment from 'moment';
import type { DataItem } from '../data';
import styles from '../style.less';
import Line from './Charts/Line';
type RangePickerValue = RangePickerProps<moment.Moment>['value'];
export type TimeType = 'today' | 'week' | 'month' | 'year';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const SalesCard = ({
  rangePickerValue,
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
}) => (
  <Card loading={loading} bordered={false} bodyStyle={{ padding: 0 }}>
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
          </div>
        }
        size="large"
      >
        <TabPane tab="Rules Hit" key="RulesHit">
          <Suspense fallback={null}>
            <Card>
              <div>
                <Line />
              </div>
            </Card>
          </Suspense>
        </TabPane>
      </Tabs>
    </div>
  </Card>
);

export default SalesCard;
