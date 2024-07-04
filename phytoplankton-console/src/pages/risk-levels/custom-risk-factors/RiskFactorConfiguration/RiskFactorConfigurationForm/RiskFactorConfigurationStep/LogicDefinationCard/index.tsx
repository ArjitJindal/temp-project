import { useCallback, useEffect, useMemo, useState } from 'react';
import { CURRENCIES_SELECT_OPTIONS } from '@flagright/lib/constants';
import { getRiskLevelFromScore, getRiskScoreFromLevel } from '@flagright/lib/utils';
import { isEqual } from 'lodash';
import { RiskFactorConfigurationStepFormValues } from '..';
import s from './style.module.less';
import * as Card from '@/components/ui/Card';
import Button from '@/components/library/Button';
import { CurrencyCode, RiskParameterLevelKeyValueV8, RuleType } from '@/apis';
import { FieldState } from '@/components/library/Form/utils/hooks';
import Label from '@/components/library/Label';
import Modal from '@/components/library/Modal';
import { getAllAggVariableKeys, getAllEntityVariableKeys } from '@/pages/rules/utils';
import { isTransactionAmountVariable } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/helpers';
import Select from '@/components/library/Select';
import IfThen from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/DefineLogicCard/IfThen';
import { RuleLogicBuilder } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/RuleLogicBuilder';
import { RuleLogic } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/types';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import NumberInput from '@/components/library/NumberInput';
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { getOr } from '@/utils/asyncResource';
import Slider from '@/components/library/Slider';
import Tooltip from '@/components/library/Tooltip';
import Tag from '@/components/library/Tag';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import DeleteBinLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import PencilLineIcon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import { humanizeAuto } from '@/utils/humanize';

interface Props {
  ruleType: RuleType;
  entityVariablesFieldState: FieldState<RiskFactorConfigurationStepFormValues['entityVariables']>;
  aggVariablesFieldState: FieldState<RiskFactorConfigurationStepFormValues['aggregationVariables']>;
  riskLevelAssignmentValues: FieldState<
    RiskFactorConfigurationStepFormValues['riskLevelAssignmentValues']
  >;
  baseCurrencyFieldState: FieldState<RiskFactorConfigurationStepFormValues['baseCurrency']>;
}

