import { Option } from '.';
import { Comparable } from '@/utils/comparable';
import { notEmpty } from '@/utils/array';

export const SEPARATOR = ',';

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

export function filterOption(
  searchString: string,
  option?: Option<Comparable>,
  fullMatch: boolean = false,
): boolean {
  if (option == null) {
    return false;
  }
  const { value, label, alternativeLabels = [] } = option;
  const result = [value?.toString(), label?.toString(), ...alternativeLabels]
    .filter(notEmpty)
    .map((x) => x?.toLocaleLowerCase())
    .some((x) => {
      if (fullMatch) {
        return x === searchString.toLocaleLowerCase();
      }
      return x.includes(searchString.toLocaleLowerCase());
    });
  return result;
}
