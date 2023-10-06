import { useLocalStorageState } from 'ahooks';
import { RangeValue } from 'rc-picker/es/interface';
import React, { useState } from 'react';
import HitsPerUserCard from './HitsPerUserCard';
import SegmentedControl from '@/components/library/SegmentedControl';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';

interface Props extends WidgetProps {
  userType?: 'BUSINESS' | 'CONSUMER';
}

type ScopeSelectorValue = 'ALL' | 'ORIGIN' | 'DESTINATION';

const TopUsersHitCard = (props: Props) => {
  const { userType = 'BUSINESS' } = props;

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'week'),
    dayjs(),
  ]);
  const [selectedSection, setSelectedSection] = useLocalStorageState<ScopeSelectorValue>(
    `dashboard-${userType}-user-active-tab`,
    'ALL',
  );
  return (
    <Widget
      {...props}
      extraControls={[<DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
    >
      <SegmentedControl<ScopeSelectorValue>
        size="MEDIUM"
        active={selectedSection as ScopeSelectorValue}
        onChange={(newValue) => {
          setSelectedSection(newValue);
        }}
        items={[
          { value: 'ALL', label: `All users` },
          { value: 'ORIGIN', label: `Senders` },
          { value: 'DESTINATION', label: `Receivers` },
        ]}
      />
      <HitsPerUserCard
        direction={selectedSection !== 'ALL' ? selectedSection : undefined}
        userType={userType}
        dateRange={dateRange}
      />
    </Widget>
  );
};

export default TopUsersHitCard;