export const LogicDefinationCard = (props: Props) => {
  const {
    entityVariablesFieldState,
    aggVariablesFieldState,
    riskLevelAssignmentValues,
    baseCurrencyFieldState,
    ruleType,
  } = props;
  const [isOpen, setIsOpen] = useState(false);

  const settings = useSettings();
  const [selectedLogicIndex, setSelectedLogicIndex] = useState<number | undefined>();
  const [currentRiskLevelAssignmentValues, setCurrentRiskLevelAssignmentValues] = useState<
    RiskParameterLevelKeyValueV8 | undefined
  >(selectedLogicIndex != null ? riskLevelAssignmentValues.value?.[selectedLogicIndex] : undefined);

  const hasTransactionAmountVariable = useMemo(() => {
    const entityVariablesInUse = entityVariablesFieldState.value ?? [];
    const varKeysInLogic = getAllEntityVariableKeys(currentRiskLevelAssignmentValues?.logic ?? {});
    const entityVariableKeys = entityVariablesInUse
      .filter((v) => varKeysInLogic.includes(v.key))
      .map((v) => v.entityKey);
    return Boolean(entityVariableKeys.find(isTransactionAmountVariable));
  }, [entityVariablesFieldState.value, currentRiskLevelAssignmentValues?.logic]);

  const hasVariables = useMemo(() => {
    return Boolean(entityVariablesFieldState.value?.length || aggVariablesFieldState.value?.length);
  }, [aggVariablesFieldState.value?.length, entityVariablesFieldState.value?.length]);
  useEffect(() => {
    const entityVariablesInUse = entityVariablesFieldState.value ?? [];
    const aggVarsInUse = aggVariablesFieldState.value ?? [];
    const riskConfigs = riskLevelAssignmentValues.value ?? [];
    const filteredRiskConfigs = riskConfigs.filter((config) => {
      const varKeysInLogic = getAllEntityVariableKeys(config.logic ?? {});
      const aggVarKeysInLogic = getAllAggVariableKeys(config.logic ?? {});
      const entityVariableKeys = entityVariablesInUse
        .filter((v) => varKeysInLogic.includes(v.key))
        .map((v) => v.entityKey);
      const aggVariableKeys = aggVarsInUse
        .filter((v) => aggVarKeysInLogic.includes(v.key))
        .map((v) => v.key);
      return entityVariableKeys.length > 0 || aggVariableKeys.length > 0;
    });
    if (!isEqual(riskConfigs, filteredRiskConfigs)) {
      riskLevelAssignmentValues.onChange(filteredRiskConfigs);
    }
  }, [entityVariablesFieldState.value, riskLevelAssignmentValues, aggVariablesFieldState.value]);
  useEffect(() => {
    if (hasTransactionAmountVariable && !baseCurrencyFieldState.value) {
      baseCurrencyFieldState.onChange(settings.defaultValues?.currency ?? 'USD');
    }
  }, [baseCurrencyFieldState, hasTransactionAmountVariable, settings.defaultValues?.currency]);

  const riskClassificationQuery = useRiskClassificationScores();
  const riskClassificationValues = getOr(riskClassificationQuery, []);
  const getSelectedRiskLevel = useCallback(
    (x) => {
      if (!x) {
        return x;
      }
      if (x.type === 'RISK_LEVEL') {
        return x.value;
      }
      return getRiskLevelFromScore(riskClassificationValues, x.value);
    },
    [riskClassificationValues],
  );
  const getSelectedRiskScore = useCallback(
    (x) => {
      if (!x) {
        return x;
      }
      if (x.type === 'RISK_SCORE') {
        return x.value;
      }
      return getRiskScoreFromLevel(riskClassificationValues, x.value);
    },
    [riskClassificationValues],
  );

  const handleEdit = useCallback(
    (index: number) => {
      setSelectedLogicIndex(index);
      setCurrentRiskLevelAssignmentValues(riskLevelAssignmentValues.value?.[index]);
      setIsOpen(true);
    },
    [
      setCurrentRiskLevelAssignmentValues,
      riskLevelAssignmentValues.value,
      setSelectedLogicIndex,
      setIsOpen,
    ],
  );

  const handleDelete = useCallback(
    (index: number) => {
      riskLevelAssignmentValues.onChange(
        riskLevelAssignmentValues.value?.filter((_, i) => i !== index),
      );
    },
    [riskLevelAssignmentValues],
  );

  const handleDuplicateEntityVar = useCallback(
    (index: number) => {
      if (riskLevelAssignmentValues.value?.[index]) {
        riskLevelAssignmentValues.onChange([
          ...(riskLevelAssignmentValues.value ?? []),
          riskLevelAssignmentValues.value?.[index],
        ]);
      }
    },
    [riskLevelAssignmentValues],
  );

  const handleSave = useCallback(() => {
    if (currentRiskLevelAssignmentValues) {
      if (
        selectedLogicIndex != null &&
        selectedLogicIndex < (riskLevelAssignmentValues?.value?.length ?? 0)
      ) {
        riskLevelAssignmentValues.onChange(
          riskLevelAssignmentValues.value?.map((val, i) =>
            i === selectedLogicIndex ? currentRiskLevelAssignmentValues : val,
          ),
        );
      } else {
        riskLevelAssignmentValues.onChange([
          ...(riskLevelAssignmentValues.value ?? []),
          currentRiskLevelAssignmentValues,
        ]);
      }
    }
    setIsOpen(false);
    setCurrentRiskLevelAssignmentValues(undefined);
    setSelectedLogicIndex(undefined);
  }, [currentRiskLevelAssignmentValues, selectedLogicIndex, riskLevelAssignmentValues]);
  return (
    <div>
      <Card.Root>
        <Card.Section>
          <div className={s.header}>
            <Label
              label="Logic definition"
              description="Using the above defined variables configure a risk factor logic mapped to one or more risk levels"
              required={true}
            />
            <Button
              testName="add-variable-v8"
              isLoading={false}
              onClick={() => {
                setIsOpen(true);
                setSelectedLogicIndex(riskLevelAssignmentValues?.value?.length ?? 0);
              }}
              isDisabled={!hasVariables}
            >
              Add logic
            </Button>
          </div>
          <div className={s.parameters}>
            {riskLevelAssignmentValues?.value?.map((val, i) => {
              const name = humanizeAuto(getSelectedRiskLevel(val.riskValue));
              return (
                <Tooltip key={i} title={`Configuration (${name})`}>
                  <div>
                    <Tag
                      key={i}
                      color="action"
                      actions={[
                        {
                          key: 'edit',
                          icon: <PencilLineIcon className={s.editVariableIcon} />,
                          action: () => handleEdit(i),
                        },
                        {
                          key: 'copy',
                          icon: <FileCopyLineIcon />,
                          action: () => handleDuplicateEntityVar(i),
                        },
                        {
                          key: 'delete',
                          icon: <DeleteBinLineIcon />,
                          action: () => handleDelete(i),
                        },
                      ]}
                    >
                      Configuration ({name})
                    </Tag>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </Card.Section>
      </Card.Root>
      <Modal
        width="L"
        title="Logic definition"
        isOpen={isOpen}
        onCancel={() => {
          setIsOpen(false);
          setCurrentRiskLevelAssignmentValues(undefined);
        }}
        onOk={handleSave}
        okText={'Save'}
        okProps={{
          isDisabled: ['logic', 'riskValue', 'weight'].some(
            (x) => !currentRiskLevelAssignmentValues?.[x],
          ),
        }}
        subTitle="Using the above defined variables configure a risk factor logic mapped to one or more risk levels"
      >
        <div className={s.modal}>
          {hasTransactionAmountVariable && (
            <div style={{ maxWidth: 200 }}>
              <Label label="Base currency" required={{ value: true, showHint: true }}>
                <Select
                  value={baseCurrencyFieldState.value}
                  onChange={(baseCurrency) => {
                    if (baseCurrency) {
                      baseCurrencyFieldState.onChange(baseCurrency as CurrencyCode);
                    }
                  }}
                  placeholder="Select base currency"
                  mode="SINGLE"
                  options={CURRENCIES_SELECT_OPTIONS}
                />
              </Label>
            </div>
          )}
          <IfThen
            renderIf={
              <RuleLogicBuilder
                ruleType={ruleType}
                entityVariableTypes={[
                  'TRANSACTION',
                  'TRANSACTION_EVENT',
                  'CONSUMER_USER',
                  'BUSINESS_USER',
                  'USER',
                ]}
                entityVariablesInUse={entityVariablesFieldState.value ?? []}
                jsonLogic={currentRiskLevelAssignmentValues?.logic}
                aggregationVariables={aggVariablesFieldState.value ?? []}
                onChange={(jsonLogic: RuleLogic | undefined) => {
                  setCurrentRiskLevelAssignmentValues({
                    ...(currentRiskLevelAssignmentValues ?? {}),
                    logic: jsonLogic,
                  } as RiskParameterLevelKeyValueV8);
                }}
              />
            }
            renderThen={
              <div className={s.root}>
                <div className={s.riskLevelInfo}>
                  <Label label={'Risk level'} required={true}>
                    <RiskLevelSwitch
                      value={getSelectedRiskLevel(currentRiskLevelAssignmentValues?.riskValue)}
                      onChange={(riskLevel) => {
                        if (riskLevel) {
                          setCurrentRiskLevelAssignmentValues({
                            ...(currentRiskLevelAssignmentValues ?? {}),
                            riskValue: {
                              type: 'RISK_LEVEL',
                              value: riskLevel,
                            },
                          } as RiskParameterLevelKeyValueV8);
                        }
                      }}
                    />
                  </Label>
                  <Label label={'Risk score'} required={true}>
                    <NumberInput
                      min={0}
                      max={100}
                      value={getSelectedRiskScore(currentRiskLevelAssignmentValues?.riskValue)}
                      onChange={(x) => {
                        setCurrentRiskLevelAssignmentValues({
                          ...(currentRiskLevelAssignmentValues ?? {}),
                          riskValue: {
                            type: 'RISK_SCORE',
                            value: x,
                          },
                        } as RiskParameterLevelKeyValueV8);
                      }}
                    />
                  </Label>
                </div>
                <Label label="Risk weight (0 to 1)" required={true}>
                  <Slider
                    value={currentRiskLevelAssignmentValues?.weight}
                    onChange={(val) => {
                      setCurrentRiskLevelAssignmentValues({
                        ...(currentRiskLevelAssignmentValues ?? {}),
                        weight: val,
                      } as RiskParameterLevelKeyValueV8);
                    }}
                    mode="SINGLE"
                    min={0.01}
                    max={1}
                    step={0.01}
                    textInput={{ min: 0.01, max: 1, step: 0.01 }}
                  />
                </Label>
              </div>
            }
          />
        </div>
      </Modal>
    </div>
  );
};
