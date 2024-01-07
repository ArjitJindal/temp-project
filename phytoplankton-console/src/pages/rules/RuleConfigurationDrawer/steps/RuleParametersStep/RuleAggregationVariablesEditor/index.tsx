import React, { useCallback, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { getAggVarDefinition } from '../utils';
import s from './style.module.less';
import {
  FormRuleAggregationVariable,
  RuleAggregationVariableForm,
} from './RuleAggregationVariableForm';
import DeleteBinLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import PencilLineIcon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import { RuleAggregationVariable, RuleLogicConfig } from '@/apis';
import { RULE_LOGIC_CONFIG } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import { isSuccess } from '@/utils/asyncResource';
import { useApi } from '@/api';
import Tag from '@/components/library/Tag';
import Button from '@/components/library/Button';

interface RuleAggregationVariablesEditorProps {
  aggregationVariables: RuleAggregationVariable[] | undefined;
  onChange: (newAggregationVariables: RuleAggregationVariable[]) => void;
}

const RuleAggregationVariablesEditor: React.FC<RuleAggregationVariablesEditorProps> = ({
  aggregationVariables,
  onChange,
}) => {
  const api = useApi();
  const [editingVariable, setEditingVariable] = useState<FormRuleAggregationVariable | undefined>(
    undefined,
  );
  const isNewVariable = useMemo(
    () => aggregationVariables?.find((v) => v.key === editingVariable?.key) === undefined,
    [aggregationVariables, editingVariable],
  );
  const ruleLogicConfig = useQuery<RuleLogicConfig>(
    RULE_LOGIC_CONFIG(),
    (): Promise<RuleLogicConfig> => api.getRuleLogicConfig(),
  );
  const entityVariables = useMemo(() => {
    if (isSuccess(ruleLogicConfig.data)) {
      return ruleLogicConfig.data.value.variables ?? [];
    }
    return [];
  }, [ruleLogicConfig.data]);
  const handleDelete = useCallback(
    (varKey: string) => {
      onChange(aggregationVariables?.filter((v) => v.key !== varKey) ?? []);
    },
    [aggregationVariables, onChange],
  );
  const handleEdit = useCallback(
    (varKey: string) => {
      setEditingVariable(aggregationVariables?.find((v) => v.key === varKey));
    },
    [aggregationVariables],
  );
  const handleCancelEditVariable = useCallback(() => {
    setEditingVariable(undefined);
  }, []);
  const handleAddVariable = useCallback(() => {
    setEditingVariable({
      key: `agg:${uuid()}`,
      timeWindow: {
        start: { units: 1, granularity: 'day' },
        end: { units: 0, granularity: 'day' },
      },
    });
  }, []);
  const handleUpdateVariable = useCallback(
    (newAggregationVariable: RuleAggregationVariable) => {
      // Sanitize values
      newAggregationVariable.name = newAggregationVariable.name?.trim();

      const newAggregationVariables = [...(aggregationVariables ?? [])];
      const updatedAggVariableIndex = newAggregationVariables.findIndex(
        (v) => v.key === newAggregationVariable.key,
      );
      if (updatedAggVariableIndex >= 0) {
        newAggregationVariables?.splice(updatedAggVariableIndex, 1, newAggregationVariable);
      } else {
        newAggregationVariables.push(newAggregationVariable);
      }
      onChange(newAggregationVariables);
      handleCancelEditVariable();
    },
    [aggregationVariables, handleCancelEditVariable, onChange],
  );

  return (
    <Card.Root>
      <Card.Section>
        <div className={s.header}>
          <Label
            label="Variable definition"
            description="Add all the variables that are required"
          />

          {!editingVariable && <Button onClick={handleAddVariable}>Add variable</Button>}
        </div>
        {!editingVariable && aggregationVariables && aggregationVariables.length > 0 && (
          <div className={s.tagsContainer}>
            {aggregationVariables?.map((aggVar) => {
              const aggVarDefinition = getAggVarDefinition(aggVar, entityVariables);
              return (
                <Tag
                  key={aggVar.key}
                  kind="TAG_WITH_ACTIONS"
                  actions={[
                    {
                      key: 'edit',
                      icon: <PencilLineIcon />,
                      action: () => handleEdit(aggVar.key),
                    },
                    {
                      key: 'delete',
                      icon: <DeleteBinLineIcon />,
                      action: () => handleDelete(aggVar.key),
                    },
                  ]}
                >
                  {aggVar.name || aggVarDefinition.uiDefinition.label}
                </Tag>
              );
            })}
          </div>
        )}
      </Card.Section>
      {editingVariable && (
        <RuleAggregationVariableForm
          variable={editingVariable}
          isNew={isNewVariable}
          entityVariables={entityVariables}
          onUpdate={handleUpdateVariable}
          onCancel={handleCancelEditVariable}
        />
      )}
    </Card.Root>
  );
};

export default RuleAggregationVariablesEditor;
