import React, { useCallback, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { useRuleLogicConfig } from '../helpers';
import s from './style.module.less';
import { AggregationVariableForm, FormRuleAggregationVariable } from './AggregationVariableForm';
import { EntityVariableForm } from './EntityVariableForm';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import DeleteBinLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import PencilLineIcon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import { RuleAggregationVariable, RuleEntityVariableInUse } from '@/apis';
import { isLoading, isSuccess } from '@/utils/asyncResource';
import Tag from '@/components/library/Tag';
import Button from '@/components/library/Button';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { getAggVarDefinition } from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/RuleParametersStep/utils';
import Dropdown from '@/components/library/Dropdown';
import Tooltip from '@/components/library/Tooltip';
import { LHS_ONLY_SYMBOL, RHS_ONLY_SYMBOL } from '@/components/ui/LogicBuilder/helpers';

function getNewAggregationVariableKey() {
  return `agg:${uuid()}`;
}

function augmentAggregationVariables(
  aggregationVariables: RuleAggregationVariable[],
): RuleAggregationVariable[] {
  return aggregationVariables.flatMap((v) => {
    if (v.aggregationFunc === 'UNIQUE_VALUES') {
      if (!v.key.endsWith(LHS_ONLY_SYMBOL) && !v.key.endsWith(RHS_ONLY_SYMBOL)) {
        return [
          {
            ...v,
            key: `${v.key}${LHS_ONLY_SYMBOL}`,
          },
          {
            ...v,
            key: `${v.key}${RHS_ONLY_SYMBOL}`,
          },
        ];
        // Variables with key ending with RHS_ONLY_SYMBOL are hidden from the user and the definition
        // is the same as the variable with the same key ending with LHS_ONLY_SYMBOL
      } else if (v.key.endsWith(RHS_ONLY_SYMBOL)) {
        const lhsVarKey = v.key.replace(RHS_ONLY_SYMBOL, LHS_ONLY_SYMBOL);
        const syncAggVariable = aggregationVariables.find((v) => v.key === lhsVarKey);
        if (syncAggVariable) {
          return [
            {
              ...syncAggVariable,
              key: v.key,
            },
          ];
        } else {
          return [];
        }
      }
    }
    return [v];
  });
}

type VariableType = 'entity' | 'aggregation';
type EditingAggVariable = { type: 'aggregation'; variable: FormRuleAggregationVariable };
type EditingEntityVariable = { type: 'entity'; variable?: RuleEntityVariableInUse; index?: number };

interface RuleAggregationVariablesEditorProps {
  entityVariables: RuleEntityVariableInUse[] | undefined;
  aggregationVariables: RuleAggregationVariable[] | undefined;
  onChange: (value: {
    entityVariables?: RuleEntityVariableInUse[];
    aggregationVariables?: RuleAggregationVariable[];
  }) => void;
}

const VariableDefinitionCard: React.FC<RuleAggregationVariablesEditorProps> = ({
  entityVariables,
  aggregationVariables,
  onChange,
}) => {
  const [editingVariable, setEditingVariable] = useState<
    EditingAggVariable | EditingEntityVariable | undefined
  >(undefined);
  const cardTitleInfo = useMemo(() => {
    if (!editingVariable) {
      return {
        title: 'Variable definition',
        description:
          'Add all entity and aggregate variables that are required for the rule to check',
      };
    }

    if (editingVariable?.type === 'entity') {
      return {
        title: 'Entity variable',
        description:
          'Entity variable is used to reference specific fields from an entity or instrument (e.g registration period, status, or type)',
      };
    } else if (editingVariable?.type === 'aggregation') {
      return {
        title: 'Aggregate variable',
        description:
          'An aggregate variable summarizes multiple values from a dataset using operations like sum, average, count, maximum, or minimum. ',
      };
    }
  }, [editingVariable]);
  const isNewVariable = useMemo(
    () =>
      [...(aggregationVariables ?? []), ...(entityVariables ?? [])].find(
        (v) => v.key === editingVariable?.variable?.key,
      ) === undefined,
    [aggregationVariables, editingVariable?.variable?.key, entityVariables],
  );
  const ruleLogicConfig = useRuleLogicConfig();
  const entityVariableDefinitions = useMemo(() => {
    if (isSuccess(ruleLogicConfig.data)) {
      return ruleLogicConfig.data.value.variables ?? [];
    }
    return [];
  }, [ruleLogicConfig.data]);
  const settings = useSettings();
  const handleDelete = useCallback(
    (varKey: string) => {
      onChange({
        entityVariables: entityVariables?.filter((v) => v.key !== varKey) ?? [],
        aggregationVariables: augmentAggregationVariables(
          aggregationVariables?.filter((v) => v.key !== varKey) ?? [],
        ),
      });
    },
    [aggregationVariables, entityVariables, onChange],
  );
  const handleEdit = useCallback(
    (varKey: string, index?: number) => {
      const entityVar = entityVariables?.find((v) => v.key === varKey);
      if (entityVar) {
        setEditingVariable({ type: 'entity', variable: entityVar, index });
        return;
      }
      const aggVar = aggregationVariables?.find((v) => v.key === varKey);
      if (aggVar) {
        setEditingVariable({ type: 'aggregation', variable: aggVar });
        return;
      }
    },
    [aggregationVariables, entityVariables],
  );
  const handleDuplicate = useCallback(
    (varKey: string, index: number) => {
      const aggVar = aggregationVariables?.find((v) => v.key === varKey);
      if (!aggVar) {
        return;
      }
      const newAggVar = { ...aggVar, key: getNewAggregationVariableKey() };
      const aggVarDefinition = getAggVarDefinition(newAggVar, entityVariableDefinitions);
      newAggVar.name = `${newAggVar.name || aggVarDefinition.uiDefinition.label} (copy)`;
      const newAggregationVariables = [...(aggregationVariables ?? [])];
      newAggregationVariables.splice(index + 1, 0, newAggVar);
      onChange({ aggregationVariables: augmentAggregationVariables(newAggregationVariables) });
    },
    [aggregationVariables, entityVariableDefinitions, onChange],
  );
  const handleCancelEditVariable = useCallback(() => {
    setEditingVariable(undefined);
  }, []);
  const handleAddVariable = useCallback(
    (type: VariableType) => {
      if (type === 'aggregation') {
        setEditingVariable({
          type: 'aggregation',
          variable: {
            key: getNewAggregationVariableKey(),
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER_OR_RECEIVER',
            transactionDirection: 'SENDING_RECEIVING',
            baseCurrency: settings.defaultValues?.currency,
            timeWindow: {
              start: { units: 1, granularity: 'day' },
              end: { units: 0, granularity: 'now' },
            },
          },
        });
      } else {
        setEditingVariable({ type: 'entity' });
      }
    },
    [settings.defaultValues?.currency],
  );
  const handleUpdateEntityVariable = useCallback(
    (newEntityVariable: RuleEntityVariableInUse) => {
      const entityVar = editingVariable as EditingEntityVariable;
      const newEntityVariables = [...(entityVariables ?? [])];
      if (entityVar?.index !== undefined) {
        newEntityVariables[entityVar.index] = newEntityVariable;
      } else {
        newEntityVariables.push(newEntityVariable);
      }
      onChange({ entityVariables: newEntityVariables });
      handleCancelEditVariable();
    },
    [editingVariable, entityVariables, handleCancelEditVariable, onChange],
  );
  const handleUpdateAggVariable = useCallback(
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
      onChange({ aggregationVariables: augmentAggregationVariables(newAggregationVariables) });
      handleCancelEditVariable();
    },
    [aggregationVariables, handleCancelEditVariable, onChange],
  );
  const hasVariables = Boolean(entityVariables?.length || aggregationVariables?.length);

  return (
    <Card.Root>
      <Card.Section>
        <div className={s.header}>
          <Label
            label={cardTitleInfo?.title}
            required={true}
            description={cardTitleInfo?.description}
          />
          {!editingVariable && (
            <Dropdown<VariableType>
              options={[
                { value: 'entity', label: 'Entity variable' },
                { value: 'aggregation', label: 'Aggregate variable' },
              ]}
              onSelect={(option) => handleAddVariable(option.value)}
              placement="bottomLeft"
            >
              {/* TODO: Update e2e test */}
              <Button testName="add-variable-v8" isLoading={isLoading(ruleLogicConfig.data)}>
                Add variable
              </Button>
            </Dropdown>
          )}
        </div>
        {!editingVariable && hasVariables && (
          <div className={s.tagsContainer}>
            {entityVariables?.map((entityVar, index) => {
              const entityVarDefinition = entityVariableDefinitions.find(
                (v) => v.key === entityVar.key,
              );

              const name = entityVar.name || entityVarDefinition?.uiDefinition.label || 'Unknown';

              return (
                <Tooltip key={entityVar.key} title={name}>
                  <div>
                    <Tag
                      key={entityVar.key}
                      color="action"
                      actions={[
                        {
                          key: 'edit',
                          icon: <PencilLineIcon />,
                          action: () => handleEdit(entityVar.key, index),
                        },
                        {
                          key: 'delete',
                          icon: <DeleteBinLineIcon />,
                          action: () => handleDelete(entityVar.key),
                        },
                      ]}
                    >
                      {name}
                    </Tag>
                  </div>
                </Tooltip>
              );
            })}
            {aggregationVariables
              ?.filter((v) => !v.key.endsWith(RHS_ONLY_SYMBOL))
              .map((aggVar, index) => {
                const aggVarDefinition = getAggVarDefinition(aggVar, entityVariableDefinitions);
                const name = aggVar.name || aggVarDefinition.uiDefinition.label || 'Unknown';

                return (
                  <Tooltip key={aggVar.key} title={name}>
                    <div className={s.tagsTooltipContainer}>
                      <Tag
                        key={aggVar.key}
                        actions={[
                          {
                            key: 'edit',
                            icon: <PencilLineIcon />,
                            action: () => handleEdit(aggVar.key),
                          },
                          {
                            key: 'copy',
                            icon: <FileCopyLineIcon />,
                            action: () => handleDuplicate(aggVar.key, index),
                          },
                          {
                            key: 'delete',
                            icon: <DeleteBinLineIcon />,
                            action: () => handleDelete(aggVar.key),
                          },
                        ]}
                      >
                        {name}
                      </Tag>
                    </div>
                  </Tooltip>
                );
              })}
          </div>
        )}
      </Card.Section>
      {editingVariable?.type === 'entity' && entityVariableDefinitions.length > 0 && (
        <EntityVariableForm
          variable={editingVariable.variable}
          isNew={isNewVariable}
          entityVariables={entityVariableDefinitions}
          entityVariablesInUse={entityVariables ?? []}
          onUpdate={handleUpdateEntityVariable}
          onCancel={handleCancelEditVariable}
        />
      )}
      {editingVariable?.type === 'aggregation' && entityVariableDefinitions.length > 0 && (
        <AggregationVariableForm
          variable={editingVariable.variable}
          isNew={isNewVariable}
          entityVariables={entityVariableDefinitions}
          onUpdate={handleUpdateAggVariable}
          onCancel={handleCancelEditVariable}
        />
      )}
    </Card.Root>
  );
};

export default VariableDefinitionCard;
