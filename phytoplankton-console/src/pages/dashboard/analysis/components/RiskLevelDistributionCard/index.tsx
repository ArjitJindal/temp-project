/* eslint-disable @typescript-eslint/no-var-requires */
import React, { MutableRefObject, useRef, useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { useLocalStorageState } from 'ahooks';
import Column, { ColumnData } from '../charts/Column';
import { exportDataForBarGraphs } from '../../utils/export-data-build-util';
import s from './styles.module.less';
import RiskTypeSelector, { RiskTypeSelectorValue } from './RiskTypeSelector';
import { useApi } from '@/api';
import { RISK_LEVELS } from '@/utils/risk-levels';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_STATS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import NoData from '@/pages/case-management-item/CaseDetails/InsightsCard/components/NoData';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { map } from '@/utils/asyncResource';
import { RiskLevel } from '@/apis';
import {
  COLORS_V2_PRIMARY_SHADES_BLUE_100,
  COLORS_V2_PRIMARY_SHADES_BLUE_300,
  COLORS_V2_PRIMARY_SHADES_BLUE_50,
  COLORS_V2_PRIMARY_SHADES_BLUE_600,
  COLORS_V2_PRIMARY_TINTS_BLUE_900,
} from '@/components/ui/colors';
import { Dayjs, dayjs } from '@/utils/dayjs';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import DatePicker from '@/components/ui/DatePicker';
import ContainerRectMeasure from '@/components/utils/ContainerRectMeasure';

const DEFAULT_DATE_RANGE: [Dayjs, Dayjs] = [dayjs().subtract(1, 'year'), dayjs()];

const RISK_LEVEL_COLORS = {
  VERY_LOW: COLORS_V2_PRIMARY_SHADES_BLUE_50,
  LOW: COLORS_V2_PRIMARY_SHADES_BLUE_100,
  MEDIUM: COLORS_V2_PRIMARY_SHADES_BLUE_300,
  HIGH: COLORS_V2_PRIMARY_SHADES_BLUE_600,
  VERY_HIGH: COLORS_V2_PRIMARY_TINTS_BLUE_900,
};

interface Props extends WidgetProps {
  userType?: 'BUSINESS' | 'CONSUMER';
}

export default function RiskLevelDistributionCard(props: Props) {
  const { userType = 'CONSUMER', ...restProps } = props;
  const api = useApi();
  const settings = useSettings();
  const [selectedRiskType, setSelectedRiskType] = useLocalStorageState<RiskTypeSelectorValue>(
    `dashboard-${userType}-risk-type-active-tab`,
    'CRA',
  );

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'year'),
    dayjs(),
  ]);

  let startTimestamp = dayjs().subtract(1, 'year').valueOf();
  let endTimestamp = Date.now();
  const [start, end] = dateRange ?? [];
  if (start != null && end != null) {
    startTimestamp = start.startOf('day').valueOf();
    endTimestamp = end.endOf('day').valueOf();
  }

  const params = {
    userType: userType,
    startTimestamp,
    endTimestamp,
  };
  const queryResult = useQuery(USERS_STATS(params), async () => {
    const response = await api.getDashboardStatsUsersByTime(params);
    return response;
  });

  const preparedDataRes = map(
    queryResult.data,
    (data): ColumnData<RiskLevel, number, RiskLevel> => {
      return RISK_LEVELS.map((riskLevel) => {
        const count = data.reduce(
          (acc, x) =>
            acc +
              x[
                selectedRiskType === 'KRS'
                  ? `krsRiskLevel_${riskLevel}`
                  : `drsRiskLevel_${riskLevel}`
              ] ?? 0,
          0,
        );
        return {
          xValue: riskLevel,
          yValue: count,
          series: riskLevel,
        };
      });
    },
  );
  const pdfRef = useRef() as MutableRefObject<HTMLInputElement>;

  return (
    <AsyncResourceRenderer resource={preparedDataRes}>
      {(data) => {
        if (data.length === 0) {
          return <NoData />;
        }
        return (
          <div ref={pdfRef}>
            <Widget
              resizing="FIXED"
              {...restProps}
              extraControls={[
                <DatePicker.RangePicker
                  value={dateRange}
                  onChange={(e) => {
                    setDateRange(e ?? DEFAULT_DATE_RANGE);
                  }}
                />,
              ]}
              onDownload={(): Promise<{
                fileName: string;
                data: string;
                pdfRef: MutableRefObject<HTMLInputElement>;
              }> => {
                return new Promise((resolve, _reject) => {
                  const fileData = {
                    fileName: `distribution-by-${selectedRiskType}-${dayjs().format('YYYY_MM_DD')}`,
                    data: exportDataForBarGraphs(data, `${selectedRiskType} Risk level`),
                    pdfRef,
                  };
                  resolve(fileData);
                });
              }}
            >
              <div className={s.root}>
                <RiskTypeSelector
                  selectedSection={selectedRiskType}
                  setSelectedSection={setSelectedRiskType}
                />
                <div className={s.chartContainer}>
                  <ContainerRectMeasure className={s.chartContainer2}>
                    {(size) => (
                      <Column<RiskLevel, RiskLevel>
                        data={data}
                        colors={RISK_LEVEL_COLORS}
                        rotateLabel={false}
                        hideLegend={true}
                        height={size.height}
                        formatSeries={(series) => {
                          return getRiskLevelLabel(series, settings);
                        }}
                        formatX={(series) => {
                          return getRiskLevelLabel(series, settings);
                        }}
                      />
                    )}
                  </ContainerRectMeasure>
                </div>
              </div>
            </Widget>
          </div>
        );
      }}
    </AsyncResourceRenderer>
  );
}
