import SegmentedControl from '@/components/library/SegmentedControl';

type RiskTypeSelectorValue = 'CRA' | 'KRS';

interface Props {
  selectedSection: string;
  setSelectedSection: (value: string) => void;
}

const RiskTypeSelector = (props: Props) => {
  const { selectedSection, setSelectedSection } = props;
  return (
    <SegmentedControl<RiskTypeSelectorValue>
      size="MEDIUM"
      active={selectedSection as RiskTypeSelectorValue}
      onChange={(newValue) => {
        setSelectedSection(newValue);
      }}
      items={[
        { value: 'CRA', label: `CRA` },
        { value: 'KRS', label: `KRS` },
      ]}
    />
  );
};

export default RiskTypeSelector;
