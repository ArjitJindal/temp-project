import pluralize from 'pluralize';
import { lowerCase } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import {
  LogicAggregationTimeWindow,
  LogicAggregationVariable,
  LogicAggregationVariableTimeWindow,
} from '@/apis';

export function varLabelWithoutNamespace(label: string): string {
  return label.replace(/^.+\s*\/\s*/, '');
}

export function formatTimeWindow(timeWindow: LogicAggregationTimeWindow): string {
  if (timeWindow.granularity === 'all_time') {
    return 'the beginning of time';
  }
  if (timeWindow.granularity === 'now' || timeWindow.units === 0) {
    return 'now';
  }
  return `${timeWindow.units} ${pluralize(
    lowerCase(humanizeAuto(timeWindow.granularity)),
    timeWindow.units,
  )} ago`;
}

export function varLabelWithoutDirection(label: string): string {
  return label.replace(/^(origin|destination)\s*/, '');
}

export type FormRuleAggregationVariable = Partial<LogicAggregationVariable> & {
  timeWindow: LogicAggregationVariableTimeWindow;
};
