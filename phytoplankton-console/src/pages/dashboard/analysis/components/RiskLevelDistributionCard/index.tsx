/* eslint-disable @typescript-eslint/no-var-requires */
import { useMemo, useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import DistributionChartWidget from '../widgets/DistributionChartWidget';
import {
  GranularityValuesType,
  granularityValues,
} from '../widgets/GranularDatePicker/GranularDatePicker';
import {
  COLORS_V2_PRIMARY_SHADES_BLUE_50,
  COLORS_V2_PRIMARY_SHADES_BLUE_100,
  COLORS_V2_PRIMARY_SHADES_BLUE_300,
  COLORS_V2_PRIMARY_SHADES_BLUE_600,
  COLORS_V2_PRIMARY_TINTS_BLUE_900,
} from '@/components/ui/colors';
import { WidgetProps } from '@/components/library/Widget/types';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_STATS } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { DashboardStatsUsersStats, RiskLevel } from '@/apis';
import { Dayjs, dayjs } from '@/utils/dayjs';
import { RISK_LEVELS } from '@/utils/risk-levels';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import type { GroupBy } from '@/components/charts/BarChart/types';
const RISK_LEVEL_COLORS = {
  VERY_LOW: COLORS_V2_PRIMARY_SHADES_BLUE_50,
  LOW: COLORS_V2_PRIMARY_SHADES_BLUE_100,
  MEDIUM: COLORS_V2_PRIMARY_SHADES_BLUE_300,
  HIGH: COLORS_V2_PRIMARY_SHADES_BLUE_600,
  VERY_HIGH: COLORS_V2_PRIMARY_TINTS_BLUE_900,
};

interface Props extends WidgetProps {
  userType?: 'BUSINESS' | 'CONSUMER';
  showGranularity?: boolean;
}

export function RiskLevelDistributionCard(props: Props) {
  return <RiskLevelDistributionCardBase {...props} groupBy="VALUE" />;
}

export function RiskLevelBreakdownCard(props: Props) {
  return <RiskLevelDistributionCardBase {...props} groupBy="TIME" showGranularity />;
}

function RiskLevelDistributionCardBase(props: Props & { groupBy: GroupBy }) {
  const { userType = 'CONSUMER', groupBy, showGranularity = false, ...restProps } = props;
  const [timeRange, setTimeRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'year'),
    dayjs(),
  ]);
  const [granularity, setGranularity] = useState<GranularityValuesType>(
    granularityValues.MONTH as GranularityValuesType,
  );
  const [start, end] = timeRange ?? [];
  const startTimestamp = start?.startOf('day').valueOf();
  const endTimestamp = end?.endOf('day').valueOf();
  const params = {
    userType: userType,
    startTimestamp,
    endTimestamp,
    granularity: granularity,
  };
  const settings = useSettings();
  const api = useApi();
  const queryResult = useQuery(USERS_STATS(params), async () => {
    return await api.getDashboardStatsUsersByTime(params);
  });
  const valueNames = useMemo(
    () =>
      Object.fromEntries(
        RISK_LEVELS.map((riskLevel) => [
          riskLevel,
          getRiskLevelLabel(riskLevel, settings).riskLevelLabel,
        ]),
      ),
    [settings],
  ) as { [key in RiskLevel]: string };

  return (
    <DistributionChartWidget<DashboardStatsUsersStats, RiskLevel>
      groups={[
        {
          name: 'CRA',
          attributeName: 'CRA',
          attributeDataPrefix: 'drsRiskLevel',
          seriesLabel: 'Risk Level',
        },
        {
          name: 'KRS',
          attributeName: 'KRS',
          attributeDataPrefix: 'krsRiskLevel',
          seriesLabel: 'Risk Level',
        },
      ]}
      groupBy={groupBy}
      valueColors={RISK_LEVEL_COLORS}
      values={RISK_LEVELS}
      queryResult={queryResult}
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
      valueNames={valueNames}
      setGranularity={setGranularity}
      showGranularity={showGranularity}
      {...restProps}
    />
  );
}
