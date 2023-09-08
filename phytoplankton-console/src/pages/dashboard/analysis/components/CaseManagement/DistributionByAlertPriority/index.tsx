import Donut from '@/pages/dashboard/analysis/components/charts/Donut';
import {
  DashboardStatsAlertPriorityDistributionStats,
  DashboardStatsAlertPriorityDistributionStatsAlertPriorityData,
} from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import {
  COLORS_V2_PRIMARY_SHADES_BLUE_300,
  COLORS_V2_PRIMARY_SHADES_BLUE_100,
  COLORS_V2_PRIMARY_SHADES_BLUE_600,
  COLORS_V2_PRIMARY_TINTS_BLUE_900,
} from '@/components/ui/colors';
import { isSuccess } from '@/utils/asyncResource';
import { WidgetProps } from '@/components/library/Widget/types';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_PRIORITY_DISTRIBUTION } from '@/utils/queries/keys';
import Widget from '@/components/library/Widget';

const PRIORITY_COLORS: Record<string, string> = {
  ['P1']: COLORS_V2_PRIMARY_TINTS_BLUE_900,
  ['P2']: COLORS_V2_PRIMARY_SHADES_BLUE_600,
  ['P3']: COLORS_V2_PRIMARY_SHADES_BLUE_300,
  ['P4']: COLORS_V2_PRIMARY_SHADES_BLUE_100,
};

interface Props extends WidgetProps {}

const DistributionByAlertPriority = (props: Props) => {
  const api = useApi();
  const queryResult = useQuery(ALERT_PRIORITY_DISTRIBUTION(), async () => {
    const response = await api.getDashboardStatsAlertPriorityDistributionStats();
    return response;
  });
  const data = queryResult.data;
  const formatedData = !isSuccess(data)
    ? []
    : data.value.alertPriorityData.map(
        (item: DashboardStatsAlertPriorityDistributionStatsAlertPriorityData) => {
          return { priority: item.priority, value: item.value };
        },
      );
  return (
    <Widget
      {...props}
      width="HALF"
      onDownload={(): Promise<{ fileName: string; data: string }> => {
        return new Promise((resolve, _reject) => {
          const fileData = {
            fileName: `distribution-by-alert-priority`,
            data: JSON.stringify(formatedData),
          };
          resolve(fileData);
        });
      }}
    >
      <AsyncResourceRenderer<DashboardStatsAlertPriorityDistributionStats> resource={data}>
        {({ alertPriorityData }) => {
          const data = alertPriorityData.map(
            (item: DashboardStatsAlertPriorityDistributionStatsAlertPriorityData) => {
              return { priority: item.priority, value: item.value };
            },
          );

          return (
            <Donut data={data} COLORS={PRIORITY_COLORS} angleField="value" colorField="priority" />
          );
        }}
      </AsyncResourceRenderer>
    </Widget>
  );
};

export default DistributionByAlertPriority;
