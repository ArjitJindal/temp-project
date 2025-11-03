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
import { useRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import NumberInput from '@/components/library/NumberInput';
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import Slider from '@/components/library/Slider';
import Tooltip from '@/components/library/Tooltip';
import Tag from '@/components/library/Tag';
import DeleteBinLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import PencilLineIcon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import { getSelectedRiskLevel, getSelectedRiskScore } from '@/pages/risk-levels/risk-factors/utils';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import EyeLineIcon from '@/components/ui/icons/Remix/system/eye-line.react.svg';
import Checkbox from '@/components/library/Checkbox';
import { P } from '@/components/ui/Typography';
import { WarningIcon } from '@/components/library/Form/InputField';
import { CHANGED_FIELD_MESSAGE } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/helpers';

interface Props {
  ruleType: RuleType;
  readOnly?: boolean;
  hasChanges?: boolean;
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
  overrideScore?: boolean;
  excludeFactor?: boolean;
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
    overrideScore: logic.overrideScore,
    excludeFactor: logic.excludeFactor,
  };
}

function convertToRiskFactorLogic(logic: LevelLogic): RiskFactorLogic | undefined {
  if (!logic.riskLevel || logic.riskScore == null) {
    return undefined;
  }
  return {
    logic: logic.logic,
    riskScore: logic.riskScore,
    riskLevel: logic.riskLevel,
    weight: logic.weight,
    overrideScore: logic.overrideScore,
    excludeFactor: logic.excludeFactor,
  };
}

