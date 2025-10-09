import { getEditDistancePercentage } from '@flagright/lib/utils';
import s from './style.module.less';
import { Option } from '.';
import { Comparable, key } from '@/utils/comparable';
import { notEmpty } from '@/utils/array';
import Tag from '@/components/library/Tag';
import CloseLineIcon from '@/components/ui/icons/Remix/system/close-line.react.svg';

export const SEPARATOR = ';';

export function parseSearchString<Value extends Comparable>(
  options: Option<Value>[],
  searchString: string,
  skipUnknown: boolean = false,
): Value[] {
  const items = searchString.split(SEPARATOR).map((x) => x.trim());

  return items
    .map((itemStr) => {
      const option = options.find((option) => filterOption(itemStr, option, true));
      if (option == null) {
        if (skipUnknown) {
          return null;
        }
        return itemStr as Value;
      }
      return option.value;
    })
    .filter(notEmpty);
}

// NOTE: We match the words in order to make the search result more relevant
// (e.g. "John Doe" should match "John Doe" and not "Doe John")
function matchesInOrder(
  list1: string[],
  list2: string[],
  predicate: (a: string, b: string) => boolean,
) {
  if (list2.length === 0) {
    return true;
  }
  let index = 0;
  for (let i = 0; i < list1.length; i++) {
    if (predicate(list1[i], list2[index])) {
      index++;
      if (index === list2.length) {
        return true;
      }
    }
  }
  return false;
}

const EDIT_DISTANCE_PERCENTAGE_THRESHOLD = 30;
export function filterOption(
  searchString: string,
  option?: Option<Comparable>,
  fullMatch: boolean = false,
): boolean {
  if (option == null) {
    return false;
  }
  const { value, label, labelText, alternativeLabels = [] } = option;
  const searchStringWords = searchString.toLocaleLowerCase().split(' ');
  const result = [value?.toString(), label?.toString(), labelText?.toString(), ...alternativeLabels]
    .filter(notEmpty)
    .map((optionSearchValue) => optionSearchValue?.toLocaleLowerCase())
    .some((optionSearchValue) => {
      if (fullMatch) {
        return optionSearchValue === searchString.toLocaleLowerCase();
      }
      const optionSearchWords = optionSearchValue.split(' ');
      return matchesInOrder(
        optionSearchWords,
        searchStringWords,
        (optionSearchWord, searchStringWord) =>
          optionSearchWord?.includes(searchStringWord) ||
          getEditDistancePercentage(optionSearchWord, searchStringWord) <=
            EDIT_DISTANCE_PERCENTAGE_THRESHOLD,
      );
    });
  return result;
}

/*
  Returns a node which will be used to render the option label.
 */
export function getOptionLabelNode(option: Option<Comparable>): string | React.ReactNode {
  return option.label || option.labelText || option.value;
}

export function DEFAULT_TAG_RENDERER<Value extends Comparable>(props: {
  option: Option<Value>;
  onRemove: () => void;
}) {
  const { option, onRemove } = props;
  return (
    <Tag
      key={key(option.value)}
      actions={[
        {
          icon: <CloseLineIcon className={s.tagRemoveIcon} />,
          key: 'remove',
          action: onRemove,
        },
      ]}
    >
      {option.label}
    </Tag>
  );
}
