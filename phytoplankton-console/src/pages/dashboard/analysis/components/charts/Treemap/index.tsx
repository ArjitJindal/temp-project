import { Datum, Treemap as AntTreemap } from '@ant-design/charts';
import { Tooltip } from '@ant-design/plots';
import { useMemo } from 'react';
import s from './index.module.less';
import {
  ALL_CHART_COLORS,
  COLORS_V2_ANALYTICS_CHARTS_11,
  COLORS_V2_GRAY_11,
  COLORS_V2_SKELETON_COLOR,
} from '@/components/ui/colors';
import { AsyncResource, getOr, isLoading } from '@/utils/asyncResource';
import { makeRandomNumberGenerator } from '@/utils/prng';

const random = makeRandomNumberGenerator(999999);
const SKELETON_DATA: TreemapData<string> = [...new Array(10)].map((_, column) => ({
  name: [...new Array(4 + Math.floor(8 * random()))].map(() => '■').join('') + `__${column}`,
  value: 1 + 29 * random(),
}));

export interface TreemapItem<Name extends string = string> {
  name: Name | null;
  value: number;
}

export type TreemapData<Name extends string = string> = TreemapItem<Name>[];

interface Props<Name extends string = string> {
  data: AsyncResource<TreemapData<Name>>;
  colors: { [key in Name]: string | undefined };
  formatTitle?: (name: Name | null) => string;
  height?: number;
}

export default function Treemap<Name extends string = string>(props: Props<Name>) {
  const { formatTitle, height, data, colors } = props;

  const dataValue = getOr(data, null);
  const showSkeleton = isLoading(data) && dataValue == null;

  const allColors = useMemo(() => {
    const result = { ...colors };
    let i = 0;
    const availableColors = ALL_CHART_COLORS.filter((x) => !Object.values(colors).includes(x));
    for (const { name } of dataValue ?? []) {
      if (name != null) {
        if (result[name] == null) {
          i = (i + 1) % ALL_CHART_COLORS.length;
          result[name] = availableColors[i];
        }
      }
    }
    return result;
  }, [colors, dataValue]);

  return (
    <AntTreemap
      className={showSkeleton && s.disabled}
      animation={false}
      data={{
        name: 'root',
        children: (showSkeleton ? SKELETON_DATA : dataValue) ?? [],
      }}
      colorField={'name'}
      color={(data: Datum) =>
        showSkeleton
          ? COLORS_V2_SKELETON_COLOR
          : allColors[data.name] ?? COLORS_V2_ANALYTICS_CHARTS_11
      }
      height={height}
      tooltip={
        {
          customItems: (originalItems: { data: TreemapItem<Name>; name?: string }[]) => {
            return originalItems.map((item) => {
              const treemapItem = item.data;
              return {
                ...item,
                name: formatTitle && treemapItem.name ? formatTitle(treemapItem.name) : item.name,
              };
            });
          },
        } as Tooltip
      }
      legend={{
        position: 'right-top',
        padding: [0, 0, 0, 50],
        itemName: {
          formatter: showSkeleton
            ? (value) => {
                return value.replaceAll(/[^■]/g, '');
              }
            : formatTitle
            ? (formatTitle as unknown as any)
            : undefined,
          style: {
            fill: showSkeleton ? COLORS_V2_SKELETON_COLOR : undefined,
            stroke: showSkeleton ? COLORS_V2_SKELETON_COLOR : undefined,
            lineWidth: showSkeleton ? 5 : undefined,
          },
        },
      }}
      rectStyle={{
        stroke: showSkeleton ? 'white' : 'transparent',
      }}
      label={{
        content: (item: Datum, positionData: any) => {
          const treemapItem = item.data as TreemapItem<Name>;
          const value = treemapItem.value;
          const title = formatTitle ? formatTitle(treemapItem.name) : treemapItem.name;
          const name = `${title} (${value})`;
          const nameLength = estimateWordWidth(name, 10, 600);
          const width = (positionData.x?.[1] ?? 0) - (positionData.x?.[0] ?? 0);
          const displayLabel = getDisplayLabel(name, nameLength, width);
          return displayLabel;
        },
        style: {
          fontWeight: 600,
          fontSize: 12,
          fontFamily: 'Noto Sans',
          fill: showSkeleton ? 'transparent' : COLORS_V2_GRAY_11,
        },
      }}
    />
  );
}

function estimateWordWidth(word: string, fontSize: number, fontWeight: number) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = `${fontWeight} ${fontSize}px 'Noto Sans'`;
  const width = ctx.measureText(word).width;
  canvas.remove();
  return width;
}

function getDisplayLabel(word: string, wordLength: number, totalWidth: number) {
  if (Math.floor(totalWidth) >= Math.ceil(wordLength)) return word;
  totalWidth -= 8.5; // Width required for '...'
  let displayLabel = '';
  let i = 0;
  while (totalWidth - 6 > 0 && i < word.length) {
    totalWidth -= 6;
    displayLabel += word[i];
    i++;
  }
  return displayLabel + '...';
}
