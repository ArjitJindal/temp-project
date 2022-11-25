/* eslint-disable @typescript-eslint/no-var-requires */
import React from 'react';
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

export default function DRSDistributionCard() {
  const api = useApi();

  const queryResult = useQuery(USERS_STATS(), async () => {
    const response = await api.getDashboardStatsDrsDistribution();
    return {
      total: response.total,
      items: response.data,
    };
  });

  return (
    <div>
      <AsyncResourceRenderer resource={queryResult.data}>
        {(response) => {
          if (response.total === 0) {
            return <NoData />;
          }

          const config = {
            data: response.items,
            xField: 'riskLevel',
            yField: 'count',
            columnWidthRatio: 1,
            xAxis: {
              label: {
                autoHide: true,
                autoRotate: false,
              },
            },
            color: (data: any) => {
              return RISK_LEVEL_COLORS[data.riskLevel].primary;
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
