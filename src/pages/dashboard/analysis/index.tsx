import type { FC } from 'react';
import { Suspense, useState } from 'react';
import { EllipsisOutlined } from '@ant-design/icons';
import { Card, Col, Dropdown, Menu, Row } from 'antd';
import { GridContent } from '@ant-design/pro-layout';
import type { RangePickerProps } from 'antd/es/date-picker/generatePicker';
import type moment from 'moment';
import { useRequest } from 'umi';
import IntroduceRow from './components/IntroduceRow';
import SalesCard from './components/SalesCard';
import LineCard from './components/LineCard';
import ProportionSales from './components/ProportionSales';
import Map from './components/Map';

import { fakeChartData } from './service';
import PageLoading from './components/PageLoading';
import type { TimeType } from './components/SalesCard';
import { getTimeDistance } from './utils/utils';
import type { AnalysisData } from './data.d';
import styles from './style.less';

type RangePickerValue = RangePickerProps<moment.Moment>['value'];
//Range Picker value for Rules hit
type RangePickerValueLineChartValue = RangePickerProps<moment.Moment>['value'];

type AnalysisProps = {
  dashboardAndanalysis: AnalysisData;
  loading: boolean;
};

const Analysis: FC<AnalysisProps> = () => {
  const [rangePickerValue, setRangePickerValue] = useState<RangePickerValue>(
    getTimeDistance('year'),
  );
  // Rules hit rangepicker
  const [rangePickerValueLineChartValue, setRangePickerValueLineChartValue] =
    useState<RangePickerValueLineChartValue>(getTimeDistance('year'));

  const { loading, data } = useRequest(fakeChartData);

  const selectDate = (type: TimeType) => {
    setRangePickerValue(getTimeDistance(type));
  };
  // Rules hit
  const selectDateLineChartValue = (type: TimeType) => {
    setRangePickerValueLineChartValue(getTimeDistance(type));
  };

  const handleRangePickerChange = (value: RangePickerValue) => {
    setRangePickerValue(value);
  };
  // Rules hit
  const handleRangePickerChangeLineChartValue = (value: RangePickerValueLineChartValue) => {
    setRangePickerValueLineChartValue(value);
  };

  const isActive = (type: TimeType) => {
    if (!rangePickerValue) {
      return '';
    }
    const value = getTimeDistance(type);
    if (!value) {
      return '';
    }
    if (!rangePickerValue[0] || !rangePickerValue[1]) {
      return '';
    }
    if (
      rangePickerValue[0].isSame(value[0] as moment.Moment, 'day') &&
      rangePickerValue[1].isSame(value[1] as moment.Moment, 'day')
    ) {
      return styles.currentDate;
    }
    return '';
  };
  // Rules hit
  const isActiveLineChartValue = (type: TimeType) => {
    if (!rangePickerValueLineChartValue) {
      return '';
    }
    const value = getTimeDistance(type);
    if (!value) {
      return '';
    }
    if (!rangePickerValueLineChartValue[0] || !rangePickerValueLineChartValue[1]) {
      return '';
    }
    if (
      rangePickerValueLineChartValue[0].isSame(value[0] as moment.Moment, 'day') &&
      rangePickerValueLineChartValue[1].isSame(value[1] as moment.Moment, 'day')
    ) {
      return styles.currentDate;
    }
    return '';
  };

  const salesPieData = data?.salesTypeData;

  const menu = (
    <Menu>
      <Menu.Item>Item 1</Menu.Item>
      <Menu.Item>Item 2</Menu.Item>
    </Menu>
  );

  const dropdownGroup = (
    <span className={styles.iconGroup}>
      <Dropdown overlay={menu} placement="bottomRight">
        <EllipsisOutlined />
      </Dropdown>
    </span>
  );

  return (
    <GridContent>
      <>
        <Suspense fallback={<PageLoading />}>
          <IntroduceRow loading={loading} visitData={data?.visitData || []} />
        </Suspense>

        <Suspense fallback={null}>
          <SalesCard
            rangePickerValue={rangePickerValue}
            salesData={data?.salesData || []}
            isActive={isActive}
            handleRangePickerChange={handleRangePickerChange}
            loading={loading}
            selectDate={selectDate}
          />
        </Suspense>

        <Row
          gutter={24}
          style={{
            marginTop: 24,
          }}
        >
          <Col xl={12} lg={24} md={24} sm={24} xs={24}>
            <Suspense fallback={null}>
              <LineCard //Line Card component
                rangePickerValue={rangePickerValueLineChartValue}
                salesData={data?.salesData || []}
                isActive={isActiveLineChartValue}
                handleRangePickerChange={handleRangePickerChangeLineChartValue}
                loading={loading}
                selectDate={selectDateLineChartValue}
              />
            </Suspense>
          </Col>
          <Col xl={12} lg={24} md={24} sm={24} xs={24}>
            <Suspense fallback={null}>
              <ProportionSales
                dropdownGroup={dropdownGroup}
                loading={loading}
                salesPieData={salesPieData || []}
              />
            </Suspense>
          </Col>
        </Row>
        <Suspense fallback={null}>
          <Card
            title="Location overview"
            bordered={false}
            style={{
              marginTop: 24,
            }}
          >
            <div className={styles.mapChart}>
              <Map />
            </div>
          </Card>
        </Suspense>
      </>
    </GridContent>
  );
};

export default Analysis;
