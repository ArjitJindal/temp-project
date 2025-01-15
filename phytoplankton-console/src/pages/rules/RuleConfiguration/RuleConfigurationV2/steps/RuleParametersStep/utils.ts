import { lowerCase } from 'lodash';
import pluralize from 'pluralize';
import { FieldOrGroup, FieldSettings } from '@react-awesome-query-builder/ui';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { LogicAggregationFunc, LogicAggregationVariable, LogicEntityVariable } from '@/apis';
import { RHS_ONLY_SYMBOL } from '@/components/ui/LogicBuilder/helpers';

// TODO (V8): Move this to backend
const AGG_FUNC_TO_TYPE: Record<LogicAggregationFunc, string> = {
  AVG: 'number',
  COUNT: 'number',
  SUM: 'number',
  UNIQUE_COUNT: 'number',
  UNIQUE_VALUES: 'multiselect',
  MIN: 'number',
  MAX: 'number',
  STDEV: 'number',
};

export function getAggVarDefinition(
  aggVar: LogicAggregationVariable,
  entityVariables: LogicEntityVariable[],
): { key: string; uiDefinition: FieldOrGroup } {
  const entityVariable = entityVariables.find((v) => v.key === aggVar.aggregationFieldKey);
  const { start, end } = aggVar.timeWindow;
  const startLabel =
    start.granularity === 'all_time'
      ? 'All time'
      : `${start.units} ${pluralize(lowerCase(start.granularity), start.units)} ago`;
  const endLabel =
    end.units === 0 || end.granularity === 'now'
      ? 'now'
      : `${end.units} ${pluralize(lowerCase(end.granularity), end.units)} ago`;
  const timeWindowLabel = `${startLabel} to ${endLabel}`;
  const entityVariableLabel =
    entityVariable &&
    (aggVar.aggregationFunc === 'COUNT'
      ? lowerCase(pluralize(entityVariable.entity ?? ''))
      : entityVariable?.uiDefinition?.label);
  const label = `${humanizeAuto(aggVar.aggregationFunc)} of ${
    entityVariableLabel ?? aggVar.aggregationFieldKey
  } (${timeWindowLabel})`;
  let type = AGG_FUNC_TO_TYPE[aggVar.aggregationFunc];
  let fieldSettings: FieldSettings | undefined = undefined;
  if (type === 'multiselect') {
    if (aggVar.key.endsWith(RHS_ONLY_SYMBOL)) {
      type = 'text';
    } else {
      fieldSettings = {
        ...entityVariable?.uiDefinition?.fieldSettings,
        allowCustomValues: true,
      };
    }
  }
  return {
    key: aggVar.key,
    uiDefinition: {
      label,
      type,
      valueSources: ['value', 'field', 'func'],
      fieldSettings,
    },
  };
}
