import SegmentedControl from '@/components/library/SegmentedControl';

type ScopeSelectorValue = 'CASE' | 'ALERT';

interface Props {
  selectedSection: string;
  setSelectedSection: (value: string) => void;
}

const ScopeSelector = (props: Props) => {
  const { selectedSection, setSelectedSection } = props;
  return (
    <SegmentedControl<ScopeSelectorValue>
      size="MEDIUM"
      active={selectedSection as ScopeSelectorValue}
      onChange={(newValue) => {
        setSelectedSection(newValue);
      }}
      items={[
        { value: 'CASE', label: `Cases` },
        { value: 'ALERT', label: `Alerts` },
      ]}
    />
  );
};

export default ScopeSelector;
