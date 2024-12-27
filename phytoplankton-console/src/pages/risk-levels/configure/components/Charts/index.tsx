import { Column } from '@ant-design/charts';
import React from 'react';
import s from './styles.module.less';
import COLORS from '@/components/ui/colors';
import { formatNumber } from '@/utils/number';

export interface Props {
  data: Record<string, any>[];
  max: number;
}

const colors = {
  VERY_LOW: COLORS.limeGreen.base,
  LOW: COLORS.green.base,
  MEDIUM: COLORS.lightYellow.base,
  HIGH: COLORS.lightOrange.base,
  VERY_HIGH: COLORS.lightRed.base,
};

const GroupedColumn = React.memo((props: Props) => {
  const { data } = props;
  return (
    <Column
      isGroup={true}
      xField="name"
      yField="value"
      data={data}
      dodgePadding={0}
      seriesField="label"
      yAxis={{
        grid: null,
        minLimit: 0,
        maxLimit: props.max,
        label: {
          formatter: (text) => {
            return formatNumber(text);
          },
        },
      }}
      label={{
        position: 'top',
        style: {
          fontStyle: 'bold',
          fontSize: 12,
          fill: '#000',
        },
        content: (data) => {
          return formatNumber(data.value);
        },
      }}
      minColumnWidth={32}
      maxColumnWidth={36}
      intervalPadding={16}
      width={250}
      tooltip={{
        customContent: (_, items) => {
          const beforeData = items.find((item) => item.name === 'Before');
          const afterData = items.find((item) => item.name === 'After');

          return (
            <div className={s.tooltipRoot}>
              <div className={s.tooltipParentContainer}>
                <div className={s.tooltipContainer} style={{ marginBottom: 8 }}>
                  <div
                    className={s.tooltipColor}
                    style={{ backgroundColor: colors[beforeData?.data.name] }}
                  />
                  <p>{beforeData?.data.label}</p>
                  <p>{beforeData?.data.value}</p>
                </div>
                <div className={s.tooltipContainer}>
                  <div
                    className={s.tooltipColor}
                    style={{ backgroundColor: colors[afterData?.data.name], opacity: 0.5 }}
                  />
                  <p>{afterData?.data.label}</p>
                  <p>{afterData?.data.value}</p>
                </div>
              </div>
            </div>
          );
        },
      }}
      height={350}
      columnStyle={(datum) => {
        if (datum.label === 'Before') {
          return {
            fill: colors[datum.name],
            fillOpacity: 1,
          };
        } else {
          return {
            fill: colors[datum.name],
            fillOpacity: 0.5,
          };
        }
      }}
      legend={false}
      interactions={[
        {
          type: 'active-region',
          enable: false,
        },
      ]}
    />
  );
});

export default GroupedColumn;
