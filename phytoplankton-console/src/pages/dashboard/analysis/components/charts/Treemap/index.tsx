import { Datum, Treemap as AntTreemap } from '@ant-design/charts';
import { Tooltip } from '@ant-design/plots';
import { COLORS_V2_ANALYTICS_CHARTS_11 } from '@/components/ui/colors';

export interface TreemapItem<Name extends string = string> {
  name: Name | null;
  value: number;
}

export type TreemapData<Name extends string = string> = TreemapItem<Name>[];

interface Props<Name extends string = string> {
  data: TreemapData<Name>;
  colors: { [key in Name]: string | undefined };
  formatTitle?: (name: Name | null) => string;
  height?: number;
}

export default function Treemap<Name extends string = string>(props: Props<Name>) {
  const { formatTitle, height, data, colors } = props;

  return (
    <AntTreemap
      animation={false}
      data={{
        name: 'root',
        children: data,
      }}
      colorField={'name'}
      color={(data: Datum) => colors[data.name] ?? COLORS_V2_ANALYTICS_CHARTS_11}
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
        itemName: {
          formatter: formatTitle ? (formatTitle as unknown as any) : undefined,
        },
        padding: [0, 0, 0, 50],
      }}
      rectStyle={{
        strokeOpacity: 0,
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
          fontSize: 10,
          fontFamily: 'Noto Sans',
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
