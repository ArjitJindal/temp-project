import React, { useCallback, useMemo, useState } from 'react';
import { shortId } from '@flagright/lib/utils';
import { useLogicEntityVariablesList } from '../helpers';
import s from './style.module.less';
import { AggregationVariableForm } from './AggregationVariableForm';
import { EntityVariableForm, getNewEntityVariableKey } from './EntityVariableForm';
import { MlVariableForm } from './MlVariableForm';
import { FormRuleAggregationVariable } from './helpers';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import DeleteBinLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import PencilLineIcon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import EyeLineIcon from '@/components/ui/icons/Remix/system/eye-line.react.svg';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import {
  LogicAggregationVariable,
  LogicEntityVariableEntityEnum,
  LogicEntityVariableInUse,
  RuleMachineLearningVariable,
  RuleType,
} from '@/apis';
import { isLoading, isSuccess } from '@/utils/asyncResource';
import Tag from '@/components/library/Tag';
import Button from '@/components/library/Button';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { getAggVarDefinition } from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/RuleParametersStep/utils';
import Dropdown from '@/components/library/Dropdown';
import Tooltip from '@/components/library/Tooltip';
import { LHS_ONLY_SYMBOL, RHS_ONLY_SYMBOL } from '@/components/ui/LogicBuilder/helpers';
import { useAuth0User } from '@/utils/user-utils';

function getNewAggregationVariableKey() {
  return `agg:${shortId()}`;
}

