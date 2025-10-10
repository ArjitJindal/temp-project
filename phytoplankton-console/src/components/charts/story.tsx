import { useState } from 'react';
import dayjs from '@flagright/lib/utils/dayjs';
import { uniq } from 'lodash';
import TreemapChart, { TreemapData } from 'src/components/charts/TreemapChart';
import BarChart, { BarChartData } from './BarChart';
import { UseCase } from '@/pages/storybook/components';
import { loading, success } from '@/utils/asyncResource';
import { ALL_CHART_COLORS } from '@/components/ui/colors';
import Toggle from '@/components/library/Toggle';
import Label from '@/components/library/Label';
import Button from '@/components/library/Button';
import { makeRandomNumberGenerator } from '@/utils/prng';
import LineChart, { LineData } from '@/components/charts/Line';
import DonutChart, { DonutData } from '@/components/charts/DonutChart';
import Slider from '@/components/library/Slider';

export default function (): JSX.Element {
  const [skeletonMode, setSkeletonMode] = useState(false);
  const [useCustomFormatters, setUseCustomFormatters] = useState(false);

  const [seed, setSeed] = useState(0.1);

  const prnd = makeRandomNumberGenerator(seed);

  const STACKED_COLUMN_DATA: BarChartData<string, string> = ['LOW', 'MEDIUM', 'HIGH'].flatMap(
    (series) =>
      ['2024/05/05', '2024/05/06', '2024/05/07', '2024/05/08', '2024/05/09'].map((category) => ({
        series,
        category: category,
        value: prnd() * 100000,
      })),
  );

  const LINE_SERIES_1 = 'First line';
  const LINE_SERIES_2 = 'Second line';
  const LINE_DATA_1: LineData<string, string> = [];
  const LINE_DATA_2: LineData<string, string> = [];
  for (let i = 0; i < 100; i++) {
    LINE_DATA_1.push({
      xValue: dayjs()
        .add(i * 3, 'day')
        .format('YYYY/MM/DD'),
      yValue: (i === 0 ? prnd() * 1000 : LINE_DATA_1[i - 1]?.yValue) + 10 * (prnd() < 0.7 ? -1 : 1),
      series: LINE_SERIES_1,
    });
    LINE_DATA_2.push({
      xValue: dayjs()
        .add(i * 5, 'day')
        .format('YYYY/MM/DD'),
      yValue: (i === 0 ? prnd() * 1000 : LINE_DATA_2[i - 1]?.yValue) + 10 * (prnd() < 0.5 ? -1 : 1),
      series: LINE_SERIES_2,
    });
  }
  const LINE_DATA = [...LINE_DATA_1, ...LINE_DATA_2];
  LINE_DATA.sort((x, y) => x.xValue.toString().localeCompare(y.xValue.toString()));

  const TREEMAP_DATA: TreemapData<string> = [
    {
      name: `this is empty value and should not be visible anywhere`,
      value: 0,
    },
    ...[...new Array(3 + Math.round(prnd() * 30))].map((_, i) => ({
      name: `value ${i + 1}`,
      value: 5 * (i + 1) * prnd(),
    })),
  ];

  const DONUT_DATA: DonutData<string> = [
    {
      name: `this is empty value and should not be visible anywhere`,
      value: 0,
    },
    ...[...new Array(3 + Math.round(prnd() * 30))].map((_, i) => ({
      name: `value ${i + 1}`,
      value: 5 * (i + 1) * prnd(),
    })),
  ];

  const [height, setHeight] = useState(350);

  return (
    <>
      <div
        style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(200px, min-content) auto' }}
      >
        <Button
          onClick={() => {
            setSeed(Number.MAX_SAFE_INTEGER * Math.random());
          }}
        >
          New data
        </Button>
        <Label label={'Skeleton mode'} position={'RIGHT'}>
          <Toggle
            size={'S'}
            value={skeletonMode}
            onChange={(newValue) => setSkeletonMode(newValue ?? false)}
          />
        </Label>
        <Label label={'Use custom formatters'} position={'RIGHT'}>
          <Toggle
            size={'S'}
            value={useCustomFormatters}
            onChange={(newValue) => setUseCustomFormatters(newValue ?? false)}
          />
        </Label>
        <div style={{ gridColumn: 'span 3' }}>
          <Label label={'Chart height'}>
            <Slider
              min={50}
              max={500}
              value={height}
              mode={'SINGLE'}
              onChange={(value) => {
                setHeight(value ?? 50);
              }}
            />
          </Label>
        </div>
      </div>
      <UseCase title={'DonutChart'}>
        <DonutChart
          height={height}
          data={skeletonMode ? loading() : success(DONUT_DATA)}
          colors={uniq(DONUT_DATA.map(({ name }) => name)).reduce(
            (acc, label, i) => ({ ...acc, [`${label}`]: ALL_CHART_COLORS[i] }),
            {},
          )}
          formatName={
            useCustomFormatters
              ? (value) => {
                  return `${value} (name)`;
                }
              : undefined
          }
          formatValue={
            useCustomFormatters
              ? (value) => {
                  return `${value.toFixed(2)} (Value)`;
                }
              : undefined
          }
        />
      </UseCase>
      <UseCase title={'TreemapChart'}>
        <TreemapChart
          height={height}
          data={skeletonMode ? loading() : success(TREEMAP_DATA)}
          colors={uniq(LINE_DATA.map(({ series }) => series)).reduce(
            (acc, label, i) => ({ ...acc, [`${label}`]: ALL_CHART_COLORS[i] }),
            {},
          )}
          formatName={
            useCustomFormatters
              ? (value) => {
                  return `${value} (name)`;
                }
              : undefined
          }
          formatValue={
            useCustomFormatters
              ? (value) => {
                  return `${value.toFixed(2)} (Value)`;
                }
              : undefined
          }
        />
      </UseCase>
      <UseCase title={'Line'}>
        <LineChart
          height={height}
          data={skeletonMode ? loading() : success(LINE_DATA)}
          colors={uniq(LINE_DATA.map(({ series }) => series)).reduce(
            (acc, label, i) => ({ ...acc, [`${label}`]: ALL_CHART_COLORS[i] }),
            {},
          )}
          formatX={
            useCustomFormatters
              ? (value) => {
                  return `${value} (X)`;
                }
              : undefined
          }
          formatY={
            useCustomFormatters
              ? (value) => {
                  return `${value.toFixed(2)} (Y)`;
                }
              : undefined
          }
          formatSeries={
            useCustomFormatters
              ? (value) => {
                  return `${value} (Series)`;
                }
              : undefined
          }
        />
      </UseCase>
      <UseCase title={'Line with vertical reference lines'}>
        <LineChart
          height={height}
          data={skeletonMode ? loading() : success(LINE_DATA)}
          colors={uniq(LINE_DATA.map(({ series }) => series)).reduce(
            (acc, label, i) => ({ ...acc, [`${label}`]: ALL_CHART_COLORS[i] }),
            {},
          )}
          formatX={
            useCustomFormatters
              ? (value) => {
                  return `${value} (X)`;
                }
              : undefined
          }
          formatY={
            useCustomFormatters
              ? (value) => {
                  return `${value.toFixed(2)} (Y)`;
                }
              : undefined
          }
          formatSeries={
            useCustomFormatters
              ? (value) => {
                  return `${value} (Series)`;
                }
              : undefined
          }
          verticalLines={[
            {
              xValue: dayjs().utc().add(30, 'day').format('YYYY/MM/DD'),
              color: '#FF6B6B',
              label: 'Important event 1',
            },
            {
              xValue: dayjs().utc().add(60, 'day').format('YYYY/MM/DD'),
              color: '#4ECDC4',
              label: 'Important event 2',
            },
          ]}
        />
      </UseCase>
      <UseCase title={'Stacked column'}>
        {([state, setState]) => (
          <>
            <Label label={'Custom bar colors'} position={'RIGHT'}>
              <Toggle
                size={'S'}
                value={state.customBarColors ?? false}
                onChange={(newValue) => setState({ customBarColors: newValue })}
              />
            </Label>
            <BarChart
              grouping={'STACKED'}
              data={skeletonMode ? loading() : success(STACKED_COLUMN_DATA)}
              height={height}
              colors={uniq(STACKED_COLUMN_DATA.map(({ series }) => series)).reduce(
                (acc, label, i) => ({ ...acc, [label]: ALL_CHART_COLORS[i] }),
                {},
              )}
              formatSeries={
                useCustomFormatters
                  ? (value) => {
                      return `${value} (series)`;
                    }
                  : undefined
              }
              formatCategory={
                useCustomFormatters
                  ? (value) => {
                      return `${value} (category)`;
                    }
                  : undefined
              }
              formatValue={
                useCustomFormatters
                  ? (value) => {
                      return `${value.toFixed(2)} (value)`;
                    }
                  : undefined
              }
              customBarColors={
                state.customBarColors
                  ? (category, series) => {
                      const categoryIndex = uniq(
                        STACKED_COLUMN_DATA.map(({ category }) => category),
                      ).indexOf(category);
                      const seriesIndex = uniq(
                        STACKED_COLUMN_DATA.map(({ series }) => series),
                      ).indexOf(series);
                      return ALL_CHART_COLORS[
                        ((1 + categoryIndex) * 10 + seriesIndex) % ALL_CHART_COLORS.length
                      ];
                    }
                  : undefined
              }
            />
          </>
        )}
      </UseCase>
      <UseCase title={'Groped column'}>
        {([state, setState]) => (
          <>
            <Label label={'Custom bar colors'} position={'RIGHT'}>
              <Toggle
                size={'S'}
                value={state.customBarColors ?? false}
                onChange={(newValue) => setState({ customBarColors: newValue })}
              />
            </Label>
            <BarChart
              grouping={'GROUPED'}
              data={skeletonMode ? loading() : success(STACKED_COLUMN_DATA)}
              height={height}
              colors={uniq(STACKED_COLUMN_DATA.map(({ series }) => series)).reduce(
                (acc, label, i) => ({ ...acc, [label]: ALL_CHART_COLORS[i] }),
                {},
              )}
              formatSeries={
                useCustomFormatters
                  ? (value) => {
                      return `${value} (series)`;
                    }
                  : undefined
              }
              formatCategory={
                useCustomFormatters
                  ? (value) => {
                      return `${value} (category)`;
                    }
                  : undefined
              }
              formatValue={
                useCustomFormatters
                  ? (value) => {
                      return `${value.toFixed(2)} (value)`;
                    }
                  : undefined
              }
              customBarColors={
                state.customBarColors
                  ? (category, series) => {
                      const categoryIndex = uniq(
                        STACKED_COLUMN_DATA.map(({ category }) => category),
                      ).indexOf(category);
                      const seriesIndex = uniq(
                        STACKED_COLUMN_DATA.map(({ series }) => series),
                      ).indexOf(series);
                      return ALL_CHART_COLORS[
                        ((1 + categoryIndex) * 10 + seriesIndex) % ALL_CHART_COLORS.length
                      ];
                    }
                  : undefined
              }
            />
          </>
        )}
      </UseCase>
    </>
  );
}
