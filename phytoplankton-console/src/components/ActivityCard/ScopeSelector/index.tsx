import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import SegmentedControl from '@/components/library/SegmentedControl';

export type ScopeSelectorValue = 'COMMENTS' | 'LOG';

interface Count {
  comments: number;
}
interface Props {
  selectedSection: ScopeSelectorValue;
  setSelectedSection: (value: ScopeSelectorValue) => void;
  count: Count;
}

export default function ScopeSelector(props: Props) {
  const { selectedSection, setSelectedSection, count } = props;
  const { comments } = count;
  const isAuditlogEnabled = useFeatureEnabled('AUDIT_LOGS');
  const logScopeSelectorValue: ScopeSelectorValue = 'LOG';
  const items: { value: ScopeSelectorValue; label: string }[] = [
    { value: 'COMMENTS', label: `Comments (${comments})` },
    ...(isAuditlogEnabled ? [{ value: logScopeSelectorValue, label: `Log` }] : []),
  ];

  return (
    <SegmentedControl<ScopeSelectorValue>
      size="LARGE"
      active={selectedSection}
      onChange={(newValue) => {
        setSelectedSection(newValue);
      }}
      items={items}
    />
  );
}
