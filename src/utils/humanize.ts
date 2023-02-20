/*
  SOME_CONSTANT_NAME => Some Constant Name
 */
import _ from 'lodash';

export function humanizeConstant(name: string): string {
  return _.startCase(_.toLower(name.split('_').join(' ')));
}