function augmentAggregationVariables(
  aggregationVariables: LogicAggregationVariable[],
): LogicAggregationVariable[] {
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

interface VariableTagsProps {
  usedVariables?: string[];
  entityVariables?: LogicEntityVariableInUse[];
  aggregationVariables?: LogicAggregationVariable[];
  mlVariables?: RuleMachineLearningVariable[];
  entityVariableDefinitions: any[];
  readOnly?: boolean;
  onEdit?: (key: string, index?: number) => void;
  onDuplicateEntity?: (key: string, index: number) => void;
  onDuplicateAgg?: (key: string, index: number) => void;
  onDelete?: (key: string) => void;
}

export const VariableTags: React.FC<VariableTagsProps> = ({
  usedVariables,
  entityVariables,
  aggregationVariables,
  mlVariables,
  entityVariableDefinitions,
  readOnly,
  onEdit,
  onDuplicateEntity,
  onDuplicateAgg,
  onDelete,
}) => {
  const hasVariables = Boolean(
    entityVariables?.length || aggregationVariables?.length || mlVariables?.length,
  );

  if (!hasVariables) {
    return null;
  }

  return (
    <div className={s.tagsContainer}>
      {entityVariables?.map((entityVar, index) => {
        const entityVarDefinition = entityVariableDefinitions.find(
          (v) => v.key === entityVar.entityKey,
        );

        const name = entityVar.name || entityVarDefinition?.uiDefinition.label || 'Unknown';

        return (
          <Tag
            key={entityVar.key}
            color="action"
            actions={
              readOnly
                ? [
                    {
                      key: 'view',
                      icon: <EyeLineIcon className={s.editVariableIcon} />,
                      action: () => onEdit?.(entityVar.key, index),
                    },
                  ]
                : [
                    {
                      key: 'edit',
                      icon: <PencilLineIcon className={s.editVariableIcon} />,
                      action: () => onEdit?.(entityVar.key, index),
                    },
                    {
                      key: 'copy',
                      icon: <FileCopyLineIcon />,
                      action: () => onDuplicateEntity?.(entityVar.key, index),
                    },
                    {
                      key: 'delete',
                      icon: <DeleteBinLineIcon />,
                      action: () => onDelete?.(entityVar.key),
                      disabled:
                        usedVariables != null && usedVariables?.includes(entityVar.key)
                          ? 'The variable is currently in use within the rule. To proceed with deletion, please remove its usage first.'
                          : undefined,
                    },
                  ]
            }
          >
            {name}
          </Tag>
        );
      })}
      {aggregationVariables
        ?.filter((v) => !v.key.endsWith(RHS_ONLY_SYMBOL))
        .map((aggVar, index) => {
          const aggVarDefinition = getAggVarDefinition(aggVar, entityVariableDefinitions);
          const name = aggVar.name || aggVarDefinition.uiDefinition.label || 'Unknown';

          return (
            <Tag
              key={aggVar.key}
              actions={
                readOnly
                  ? [
                      {
                        key: 'view',
                        icon: <EyeLineIcon className={s.editVariableIcon} />,
                        action: () => onEdit?.(aggVar.key),
                      },
                    ]
                  : [
                      {
                        key: 'edit',
                        icon: <PencilLineIcon className={s.editVariableIcon} />,
                        action: () => onEdit?.(aggVar.key),
                      },
                      {
                        key: 'copy',
                        icon: <FileCopyLineIcon />,
                        action: () => onDuplicateAgg?.(aggVar.key, index),
                      },
                      {
                        key: 'delete',
                        icon: <DeleteBinLineIcon />,
                        action: () => onDelete?.(aggVar.key),
                        disabled:
                          usedVariables != null && usedVariables?.includes(aggVar.key)
                            ? 'The variable is currently in use within the rule. To proceed with deletion, please remove its usage first.'
                            : undefined,
                      },
                    ]
              }
            >
              {name}
            </Tag>
          );
        })}
      {mlVariables?.map((mlVar, index) => {
        const name = mlVar.name || 'Unknown';

        return (
          <Tooltip key={index} title={name}>
            <div>
              <Tag
                key={index}
                color="action"
                actions={
                  readOnly
                    ? [
                        {
                          key: 'view',
                          icon: <EyeLineIcon className={s.editVariableIcon} />,
                          action: () => onEdit?.(mlVar.key, index),
                        },
                      ]
                    : [
                        {
                          key: 'edit',
                          icon: <PencilLineIcon className={s.editVariableIcon} />,
                          action: () => onEdit?.(mlVar.key, index),
                        },
                        {
                          key: 'delete',
                          icon: <DeleteBinLineIcon />,
                          action: () => onDelete?.(mlVar.key),
                        },
                      ]
                }
              >
                {name}
              </Tag>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
};

type VariableType = 'entity' | 'aggregation' | 'ml';
type EditingAggVariable = { type: 'aggregation'; variable: FormRuleAggregationVariable };
type EditingEntityVariable = {
  type: 'entity';
  variable?: LogicEntityVariableInUse;
  index?: number;
};
type EditingMLVariable = { type: 'ml'; variable?: RuleMachineLearningVariable };

interface RuleAggregationVariablesEditorProps {
  usedVariables?: string[];
  ruleType: RuleType;
  readOnly?: boolean;
  entityVariables: LogicEntityVariableInUse[] | undefined;
  aggregationVariables: LogicAggregationVariable[] | undefined;
  mlVariables?: RuleMachineLearningVariable[];
  onChange: (value: {
    entityVariables?: LogicEntityVariableInUse[];
    aggregationVariables?: LogicAggregationVariable[];
    mlVariables?: RuleMachineLearningVariable[];
  }) => void;
  entity?: LogicEntityVariableEntityEnum;
}

export const VariableDefinitionCard: React.FC<RuleAggregationVariablesEditorProps> = ({
  usedVariables,
  ruleType,
  readOnly,
  entityVariables,
  aggregationVariables,
  mlVariables,
  onChange,
  entity,
}) => {
  const [editingVariable, setEditingVariable] = useState<
    EditingAggVariable | EditingEntityVariable | EditingMLVariable | undefined
  >(undefined);
  const settings = useSettings();
  const isNewVariable = useMemo(
    () =>
      [...(aggregationVariables ?? []), ...(entityVariables ?? []), ...(mlVariables ?? [])].find(
        (v) => v.key === editingVariable?.variable?.key,
      ) === undefined,
    [aggregationVariables, editingVariable?.variable?.key, entityVariables, mlVariables],
  );
  const variablesRes = useLogicEntityVariablesList(ruleType);
  const user = useAuth0User();
  const entityVariableDefinitions = useMemo(() => {
    if (isSuccess(variablesRes)) {
      return (variablesRes.value ?? []).filter(
        (v) =>
          (!v?.requiredFeatures?.length ||
            v.requiredFeatures.every((f) => settings.features?.includes(f))) &&
          (!v.tenantIds?.length || v.tenantIds?.includes(user?.tenantId)),
      );
    }
    return [];
  }, [variablesRes, settings.features, user.tenantId]);

  const handleDelete = useCallback(
    (varKey: string) => {
      onChange({
        entityVariables: entityVariables?.filter((v) => v.key !== varKey) ?? [],
        aggregationVariables: augmentAggregationVariables(
          aggregationVariables?.filter((v) => v.key !== varKey) ?? [],
        ),
        mlVariables: mlVariables?.filter((v) => v.key !== varKey) ?? [],
      });
    },
    [aggregationVariables, entityVariables, onChange, mlVariables],
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
      const mlVar = mlVariables?.find((v) => v.key === varKey);
      if (mlVar) {
        setEditingVariable({ type: 'ml', variable: mlVar });
      }
    },
    [aggregationVariables, entityVariables, mlVariables],
  );
  const handleDuplicateEntityVar = useCallback(
    (varKey: string, index: number) => {
      const entityVar = entityVariables?.find((v) => v.key === varKey);
      if (!entityVar) {
        return;
      }
      const newEntityVar = { ...entityVar, key: getNewEntityVariableKey() };
      const entityVarDefinition = entityVariableDefinitions.find(
        (v) => v.key === entityVar.entityKey,
      );
      newEntityVar.name = `${newEntityVar.name || entityVarDefinition?.uiDefinition.label} (copy)`;
      const newEntityVariables = [...(entityVariables ?? [])];
      newEntityVariables.splice(index + 1, 0, newEntityVar);
      onChange({ entityVariables: newEntityVariables });
    },
    [entityVariableDefinitions, entityVariables, onChange],
  );
  const handleDuplicateAggVar = useCallback(
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
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            baseCurrency: settings.defaultValues?.currency,
            timeWindow: {
              start: { units: 1, granularity: 'day' },
              end: { units: 0, granularity: 'now' },
            },
          },
        });
      } else if (type === 'entity') {
        setEditingVariable({ type: 'entity' });
      } else {
        setEditingVariable({ type: 'ml' });
      }
    },
    [settings.defaultValues?.currency],
  );
  const handleUpdateEntityVariable = useCallback(
    (newEntityVariable: LogicEntityVariableInUse) => {
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

  const handleUpdateMlVariable = useCallback(
    (newMlVariable: RuleMachineLearningVariable) => {
      const newMlVariables = [...(mlVariables ?? [])];
      if (editingVariable?.variable?.key) {
        const updatedMlVariableIndex = newMlVariables.findIndex(
          (v) => v.key === editingVariable.variable?.key,
        );
        if (updatedMlVariableIndex >= 0) {
          newMlVariables.splice(updatedMlVariableIndex, 1, newMlVariable);
        }
      } else {
        newMlVariables.push(newMlVariable);
      }
      onChange({ mlVariables: newMlVariables });
      handleCancelEditVariable();
    },
    [mlVariables, handleCancelEditVariable, onChange, editingVariable],
  );
  const handleUpdateAggVariable = useCallback(
    (newAggregationVariable: LogicAggregationVariable) => {
      // Sanitize values
      newAggregationVariable.name = newAggregationVariable.name?.trim();
      newAggregationVariable.includeCurrentEntity =
        newAggregationVariable.includeCurrentEntity ?? true;

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
  const hasMachineLearningFeature = useFeatureEnabled('MACHINE_LEARNING');

  return (
    <Card.Root>
      <Card.Section>
        <div className={s.header}>
          <Label
            label="Variable definition"
            description="Add all entity and aggregate variables that are required for the rule to check"
            required={true}
          />
          {!readOnly && (
            <Dropdown<VariableType>
              options={[
                { value: 'entity', label: 'Entity variable' },
                { value: 'aggregation', label: 'Aggregate variable' },
                ...(hasMachineLearningFeature && settings?.isMlEnabled
                  ? [{ value: 'ml' as VariableType, label: 'ML variable' }]
                  : []),
              ]}
              onSelect={(option) => handleAddVariable(option.value)}
              placement="bottomLeft"
            >
              {/* TODO: Update e2e test */}
              <Button testName="add-variable-v8" isLoading={isLoading(variablesRes)}>
                Add variable
              </Button>
            </Dropdown>
          )}
        </div>
        <VariableTags
          usedVariables={usedVariables}
          entityVariables={entityVariables}
          aggregationVariables={aggregationVariables}
          mlVariables={mlVariables}
          entityVariableDefinitions={entityVariableDefinitions}
          readOnly={readOnly}
          onEdit={handleEdit}
          onDuplicateEntity={handleDuplicateEntityVar}
          onDuplicateAgg={handleDuplicateAggVar}
          onDelete={handleDelete}
        />
      </Card.Section>
      {editingVariable?.type === 'entity' && entityVariableDefinitions.length > 0 && (
        <EntityVariableForm
          ruleType={ruleType}
          variable={editingVariable.variable}
          isNew={isNewVariable}
          entityVariables={entityVariableDefinitions.filter((v) =>
            ruleType === 'USER' && entity ? entity === v.entity || v.entity === 'USER' : true,
          )}
          entityVariablesInUse={entityVariables ?? []}
          readOnly={readOnly}
          onUpdate={handleUpdateEntityVariable}
          onCancel={handleCancelEditVariable}
          entity={entity}
        />
      )}
      {editingVariable?.type === 'aggregation' && entityVariableDefinitions.length > 0 && (
        <AggregationVariableForm
          ruleType={ruleType}
          variable={editingVariable.variable}
          isNew={isNewVariable}
          entityVariables={entityVariableDefinitions}
          readOnly={readOnly}
          onUpdate={handleUpdateAggVariable}
          onCancel={handleCancelEditVariable}
        />
      )}
      {editingVariable?.type === 'ml' && (
        <MlVariableForm
          variable={editingVariable.variable}
          isNew={isNewVariable}
          readOnly={readOnly}
          onUpdate={handleUpdateMlVariable}
          onCancel={handleCancelEditVariable}
        />
      )}
    </Card.Root>
  );
};

export default VariableDefinitionCard;
export { formatTimeWindow } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/helpers';
export { varLabelWithoutDirection } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/helpers';
