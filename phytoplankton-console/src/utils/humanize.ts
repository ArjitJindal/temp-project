import _ from 'lodash';

/*
  SOME_CONSTANT_NAME => Some Constant Name
 */
export function humanizeConstant(name: string): string {
  return _.startCase(_.toLower(name.split('_').join(' ')));
}

/*
  bank_smart_iban => Bank smart iban
 */
export function humanizeSnakeCase(name: string): string {
  return _.capitalize(_.toLower(name.split('_').join(' ')));
}

/*
  BankSmartIBAN => Bank Smart IBAN
 */
export function humanizeCamelCase(name: string): string {
  return name
    .replace(/([A-Z])([A-Z])([a-z])/g, '$1 $2$3')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/( [A-Z])([a-z])/g, (v, g1, g2) => g1.toLowerCase() + g2)
    .replace(/^[a-z]/, (v) => v.toUpperCase());
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
