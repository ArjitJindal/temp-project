/*
  SOME_CONSTANT_NAME => Some Constant Name
 */
import _ from 'lodash';

export function humanizeConstant(name: string): string {
  return _.startCase(_.toLower(name.split('_').join(' ')));
}

export function humanizeSnakeCase(name: string): string {
  return _.capitalize(_.toLower(name.split('_').join(' ')));
}

export function humanizeStrings(items: string[]): string {
  return items.reduce((acc, x, i) => {
    if (acc === '') {
      return x;
    }
    const isLastItem = i === items.length - 1;
    return acc + (isLastItem ? ' and ' : ', ') + x;
  }, '');
}