export const LogicDefinitionCard = (props: Props) => {
  const {
    entityVariablesFieldState,
    aggVariablesFieldState,
    riskLevelLogic,
    baseCurrencyFieldState,
    ruleType,
    readOnly = false,
    hasChanges = false,
  } = props;
  const [isOpen, setIsOpen] = useState(false);

  const settings = useSettings();
  const [selectedLogicIndex, setSelectedLogicIndex] = useState<number | undefined>();
  const [currentRiskLevelAssignmentValues, setCurrentRiskLevelAssignmentValues] = useState<
    LevelLogic | undefined
  >(selectedLogicIndex != null ? riskLevelLogic.value?.[selectedLogicIndex] : undefined);
  const riskLevelLabel = useRiskLevelLabel;

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
    const riskConfigs = riskLevelLogic.value ?? [];
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
      riskLevelLogic.onChange(filteredRiskConfigs);
    }
  }, [entityVariablesFieldState.value, riskLevelLogic, aggVariablesFieldState.value]);
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

  const riskClassificationValues = useRiskClassificationScores();

  const resetModalState = () => {
    setIsOpen(false);
    setCurrentRiskLevelAssignmentValues(undefined);
    setSelectedLogicIndex(undefined);
  };

  const handleEdit = (index: number) => {
    const logicToEdit = convertToLevelLogic(riskLevelLogic.value?.[index]);
    setSelectedLogicIndex(index);
    setCurrentRiskLevelAssignmentValues(logicToEdit);
    setIsOpen(true);
  };

  const handleDelete = (index: number) => {
    riskLevelLogic.onChange(riskLevelLogic.value?.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (currentRiskLevelAssignmentValues) {
      const logicToSave = convertToRiskFactorLogic(currentRiskLevelAssignmentValues);
      if (
        selectedLogicIndex != null &&
        selectedLogicIndex < (riskLevelLogic?.value?.length ?? 0) &&
        logicToSave
      ) {
        riskLevelLogic.onChange(
          riskLevelLogic.value?.map((val, i) => (i === selectedLogicIndex ? logicToSave : val)),
        );
      } else if (logicToSave) {
        riskLevelLogic.onChange([...(riskLevelLogic.value ?? []), logicToSave]);
      }
    }
    setIsOpen(false);
    setCurrentRiskLevelAssignmentValues(undefined);
    setSelectedLogicIndex(undefined);
  };

  const handleAddLogic = () => {
    setIsOpen(true);
    setSelectedLogicIndex(riskLevelLogic?.value?.length ?? 0);
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
              iconLeft={
                hasChanges && (
                  <Tooltip title={CHANGED_FIELD_MESSAGE}>
                    {({ ref }) => <WarningIcon rootRef={ref} />}
                  </Tooltip>
                )
              }
            />
            {!readOnly && (
              <Button
                testName="add-variable-v8"
                isLoading={false}
                onClick={handleAddLogic}
                isDisabled={!hasVariables}
              >
                Add logic
              </Button>
            )}
          </div>
          <div className={s.parameters}>
            {(riskLevelLogic?.value ?? []).map((val, i) => {
              const name = humanizeAuto(val.riskLevel);
              return (
                <Tooltip key={i} title={`Configuration (${name})`}>
                  <div>
                    <Tag
                      key={i}
                      color="action"
                      actions={
                        readOnly
                          ? [
                              {
                                key: 'view',
                                icon: <EyeLineIcon className={s.editVariableIcon} />,
                                action: () => handleEdit(i),
                              },
                            ]
                          : [
                              {
                                key: 'edit',
                                icon: <PencilLineIcon className={s.editVariableIcon} />,
                                action: () => handleEdit(i),
                              },
                              {
                                key: 'delete',
                                icon: <DeleteBinLineIcon />,
                                action: () => handleDelete(i),
                              },
                            ]
                      }
                    >
                      Configuration ({riskLevelLabel(val.riskLevel as RiskLevel)})
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
        hideOk={readOnly}
        okProps={{
          isDisabled: ['logic', 'riskLevel', 'riskScore', 'weight'].some((x) =>
            x === 'riskScore'
              ? currentRiskLevelAssignmentValues?.[x] == null
              : !currentRiskLevelAssignmentValues?.[x],
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
                  options={[
                    ...CURRENCIES_SELECT_OPTIONS,
                    { value: 'ORIGINAL_CURRENCY', label: 'Original currency' },
                  ]}
                  isDisabled={readOnly}
                />
              </Label>
            </div>
          )}
          <IfThen
            renderIf={
              <RuleLogicBuilder
                ruleType={ruleType}
                configParams={{
                  mode: readOnly ? 'VIEW' : 'EDIT',
                }}
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
                      isDisabled={readOnly}
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
                      isDisabled={readOnly}
                      onChange={(riskScore) => {
                        const riskLevel = getSelectedRiskLevel(riskScore, riskClassificationValues);
                        setCurrentRiskLevelAssignmentValues(
                          (prevValues) =>
                            ({
                              ...prevValues,
                              riskScore,
                              riskLevel: riskLevel,
                            } as LevelLogic),
                        );
                      }}
                    />
                  </Label>
                </div>
                <Label label="Risk weight (0 to 1)" required={true}>
                  <Slider
                    isDisabled={readOnly}
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
                {ruleType !== 'TRANSACTION' && (
                  <Label
                    label={
                      <div className={s.override}>
                        <P fontWeight="semibold" variant="m">
                          Override risk score{' '}
                        </P>
                        <Tooltip
                          title={`Overrides KRS and CRA when triggered. Multiple override risk factors use weighted averages to determine the final risk score`}
                        >
                          <InformationLineIcon className={s.icon} />
                        </Tooltip>
                      </div>
                    }
                    position="RIGHT"
                  >
                    <Checkbox
                      isDisabled={readOnly}
                      onChange={(val) => {
                        setCurrentRiskLevelAssignmentValues({
                          ...(currentRiskLevelAssignmentValues ?? {}),
                          overrideScore: val,
                        } as LevelLogic);
                      }}
                      value={currentRiskLevelAssignmentValues?.overrideScore ?? false}
                    />
                  </Label>
                )}
                {currentRiskLevelAssignmentValues?.riskScore === 0 && (
                  <Label
                    label={'Exclude this risk factor from risk score calculation'}
                    position="RIGHT"
                  >
                    <Checkbox
                      isDisabled={readOnly}
                      onChange={(val) => {
                        setCurrentRiskLevelAssignmentValues({
                          ...(currentRiskLevelAssignmentValues ?? {}),
                          excludeFactor: val,
                        } as LevelLogic);
                      }}
                      value={currentRiskLevelAssignmentValues?.excludeFactor ?? false}
                    />
                  </Label>
                )}
              </div>
            }
          />
        </div>
      </Modal>
    </div>
  );
};
