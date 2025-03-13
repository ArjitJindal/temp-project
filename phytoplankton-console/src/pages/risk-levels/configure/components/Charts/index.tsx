import React from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import BarChart from '@/components/charts/BarChart';
import { success } from '@/utils/asyncResource';
import COLORS from '@/components/ui/colors';
import {
  ChartParts,
  Configuration,
  getEntityConfiguration,
  ToolTipOptions,
} from '@/components/charts/BarChart/helpers';

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
    <BarChart<string, string>
      colors={{}}
      data={success(data.map((x) => ({ category: x.name, series: x.label, value: x.value })))}
      grouping={'GROUPED'}
      formatCategory={(x) => humanizeConstant(x)}
      customBarColors={(category, series, defaultColor) => {
        if (series === 'Before') {
          return colors[category].base;
        } else {
          return colors[category].alpha ?? defaultColor;
        }
      }}
      hideLegend={true}
      configuration={configuration}
      // dodgePadding={0}
      // seriesField="label"
      // yAxis={{ grid: null, minLimit: 0, maxLimit: props.max }}
      // label={{
      //   position: 'top',
      //   style: {
      //     fontStyle: 'bold',
      //     fontSize: 12,
      //     fill: '#000',
      //   },
      // }}
      // minColumnWidth={32}
      // maxColumnWidth={36}
      // intervalPadding={16}
      // width={250}
      // tooltip={{
      //   customContent: (_, items) => {
      //     const beforeData = items.find((item) => item.name === 'Before');
      //     const afterData = items.find((item) => item.name === 'After');
      //
      //     return (
      //       <div className={s.tooltipRoot}>
      //         <div className={s.tooltipParentContainer}>
      //           <div className={s.tooltipContainer} style={{ marginBottom: 8 }}>
      //             <div
      //               className={s.tooltipColor}
      //               style={{ backgroundColor: colors[beforeData?.data.name] }}
      //             />
      //             <p>{beforeData?.data.label}</p>
      //             <p>{beforeData?.data.value}</p>
      //           </div>
      //           <div className={s.tooltipContainer}>
      //             <div
      //               className={s.tooltipColor}
      //               style={{ backgroundColor: colors[afterData?.data.name], opacity: 0.5 }}
      //             />
      //             <p>{afterData?.data.label}</p>
      //             <p>{afterData?.data.value}</p>
      //           </div>
      //         </div>
      //       </div>
      //     );
      //   },
      // }}
      // legend={false}
      // interactions={[
      //   {
      //     type: 'active-region',
      //     enable: false,
      //   },
      // ]}
      height={350}
    />
  );
});

export default GroupedColumn;
