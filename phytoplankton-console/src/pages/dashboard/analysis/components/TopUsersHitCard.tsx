import { useLocalStorageState } from 'ahooks';
import HitsPerUserCard from './HitsPerUserCard';
import SegmentedControl from '@/components/library/SegmentedControl';

interface Props {
  userType: 'BUSINESS' | 'CONSUMER';
}

type ScopeSelectorValue = 'ALL' | 'ORIGIN' | 'DESTINATION';

const TopUsersHitCard = (props: Props) => {
  const { userType } = props;

  const [selectedSection, setSelectedSection] = useLocalStorageState<ScopeSelectorValue>(
    `dashboard-${userType}-user-active-tab`,
    'ALL',
  );
  return (
    <div>
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
      />
    </div>
  );
};

export default TopUsersHitCard;
