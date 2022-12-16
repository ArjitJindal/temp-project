/* eslint-disable @typescript-eslint/no-var-requires */
import React, { useMemo } from 'react';
import { Card, Col, Row } from 'antd';
import _ from 'lodash';
import { Column } from '@ant-design/charts';
import { header, smallHeader } from '../dashboardutils';
import s from './styles.module.less';
import { useApi } from '@/api';
import { RISK_LEVEL_COLORS } from '@/utils/risk-levels';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_STATS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import NoData from '@/pages/case-management-item/UserCaseDetails/InsightsCard/components/NoData';
import {
  getRiskLevelFromAlias,
  getRiskLevelLabel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { map } from '@/utils/asyncResource';

export default function DRSDistributionCard() {
  const api = useApi();
  const settings = useSettings();
  const queryResult = useQuery(USERS_STATS(), async () => {
    const response = await api.getDashboardStatsDrsDistribution();
    return {
      total: response.total,
      items: response.data,
    };
  });

  const graphData = useMemo(() => {
    return map(queryResult.data, (data) => {
      return {
        total: data.total,
        items: data.items.map((item) => {
          return {
            type: getRiskLevelLabel(item.riskLevel, settings),
            count: item.count,
            riskLevel: item.riskLevel,
            riskScoreRange: item.riskScoreRange,
            percentage: item.percentage,
          };
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
          const config = {
            data: response.items,
            xField: 'type',
            yField: 'count',
            columnWidthRatio: 1,
            xAxis: {
              label: {
                autoHide: true,
                autoRotate: false,
              },
            },
            color: (data: any) => {
              return RISK_LEVEL_COLORS[getRiskLevelFromAlias(data.type, settings)].primary;
            },
            interactions: [
              {
                type: 'active-region',
                enable: false,
              },
            ],
            tooltip: {
              title: 'Risk Distribution',
              showMarkers: false,
              customContent: (title: string, data: any) => {
                return (
                  <div className={s.drsTooltip}>
                    <h3 className={s.drsTooltipTitle}>{title}</h3>
                    <p className={s.drsTooltipElements}>
                      Risk score range:{' '}
                      <span className={s.drsTooltipValues}> {data[0]?.data.riskScoreRange}</span>
                    </p>
                    <p className={s.drsTooltipElements}>
                      Users:
                      <span className={s.drsTooltipValues}>
                        {data[0]?.data.count} ({data[0]?.data.percentage}%)
                      </span>
                    </p>
                  </div>
                );
              },
            },
            meta: {
              type: {
                alias: 'Risk Level',
              },
              sales: {
                alias: 'Number of Users',
              },
            },
          };

          return (
            <Card
              bordered={false}
              bodyStyle={{ padding: 0 }}
              title={header('User Distribution by DRS Risk Level')}
            >
              <Row>
                <Col span={12}>
                  <Card bordered={false} title={smallHeader('Breakdown by risk scores')}>
                    <Column {...config} />
                  </Card>
                </Col>
                <Col span={12}></Col>
              </Row>
            </Card>
          );
        }}
      </AsyncResourceRenderer>
      ;
    </div>
  );
}
