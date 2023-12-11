/* eslint-disable @typescript-eslint/no-var-requires */
import { useMemo, useState } from 'react';
import DistributionChartWidget from '../widgets/DistributionChartWidget';
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
import { dayjs } from '@/utils/dayjs';
import { RISK_LEVELS } from '@/utils/risk-levels';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

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

export function RiskLevelDistributionCard(props: Props) {
  return <RiskLevelDistributionCardBase {...props} groupBy="VALUE" />;
}

export function RiskLevelBreakdownCard(props: Props) {
  return <RiskLevelDistributionCardBase {...props} groupBy="TIME" />;
}

function RiskLevelDistributionCardBase(props: Props & { groupBy: 'VALUE' | 'TIME' }) {
  const { userType = 'CONSUMER', groupBy, ...restProps } = props;
  const [timeRange, setTimeRange] = useState({
    startTimestamp: dayjs().subtract(1, 'year').valueOf(),
    endTimestamp: dayjs().valueOf(),
  });
  const params = {
    userType: userType,
    startTimestamp: timeRange.startTimestamp,
    endTimestamp: timeRange.endTimestamp,
  };
  const settings = useSettings();
  const api = useApi();
  const queryResult = useQuery(USERS_STATS(params), async () => {
    return await api.getDashboardStatsUsersByTime(params);
  });
  const valueNames = useMemo(
    () =>
      Object.fromEntries(
        RISK_LEVELS.map((riskLevel) => [riskLevel, getRiskLevelLabel(riskLevel, settings)]),
      ),
    [settings],
  ) as { [key in RiskLevel]: string };

  return (
    <DistributionChartWidget<DashboardStatsUsersStats, RiskLevel>
      groups={[
        { name: 'CRA', attributeName: 'CRA', attributeDataPrefix: 'drsRiskLevel' },
        { name: 'KRS', attributeName: 'KRS', attributeDataPrefix: 'krsRiskLevel' },
      ]}
      groupBy={groupBy}
      valueColors={RISK_LEVEL_COLORS}
      values={RISK_LEVELS}
      queryResult={queryResult}
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
      valueNames={valueNames}
      {...restProps}
    />
  );
}
