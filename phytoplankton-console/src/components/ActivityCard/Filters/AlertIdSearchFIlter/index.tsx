import TextInput from '@/components/library/TextInput';
import CaseIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import InputQuickFilter from '@/components/library/QuickFilter/subtypes/InputQuickFilter';

interface Props {
  initialState?: string;
  onConfirm: (newState: string | undefined) => void;
}

export default function AlertIdSearchFilter(props: Props) {
  const { initialState, onConfirm } = props;

  return (
    <InputQuickFilter<string>
      title={'Alert ID'}
      key={'alert-id-search'}
      icon={<CaseIcon />}
      value={initialState}
      onChange={onConfirm}
      debounce={true}
      inputComponent={TextInput}
    />
  );
}
