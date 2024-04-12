import { lowerCase } from 'lodash';
import pluralize from 'pluralize';
import { FieldOrGroup, FieldSettings } from '@react-awesome-query-builder/ui';
import { RuleAggregationFunc, RuleAggregationVariable, RuleEntityVariable } from '@/apis';
import { humanizeAuto } from '@/utils/humanize';
import { RHS_ONLY_SYMBOL } from '@/components/ui/LogicBuilder/helpers';

// TODO (V8): Move this to backend
const AGG_FUNC_TO_TYPE: Record<RuleAggregationFunc, string> = {
  AVG: 'number',
  COUNT: 'number',
  SUM: 'number',
  UNIQUE_COUNT: 'number',
  UNIQUE_VALUES: 'multiselect',
};

export function getAggVarDefinition(
  aggVar: RuleAggregationVariable,
  entityVariables: RuleEntityVariable[],
): { key: string; uiDefinition: FieldOrGroup } {
  const entityVariable = entityVariables.find((v) => v.key === aggVar.aggregationFieldKey);
  const { start, end } = aggVar.timeWindow;
  const startLabel = `${start.units} ${pluralize(lowerCase(start.granularity), start.units)} ago`;
  const endLabel =
    end.units === 0 ? '' : `${end.units} ${pluralize(lowerCase(end.granularity), end.units)} ago`;
  const timeWindowLabel = `${startLabel}${endLabel ? ` - ${endLabel}` : ''}`;
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
