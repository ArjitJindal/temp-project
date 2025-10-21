import { Resource } from '@flagright/lib/utils';
import s from './index.module.less';
import Button from '@/components/library/Button';
import TextInput from '@/components/library/TextInput';
import SearchIcon from '@/components/ui/icons/Remix/system/search-line.react.svg';
interface Props {
  value?: string;
  onChange: (newValue: string | undefined) => void;
  isSearchDisbled?: boolean;
  searchId: string | null | undefined;
  searchFunction: () => void;
  requiredResources?: Resource[];
}
export function ScreeningSearchBar(props: Props) {
  const { value, onChange, isSearchDisbled, searchId, searchFunction, requiredResources } = props;
  const searchButtonText = searchId == null ? 'Search' : 'New search';
  return (
    <div className={s.root}>
      <TextInput
        icon={<SearchIcon />}
        placeholder="Search term"
        onChange={onChange}
        value={value}
        isDisabled={searchId != null}
      />
      <Button
        className={s.searchButton}
        isDisabled={isSearchDisbled && !searchId}
        requiredResources={requiredResources}
        onClick={searchFunction}
      >
        {searchButtonText}
      </Button>
    </div>
  );
}
