import { RangeValue } from 'rc-picker/es/interface';
import { useMemo, useState } from 'react';
import HitsPerUserCard from './HitsPerUserCard';
import { generateAlertsListUrl } from './HitsPerUserCard/utils';
import { getCsvData } from '@/pages/dashboard/analysis/utils/export-data-build-util';
import SegmentedControl from '@/components/library/SegmentedControl';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { useTopUsersByRuleHit } from '@/hooks/api/dashboard';
import { isSuccess } from '@/utils/asyncResource';
import { getUserLink } from '@/utils/api/users';
import { getCurrentDomain } from '@/utils/routing';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useSafeLocalStorageState } from '@/utils/hooks';
interface Props extends WidgetProps {
  userType?: 'BUSINESS' | 'CONSUMER';
}

type ScopeSelectorValue = 'ALL' | 'ORIGIN' | 'DESTINATION';

const TopUsersHitCard = (props: Props) => {
  const { userType = 'BUSINESS' } = props;
  const settings = useSettings();

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'week'),
    dayjs(),
  ]);
  const [selectedSection, setSelectedSection] = useSafeLocalStorageState<ScopeSelectorValue>(
    `dashboard-${userType}-user-active-tab`,
    'ALL',
  );

  const direction = selectedSection !== 'ALL' ? selectedSection : undefined;
  const hitsPerUserResult = useTopUsersByRuleHit(dateRange, userType, direction);
  const dataToExport = useMemo(() => {
    if (isSuccess(hitsPerUserResult.data)) {
      const data = hitsPerUserResult.data.value.items.map((item) => {
        const alertLink = item.userId
          ? `${getCurrentDomain()}${generateAlertsListUrl(
              { userId: item.userId },
              direction,
              dateRange,
            )}`
          : null;
        return {
          userId: `${item.userId} (${getCurrentDomain()}${getUserLink({
            userId: item.userId,
            type: item.userType as 'BUSINESS' | 'CONSUMER',
          })})`,
          userName: item.userName ?? '',
          ruleHit: `${item.rulesHitCount} hits`,
          openAlerts: `${item.openAlertsCount} open alerts ${alertLink ? `(${alertLink})` : ''}`,
        };
      });
      return data;
    }
    return [];
  }, [hitsPerUserResult.data, direction, dateRange]);
  return (
    <Widget
      {...props}
      resizing="AUTO"
      extraControls={[
        <DatePicker.RangePicker
          value={dateRange}
          onChange={setDateRange}
          key="date-range-picker"
        />,
      ]}
      onDownload={(): Promise<{ fileName: string; data: string }> => {
        return new Promise((resolve, _reject) => {
          const fileData = {
            fileName: `top-${userType.toLowerCase()}-users-by-rule-hit-${dayjs().format(
              'YYYY_MM_DD',
            )}.csv`,
            data: getCsvData(dataToExport),
          };
          resolve(fileData);
        });
      }}
    >
      <SegmentedControl<ScopeSelectorValue>
        size="MEDIUM"
        active={selectedSection as ScopeSelectorValue}
        onChange={(newValue) => {
          setSelectedSection(newValue);
        }}
        items={[
          { value: 'ALL', label: `All ${settings.userAlias}s` },
          { value: 'ORIGIN', label: `Senders` },
          { value: 'DESTINATION', label: `Receivers` },
        ]}
        style={{ marginBottom: '1rem' }}
      />
      <HitsPerUserCard
        direction={selectedSection !== 'ALL' ? selectedSection : undefined}
        userType={userType}
        dateRange={dateRange}
        hitsPerUserResult={hitsPerUserResult}
      />
    </Widget>
  );
};

export default TopUsersHitCard;
