import React, { useCallback } from 'react';
import { isEqual } from 'lodash';
import { Settings } from '@react-awesome-query-builder/ui';
import { RuleLogicBuilder } from '../../RuleLogicBuilder';
import { FormRuleAggregationVariable } from '../helpers';
import { LogicEntityVariableEntityEnum, RuleType } from '@/apis';

// TODO: Move PropertyColumns to library
import { StatePair } from '@/utils/state';

interface Props<
  FormState extends {
    filtersLogic?: any;
  },
> {
  entityVariableTypes?: LogicEntityVariableEntityEnum[];
  formValuesState: StatePair<FormState>;
  ruleType: RuleType;
  readOnly?: boolean;
  settings?: Partial<Settings>;
}

export default function VariableFilters<
  FormState extends {
    filtersLogic?: any;
  },
>({ formValuesState, ruleType, readOnly, entityVariableTypes, settings }: Props<FormState>) {
  const [formValues, setFormValues] = formValuesState;

  const handleUpdateForm = useCallback(
    (newValues: Partial<FormRuleAggregationVariable>) => {
      setFormValues((prevValues) => ({ ...prevValues, ...newValues }));
    },
    [setFormValues],
  );

  if (readOnly && formValues.filtersLogic == null) {
    return <></>;
  }

  return (
    <RuleLogicBuilder
      ruleType={ruleType}
      entityVariableTypes={entityVariableTypes}
      configParams={{
        mode: readOnly ? 'VIEW' : 'EDIT',
      }}
      jsonLogic={formValues.filtersLogic}
      // NOTE: Only entity variables are allowed for aggregation variable filters
      aggregationVariables={[]}
      onChange={(jsonLogic) => {
        if (!isEqual(jsonLogic, formValues.filtersLogic)) {
          handleUpdateForm({ filtersLogic: jsonLogic });
        }
      }}
      settings={settings}
    />
  );
}
