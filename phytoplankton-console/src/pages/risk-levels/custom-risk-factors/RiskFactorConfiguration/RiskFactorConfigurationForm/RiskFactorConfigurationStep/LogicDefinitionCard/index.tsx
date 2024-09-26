import { useEffect, useMemo, useState } from 'react';
import { CURRENCIES_SELECT_OPTIONS } from '@flagright/lib/constants';
import { isEqual } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { RiskFactorConfigurationStepFormValues } from '..';
import s from './style.module.less';
import * as Card from '@/components/ui/Card';
import Button from '@/components/library/Button';
import { CurrencyCode, RiskFactorLogic, RiskLevel, RuleType } from '@/apis';
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
import DeleteBinLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import PencilLineIcon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import {
  getSelectedRiskLevel,
  getSelectedRiskScore,
} from '@/pages/risk-levels/custom-risk-factors/utils';

interface Props {
  ruleType: RuleType;
  entityVariablesFieldState: FieldState<RiskFactorConfigurationStepFormValues['entityVariables']>;
  aggVariablesFieldState: FieldState<RiskFactorConfigurationStepFormValues['aggregationVariables']>;
  riskLevelLogic: FieldState<RiskFactorConfigurationStepFormValues['riskLevelLogic']>;
  baseCurrencyFieldState: FieldState<RiskFactorConfigurationStepFormValues['baseCurrency']>;
}

export interface LevelLogic {
  logic: any;
  riskLevel?: RiskLevel;
  riskScore?: number;
  weight: number;
}

function convertToLevelLogic(logic: RiskFactorLogic | undefined): LevelLogic | undefined {
  if (!logic) {
    return undefined;
  }
  return {
    logic: logic.logic,
    riskLevel: logic.riskLevel,
    riskScore: logic.riskScore,
    weight: logic.weight,
  };
}

function convertToRiskFactorLogic(logic: LevelLogic): RiskFactorLogic | undefined {
  if (!logic.riskLevel || !logic.riskScore) {
    return undefined;
  }
  return {
    logic: logic.logic,
    riskScore: logic.riskScore,
    riskLevel: logic.riskLevel,
    weight: logic.weight,
  };
}

const isRiskLevelUnique = (
  riskLevel: RiskLevel | undefined,
  selectedLogicLevel: RiskLevel | undefined,
  riskLevelLogic: FieldState<RiskFactorConfigurationStepFormValues['riskLevelLogic']>,
): boolean => {
  if (!riskLevel) {
    return false;
  }
  return !Object.keys(riskLevelLogic.value ?? {})
    .filter((val) => val !== selectedLogicLevel)
    .includes(riskLevel);
};

