import SegmentedControl, { Item } from '@/components/library/SegmentedControl';

type ScopeSelectorValue = 'CASE' | 'ALERT' | 'PAYMENT';

interface Props {
  selectedSection: string;
  setSelectedSection: (value: string) => void;
  showPaymentApproval?: boolean;
}

const ScopeSelector = (props: Props) => {
  const { selectedSection, setSelectedSection } = props;
  const items: Item<ScopeSelectorValue>[] = [
    { value: 'CASE', label: `Cases` },
    { value: 'ALERT', label: `Alerts` },
  ];
  if (props.showPaymentApproval) {
    items.push({ value: 'PAYMENT', label: `Payment approval` });
  }
  return (
    <SegmentedControl<ScopeSelectorValue>
      size="MEDIUM"
      active={selectedSection as ScopeSelectorValue}
      onChange={(newValue) => {
        setSelectedSection(newValue);
      }}
      items={items}
    />
  );
};

export default ScopeSelector;
