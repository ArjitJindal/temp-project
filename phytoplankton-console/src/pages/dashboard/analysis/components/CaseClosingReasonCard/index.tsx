import { Datum, Treemap } from '@ant-design/charts';
import { has } from 'lodash';
import s from './index.module.less';
import COLORS from '@/components/ui/colors';
import { AsyncResource, isSuccess } from '@/utils/asyncResource';
import ScopeSelector from '@/pages/dashboard/analysis/components/CaseClosingReasonCard/ScopeSelector';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { DashboardStatsOverview, DashboardStatsOverviewClosingReasonsData } from '@/apis';

const TREEMAP_COLORS = {
  ['False positive']: COLORS.skyBlueAccent,
  ['Investigation completed']: COLORS.softBlueHaze,
  ['Documents collected']: COLORS.lavenderMist,
  ['Suspicious activity reported (SAR)']: COLORS.elegantPurple,
  ['Documents not collected']: COLORS.sunsetYellow,
  ['Transaction Refunded']: COLORS.tranquilBlue,
  ['Transaction Rejected']: COLORS.copperSun,
  ['User Blacklisted']: COLORS.mysticMauve,
  ['User Terminated']: COLORS.aquamarineGreen,
  ['Escalated']: COLORS.slateBlue,
  ['Other']: COLORS.calmTeal,
};

interface Props {
  selectedSection: string;
  setSelectedSection: (value: string) => void;
  data: AsyncResource<DashboardStatsOverview>;
}

const CaseClosingReasonCard = (props: Props) => {
  const { selectedSection, setSelectedSection, data } = props;
  const formatedData = !isSuccess(data)
    ? {
        name: 'root',
        children: [],
      }
    : {
        name: 'root',
        children: data.value.closingReasonsData
          ?.map((child: DashboardStatsOverviewClosingReasonsData) => {
            if (child.reason && has(TREEMAP_COLORS, child.reason)) {
              return {
                name: child.reason,
                value: child.value ?? 0,
              };
            }
            return null;
          })
          .filter((child: DashboardStatsOverviewClosingReasonsData | null) => child != null),
      };

  const estimateWordWidth = (word: string, fontSize: number, fontWeight: number) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;
    ctx.font = `${fontWeight} ${fontSize}px 'Noto Sans'`;
    const width = ctx.measureText(word).width;
    canvas.remove();
    return width;
  };

  const getDisplayLabel = (word: string, wordLength: number, totalWidth: number) => {
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
  };
  return {
    children: (
      <AsyncResourceRenderer<DashboardStatsOverview> resource={data}>
        {({ closingReasonsData }) => {
          const data = {
            name: 'root',
            children: closingReasonsData
              ?.map((child: DashboardStatsOverviewClosingReasonsData) => {
                if (child.reason && has(TREEMAP_COLORS, child.reason)) {
                  return {
                    name: child.reason,
                    value: child.value ?? 0,
                  };
                }
                return null;
              })
              .filter((child: DashboardStatsOverviewClosingReasonsData | null) => child != null),
          };
          const config = {
            data,
            colorField: 'name',
            color: (data: Record<string, any>) => TREEMAP_COLORS[data.name],
          };
          return (
            <div className={s.root}>
              <ScopeSelector
                selectedSection={selectedSection}
                setSelectedSection={setSelectedSection}
              />
              <Treemap
                {...config}
                legend={{
                  position: 'right-top',
                }}
                rectStyle={{
                  strokeOpacity: 0,
                }}
                label={{
                  content: (item: Datum, positionData: any) => {
                    const value = item.data.value;
                    const name = `${item.data.name} (${value})`;
                    const nameLength = estimateWordWidth(name, 10, 600);
                    const width = positionData.x[1] - positionData.x[0];
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
            </div>
          );
        }}
      </AsyncResourceRenderer>
    ),
    onDownload: (): Promise<{ fileName: string; data: string }> => {
      return new Promise((resolve, _reject) => {
        const fileData = {
          fileName: `distribution-by-${selectedSection.toLowerCase()}-closing-reason`,
          data: JSON.stringify(formatedData.children),
        };
        resolve(fileData);
      });
    },
  };
};
export default CaseClosingReasonCard;
