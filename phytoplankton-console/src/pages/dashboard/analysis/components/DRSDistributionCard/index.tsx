/* eslint-disable @typescript-eslint/no-var-requires */
import React, { useMemo } from 'react';
import _ from 'lodash';
import Column, { ColumnData } from '../charts/Column';
import { useApi } from '@/api';
import { RISK_LEVELS } from '@/utils/risk-levels';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_STATS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import NoData from '@/pages/case-management-item/CaseDetails/InsightsCard/components/NoData';
import {
  getRiskLevelFromAlias,
  getRiskLevelLabel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { map } from '@/utils/asyncResource';
import { RiskLevel, TenantSettings } from '@/apis';
import {
  COLORS_V2_PRIMARY_SHADES_BLUE_100,
  COLORS_V2_PRIMARY_SHADES_BLUE_300,
  COLORS_V2_PRIMARY_SHADES_BLUE_50,
  COLORS_V2_PRIMARY_SHADES_BLUE_600,
  COLORS_V2_PRIMARY_TINTS_BLUE_900,
} from '@/components/ui/colors';

const getType = (riskLevel: RiskLevel, settings: TenantSettings) => {
  const data = getRiskLevelLabel(riskLevel, settings);
  const upperCase = _.upperCase(data).replace(' ', '_');
  return RISK_LEVELS.includes(upperCase as RiskLevel) ? upperCase : data;
};

const RISK_LEVEL_COLORS = {
  VERY_LOW: COLORS_V2_PRIMARY_SHADES_BLUE_50,
  LOW: COLORS_V2_PRIMARY_SHADES_BLUE_100,
  MEDIUM: COLORS_V2_PRIMARY_SHADES_BLUE_300,
  HIGH: COLORS_V2_PRIMARY_SHADES_BLUE_600,
  VERY_HIGH: COLORS_V2_PRIMARY_TINTS_BLUE_900,
};

interface Props {
  userType: 'BUSINESS' | 'CONSUMER';
}

export default function DRSDistributionCard(props: Props) {
  const { userType } = props;
  const api = useApi();
  const settings = useSettings();
  const queryResult = useQuery(USERS_STATS(userType), async () => {
    const response = await api.getDashboardStatsDrsDistribution({ userType });
    return {
      total: response.total,
      items: response.data,
    };
  });

  const graphData = useMemo(() => {
    enum RiskLevel {
      VERY_LOW,
      LOW,
      MEDIUM,
      HIGH,
      VERY_HIGH,
    }
    return map(queryResult.data, (data) => {
      return {
        total: data.total,
        items: data.items
          .map((item) => {
            const percentage = item.percentage === undefined ? '0' : item.percentage;
            return {
              type: getType(item.riskLevel, settings),
              count: item.count,
              riskLevel: item.riskLevel,
              riskScoreRange: item.riskScoreRange,
              percentage: parseFloat(percentage),
            };
          })
          .sort((a, b) => {
            return a.riskLevel && b.riskLevel ? RiskLevel[a.riskLevel] - RiskLevel[b.riskLevel] : 0;
          }),
      };
    });
  }, [queryResult.data, settings]);

  return (
    <div>
      <AsyncResourceRenderer resource={graphData}>
        {(response) => {
          if (response.total === 0) {
            return <NoData />;
          }
          const data: ColumnData<string, number, string> = response.items.map((item) => {
            return {
              xValue: item.type,
              yValue: item.percentage,
              series: item.type,
            };
          });
          let COLORS = {};
          response.items.map((item) => {
            COLORS = {
              ...COLORS,
              [item.type]: RISK_LEVEL_COLORS[getRiskLevelFromAlias(item.type, settings)] as string,
            };
          });
          return (
            <Column
              data={data}
              colors={COLORS}
              height={400}
              hideLegend={true}
              rotateLabel={false}
            />
          );
        }}
      </AsyncResourceRenderer>
    </div>
  );
}
