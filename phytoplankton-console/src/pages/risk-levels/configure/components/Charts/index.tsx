import React from 'react';
import s from './styles.module.less';
import BarChart from '@/components/charts/BarChart';
import { success } from '@/utils/asyncResource';
import COLORS from '@/components/ui/colors';
import {
  ChartParts,
  Configuration,
  getEntityConfiguration,
  ToolTipOptions,
} from '@/components/charts/BarChart/helpers';
import { useGetAlias } from '@/components/AppWrapper/Providers/SettingsProvider';

export interface Props {
  data: any[];
  max: number;
}

const colors = {
  VERY_LOW: COLORS.limeGreen,
  LOW: COLORS.green,
  MEDIUM: COLORS.lightYellow,
  HIGH: COLORS.lightOrange,
  VERY_HIGH: COLORS.lightRed,
};

const GroupedColumn = React.memo((props: Props) => {
  const { data } = props;
  const getAlias = useGetAlias();
  const configuration: Configuration = {
    [ChartParts.BAR]: getEntityConfiguration<ChartParts.BAR>(ChartParts.BAR, {
      renderWholeGroupData: true,
    }),
    [ChartParts.AXIS]: getEntityConfiguration<ChartParts.AXIS>(ChartParts.AXIS, {
      shouldRender: false,
    }),
    [ChartParts.SPACE]: getEntityConfiguration<ChartParts.SPACE>(ChartParts.SPACE, {
      toolTipType: ToolTipOptions.VALUE,
    }),
  };
  return (
    <div className={s.root}>
      <BarChart<string, string>
        colors={{}}
        data={success(data.map((x) => ({ category: x.name, series: x.label, value: x.value })))}
        grouping={'GROUPED'}
        formatCategory={(x) => getAlias(x, true)}
        customBarColors={(category, series, defaultColor) => {
          if (series === 'Before') {
            return colors[category].base;
          } else {
            return colors[category].alpha ?? defaultColor;
          }
        }}
        hideLegend={true}
        configuration={configuration}
        height={350}
      />
    </div>
  );
});

export default GroupedColumn;
