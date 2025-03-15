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
  const logScopeSelectorValue: ScopeSelectorValue = 'LOG';
  const items: { value: ScopeSelectorValue; label: string }[] = [
    { value: 'COMMENTS', label: `Comments (${comments})` },
    { value: logScopeSelectorValue, label: 'Log' },
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
