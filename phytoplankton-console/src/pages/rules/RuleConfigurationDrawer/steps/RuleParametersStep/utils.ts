import { lowerCase } from 'lodash';
import pluralize from 'pluralize';
import { RuleAggregationFunc, RuleAggregationVariable, RuleEntityVariable } from '@/apis';
import { humanizeAuto } from '@/utils/humanize';

const AGG_FUNC_TO_TYPE: Record<RuleAggregationFunc, string> = {
  AVG: 'number',
  COUNT: 'number',
  SUM: 'number',
};

export function getAggVarDefinition(
  aggVar: RuleAggregationVariable,
  entityVariables: RuleEntityVariable[],
) {
  const entityVariable = entityVariables.find((v) => v.key === aggVar.aggregationFieldKey);
  const { start, end } = aggVar.timeWindow;
  const startLabel = `${start.units} ${pluralize(lowerCase(start.granularity), start.units)} ago`;
  const endLabel =
    end.units === 0 ? '' : `${end.units} ${pluralize(lowerCase(end.granularity), end.units)} ago`;
  const timeWindowLabel = `${startLabel}${endLabel ? ` - ${endLabel}` : ''}`;
  const entityVariableLabel =
    entityVariable &&
    (aggVar.aggregationFunc === 'COUNT'
      ? lowerCase(pluralize(entityVariable.entity!))
      : entityVariable.uiDefinition?.label);
  const label = `${humanizeAuto(aggVar.aggregationFunc)} of ${
    entityVariableLabel ?? aggVar.aggregationFieldKey
  } (${timeWindowLabel})`;
  return {
    key: aggVar.key,
    uiDefinition: {
      label,
      type: AGG_FUNC_TO_TYPE[aggVar.aggregationFunc],
      valueSources: ['value', 'field', 'func'],
    },
  };
}