export const LogicDefinitionCard = (props: Props) => {
  const {
    entityVariablesFieldState,
    aggVariablesFieldState,
    riskLevelLogic,
    baseCurrencyFieldState,
    ruleType,
  } = props;
  const [isOpen, setIsOpen] = useState(false);

  const settings = useSettings();
  const [selectedLogicLevel, setSelectedLogicLevel] = useState<RiskLevel | undefined>();
  const [currentRiskLevelAssignmentValues, setCurrentRiskLevelAssignmentValues] = useState<
    LevelLogic | undefined
  >(undefined);

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
    const riskConfigs = Object.entries(riskLevelLogic.value ?? {}).reduce(
      (acc, [level, config]) => {
        const varKeysInLogic = getAllEntityVariableKeys(config?.logic ?? {});
        const aggVarKeysInLogic = getAllAggVariableKeys(config?.logic ?? {});

        const hasEntityVariables = entityVariablesInUse.some((v) => varKeysInLogic.includes(v.key));
        const hasAggVariables = aggVarsInUse.some((v) => aggVarKeysInLogic.includes(v.key));

        if (hasEntityVariables || hasAggVariables) {
          acc[level] = config;
        }

        return acc;
      },
      {} as Record<RiskLevel, RiskFactorLogic>,
    );
    if (!isEqual(riskConfigs, riskLevelLogic.value)) {
      riskLevelLogic.onChange(riskConfigs);
    }
  }, [
    entityVariablesFieldState.value,
    riskLevelLogic.value,
    aggVariablesFieldState.value,
    riskLevelLogic,
  ]);
  useEffect(() => {
    if (hasTransactionAmountVariable && !baseCurrencyFieldState.value) {
      baseCurrencyFieldState.onChange(settings.defaultValues?.currency ?? 'USD');
    }
  }, [
    baseCurrencyFieldState,
    hasTransactionAmountVariable,
    settings.defaultValues?.currency,
    riskLevelLogic,
  ]);

  const riskClassificationQuery = useRiskClassificationScores();
  const riskClassificationValues = getOr(riskClassificationQuery, []);

  const resetModalState = () => {
    setIsOpen(false);
    setCurrentRiskLevelAssignmentValues(undefined);
    setSelectedLogicLevel(undefined);
  };

  const handleEdit = (riskLevel: RiskLevel) => {
    const logicToEdit = convertToLevelLogic(riskLevelLogic.value?.[riskLevel]);
    setSelectedLogicLevel(riskLevel);
    setCurrentRiskLevelAssignmentValues(logicToEdit);
    setIsOpen(true);
  };

  const handleDelete = (riskLevel: RiskLevel) => {
    const updatedLogic = { ...riskLevelLogic.value };
    delete updatedLogic[riskLevel];
    riskLevelLogic.onChange(updatedLogic);
  };

  const handleSave = () => {
    if (currentRiskLevelAssignmentValues) {
      const riskFactorLogic = convertToRiskFactorLogic(currentRiskLevelAssignmentValues);
      if (!riskFactorLogic) {
        return;
      }
      riskLevelLogic.onChange({
        ...riskLevelLogic.value,
        [riskFactorLogic.riskLevel]: riskFactorLogic,
      });
    }
    resetModalState();
  };

  const handleAddLogic = () => {
    setIsOpen(true);
    setSelectedLogicLevel(undefined);
    setCurrentRiskLevelAssignmentValues(undefined);
  };

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
              onClick={handleAddLogic}
              isDisabled={!hasVariables}
            >
              Add logic
            </Button>
          </div>
          <div className={s.parameters}>
            {Object.keys(riskLevelLogic?.value ?? {}).map((level, i) => {
              const name = humanizeAuto(level);
              return (
                <Tooltip key={i} title={`Configuration (${name})`}>
                  <div>
                    <Tag
                      key={level}
                      color="action"
                      actions={[
                        {
                          key: 'edit',
                          icon: <PencilLineIcon className={s.editVariableIcon} />,
                          action: () => handleEdit(level as RiskLevel),
                        },
                        {
                          key: 'delete',
                          icon: <DeleteBinLineIcon />,
                          action: () => handleDelete(level as RiskLevel),
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
        onCancel={resetModalState}
        onOk={handleSave}
        okText={'Save'}
        okProps={{
          isDisabled: ['logic', 'riskLevel', 'riskScore', 'weight'].some(
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
                  setCurrentRiskLevelAssignmentValues(
                    (prev) =>
                      ({
                        ...(prev ?? {}),
                        logic: jsonLogic,
                      } as LevelLogic),
                  );
                }}
              />
            }
            renderThen={
              <div className={s.root}>
                <div className={s.riskLevelInfo}>
                  <Label label={'Risk level'} required={true}>
                    <RiskLevelSwitch
                      disabledLevels={
                        Object.keys(riskLevelLogic.value ?? {}).filter(
                          (val) => val !== selectedLogicLevel,
                        ) as RiskLevel[]
                      }
                      value={currentRiskLevelAssignmentValues?.riskLevel}
                      onChange={(riskLevel) => {
                        if (riskLevel) {
                          setCurrentRiskLevelAssignmentValues(
                            (prevValues) =>
                              ({
                                ...prevValues,
                                riskLevel,
                                riskScore: getSelectedRiskScore(
                                  riskLevel,
                                  riskClassificationValues,
                                ),
                              } as LevelLogic),
                          );
                        }
                      }}
                    />
                  </Label>
                  <Label label={'Risk score'} required={true}>
                    <NumberInput
                      min={0}
                      max={100}
                      value={currentRiskLevelAssignmentValues?.riskScore}
                      onChange={(riskScore) => {
                        const riskLevel = getSelectedRiskLevel(riskScore, riskClassificationValues);
                        if (isRiskLevelUnique(riskLevel, selectedLogicLevel, riskLevelLogic)) {
                          setCurrentRiskLevelAssignmentValues(
                            (prevValues) =>
                              ({
                                ...prevValues,
                                riskScore,
                                riskLevel: riskLevel,
                              } as LevelLogic),
                          );
                        } else {
                          setCurrentRiskLevelAssignmentValues(
                            (prevValues) =>
                              ({
                                ...prevValues,
                                riskScore: undefined,
                                riskLevel: undefined,
                              } as LevelLogic),
                          );
                        }
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
                      } as LevelLogic);
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
