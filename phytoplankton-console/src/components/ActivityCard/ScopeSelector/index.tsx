import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import SegmentedControl from '@/components/library/SegmentedControl';

type ScopeSelectorValue = 'COMMENTS' | 'LOG';

interface Count {
  comments: number;
}
interface Props {
  selectedSection: string;
  setSelectedSection: (value: string) => void;
  count: Count;
}

export default function ScopeSelector(props: Props) {
  const { selectedSection, setSelectedSection, count } = props;
  const { comments } = count;
  const isAuditlogEnabled = useFeatureEnabled('AUDIT_LOGS');
  return (
    <SegmentedControl<ScopeSelectorValue>
      size="LARGE"
      active={selectedSection as ScopeSelectorValue}
      onChange={(newValue) => {
        setSelectedSection(newValue);
      }}
      items={[
        { value: 'COMMENTS', label: `Comments (${comments})` },
        ...(isAuditlogEnabled ? [{ value: 'LOG' as ScopeSelectorValue, label: `Log` }] : []),
      ]}
    />
  );
}
