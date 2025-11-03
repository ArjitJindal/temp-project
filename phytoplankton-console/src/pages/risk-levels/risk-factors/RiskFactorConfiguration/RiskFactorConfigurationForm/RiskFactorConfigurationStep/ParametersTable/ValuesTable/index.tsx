import { useCallback, useEffect, useState } from 'react';
import { DeleteFilled } from '@ant-design/icons';
import { isEqual as equal } from 'lodash';
import { getRiskLevelFromScore, getRiskScoreFromLevel } from '@flagright/lib/utils';
import cn from 'clsx';
import {
  INPUT_RENDERERS,
  NEW_VALUE_INFOS,
  PARAMETER_VALUES_FORM_VALIDATIONS,
  validate,
  VALUE_RENDERERS,
} from '../const';
import { RiskValueContent } from '../types';
import style from './style.module.less';
import {
  RiskFactor,
  RiskLevel,
  RiskParameterLevelKeyValue,
  RiskParameterValueAmountRange,
  RiskParameterValueDayRange,
  RiskParameterValueLiteral,
  RiskParameterValueMultiple,
  RiskParameterValueRange,
  RiskParameterValueTimeRange,
  RiskScoreValueLevel,
  RiskScoreValueScore,
} from '@/apis';
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch';
import {
  DEFAULT_COUNTRY_RISK_VALUES,
  DEFAULT_CPI_COUNTRY_RISK_VALUES,
} from '@/utils/defaultCountriesRiskLevel';
import { useHasResources } from '@/utils/user-utils';
import { P } from '@/components/ui/Typography';
import {
  getLastActiveRiskLevel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { levelToAlias, useRiskClassificationScores } from '@/utils/risk-levels';
import Alert from '@/components/library/Alert';
import Slider from '@/components/library/Slider';
import NumberInput from '@/components/library/NumberInput';
import Dropdown from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import { useBulkRerunUsersStatus } from '@/utils/batch-rerun-users';
import { DiffPath } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/diff';
import { CHANGED_FIELD_MESSAGE } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/helpers';
import { WarningIcon } from '@/components/library/Form/InputField';
import Tooltip from '@/components/library/Tooltip';

interface Props {
  changedFields?: DiffPath[];
  entity: RiskFactor;
  onSave: (updatedEntity: RiskFactor) => void;
  onCancel?: () => void;
  canEditParameters?: boolean;
}

function ValuesTable(props: Props) {
  const { entity, onSave, onCancel, canEditParameters = true, changedFields = [] } = props;

  const riskClassificationValues = useRiskClassificationScores();

  const configSetting = useSettings();
  const defaultCurrency = configSetting?.defaultValues?.currency ?? 'USD';
  const hasWritePermissions =
    useHasResources(['write:::risk-scoring/risk-factors/*']) && canEditParameters;

  const [values, setValues] = useState<RiskParameterLevelKeyValue[]>(
    entity.riskLevelAssignmentValues || [],
  );
  const [defaultRiskValue, setDefaultRiskValue] = useState<
    RiskScoreValueLevel | RiskScoreValueScore
  >(() => {
    if (entity.defaultRiskScore != null) {
      return { type: 'RISK_SCORE', value: entity.defaultRiskScore };
    }
    return { type: 'RISK_LEVEL', value: entity.defaultRiskLevel || 'LOW' };
  });
  const [weight, setWeight] = useState<number>(entity.defaultWeight || 1);
  const [newValue, setNewValue] = useState<RiskValueContent | null>(null);
  const [newRiskValue, setNewRiskValue] = useState<RiskScoreValueLevel | RiskScoreValueScore>();
  const [shouldShowNewValueInput, setShouldShowNewValueInput] = useState(true);
  const [onlyDeleteLast, setOnlyDeleteLast] = useState(false);
  const riskScoringRerun = useBulkRerunUsersStatus();
  const safeEntity = entity as Required<
    Pick<
      RiskFactor,
      | 'dataType'
      | 'parameter'
      | 'riskLevelAssignmentValues'
      | 'defaultRiskLevel'
      | 'defaultRiskScore'
      | 'defaultWeight'
    >
  >;

  useEffect(() => {
    setValues(entity.riskLevelAssignmentValues || []);
    setDefaultRiskValue(
      entity.defaultRiskScore != null
        ? { type: 'RISK_SCORE', value: entity.defaultRiskScore }
        : { type: 'RISK_LEVEL', value: entity.defaultRiskLevel || 'LOW' },
    );
    setWeight(entity.defaultWeight || 1);
  }, [entity]);

  const handleSave = useCallback(() => {
    const updatedEntity = {
      ...entity,
      riskLevelAssignmentValues: values,
      defaultRiskLevel:
        defaultRiskValue.type === 'RISK_LEVEL'
          ? defaultRiskValue.value
          : getRiskLevelFromScore(
              riskClassificationValues,
              defaultRiskValue.value,
              configSetting?.riskLevelAlias ?? [],
            ),
      defaultRiskScore:
        defaultRiskValue.type === 'RISK_SCORE'
          ? defaultRiskValue.value
          : getRiskScoreFromLevel(riskClassificationValues, defaultRiskValue.value),
      defaultWeight: weight,
    };
    onSave(updatedEntity);
  }, [
    entity,
    values,
    defaultRiskValue,
    weight,
    onSave,
    riskClassificationValues,
    configSetting?.riskLevelAlias,
  ]);

  const handleCancel = useCallback(() => {
    setValues(entity.riskLevelAssignmentValues || []);
    setDefaultRiskValue(
      entity.defaultRiskScore != null
        ? { type: 'RISK_SCORE', value: entity.defaultRiskScore }
        : { type: 'RISK_LEVEL', value: entity.defaultRiskLevel || 'LOW' },
    );
    setWeight(entity.defaultWeight || 1);
    setNewValue(null);
    setNewRiskValue(undefined);
    setShouldShowNewValueInput(true);
    setOnlyDeleteLast(false);
    if (onCancel) {
      onCancel();
    }
  }, [entity, onCancel]);

  const handleRemoveValue = useCallback(
    (value: string) => {
      const newVals = values.map(({ parameterValue, riskValue }) => {
        if (parameterValue.content.kind !== 'MULTIPLE') {
          return { parameterValue, riskValue };
        }
        parameterValue.content.values = parameterValue.content.values.filter(
          ({ content: val }: any) => val !== value,
        );
        return { parameterValue, riskValue };
      });
      setValues(
        newVals.filter(({ parameterValue }) =>
          parameterValue.content.kind === 'MULTIPLE'
            ? parameterValue.content.values.length > 0
            : true,
        ),
      );
    },
    [values],
  );

  const handleSetDefaultValues = useCallback(
    (valueType: string) => {
      if (safeEntity.dataType === 'COUNTRY') {
        if (valueType === 'FATF') {
          setValues(DEFAULT_COUNTRY_RISK_VALUES);
        } else if (valueType === 'CPI') {
          setValues(DEFAULT_CPI_COUNTRY_RISK_VALUES);
        }
      }
    },
    [safeEntity.dataType],
  );

  if (!entity.dataType || !entity.parameter) {
    return null;
  }

  const isEqual = equal(
    { values, defaultRiskValue, weight },
    {
      values: safeEntity.riskLevelAssignmentValues || [],
      defaultRiskValue:
        safeEntity.defaultRiskScore != null
          ? { type: 'RISK_SCORE', value: safeEntity.defaultRiskScore }
          : { type: 'RISK_LEVEL', value: safeEntity.defaultRiskLevel || 'LOW' },
      weight: safeEntity.defaultWeight || 1,
    },
  );

  const handleAdd = () => {
    if (newValue && newRiskValue != null) {
      const updatedValues = [
        ...values,
        {
          parameterValue: { content: newValue },
          riskValue: newRiskValue,
        },
      ];
      setValues(updatedValues);
      let initialNewValue: RiskValueContent | null = null;
      if (safeEntity.dataType === 'RANGE') {
        if (newValue?.kind === 'RANGE') {
          initialNewValue = { kind: 'RANGE', start: newValue.end, end: 100 };
        }
      }
      setNewValue(initialNewValue);
      setNewRiskValue(undefined);
    }
  };

  const handleClearValues = () => {
    setValues([]);
  };

  const LastActiveRiskLevel = getLastActiveRiskLevel(configSetting);
  const LastActiveRiskLevelAlias = configSetting?.riskLevelAlias
    ? levelToAlias(LastActiveRiskLevel, configSetting?.riskLevelAlias)
    : LastActiveRiskLevel;

  const dataTypeValidations = PARAMETER_VALUES_FORM_VALIDATIONS[safeEntity.dataType] ?? [];
  const newValueValidationMessage: string | null = validate(
    safeEntity.dataType,
    dataTypeValidations,
    {
      newValue: newValue,
      previousValues: values.map((x) => x.parameterValue.content),
    },
  );

  const newValueInfoMessage = NEW_VALUE_INFOS.reduce<string | null>(
    (acc, information): string | null => {
      if (newValue == null || acc != null) {
        return acc;
      }
      return information({
        newValue: newValue,
        newRiskValue: newRiskValue ?? null,
        newParameterName: safeEntity.parameter,
        previousValues: values,
        defaultCurrency: defaultCurrency,
      });
    },
    null,
  );

  return (
    <div className={cn(style.root)}>
      <div className={style.table}>
        <div className={style.topHeader}>
          <div className={style.header}>
            {changedFields.some(([x]) => x === 'defaultWeight') && (
              <Tooltip title={CHANGED_FIELD_MESSAGE}>
                {({ ref }) => <WarningIcon rootRef={ref} />}
              </Tooltip>
            )}
            Weight
          </div>
          <P grey variant="m" fontWeight="normal" className={style.description}>
            Weights range from 0 (no impact) to 1 (maximum impact) and determine the risk factor's
            influence on the overall risk score. If a weight is not assigned, the system defaults it
            to 1.
          </P>
        </div>
        <div className={style.weight}>
          <Slider
            mode="SINGLE"
            min={0.01}
            max={1}
            step={0.01}
            value={weight}
            onChange={(value) => {
              if (value != null) {
                setWeight(value);
              }
            }}
            marks={{ 0: '0', 1: '1' }}
            textInput={{
              min: 0.01,
              max: 1,
              step: 0.01,
              htmlAttrs: { style: { width: '3rem', textAlign: 'center' } },
              isDisabled: !hasWritePermissions,
            }}
            isDisabled={!hasWritePermissions}
          />
        </div>
        <div className={style.topHeader}>
          <div className={style.header}>Default risk level</div>
          <P grey variant="m" fontWeight="normal" className={style.description}>
            Any value lacking an assigned risk level will be categorized under default risk level.
            The system configuration designates the default value as '{LastActiveRiskLevelAlias}'
            when no specific risk level is allocated.
          </P>
        </div>
        <div className={style.risk}>
          <div className={style.header}>
            {changedFields.some(([x]) => x === 'defaultRiskLevel') && (
              <Tooltip title={CHANGED_FIELD_MESSAGE}>
                {({ ref }) => <WarningIcon rootRef={ref} />}
              </Tooltip>
            )}
            Risk level
          </div>
          <RiskLevelSwitch
            isDisabled={!hasWritePermissions}
            value={
              defaultRiskValue.type === 'RISK_LEVEL'
                ? defaultRiskValue.value
                : getRiskLevelFromScore(
                    riskClassificationValues,
                    defaultRiskValue.value,
                    configSetting?.riskLevelAlias ?? [],
                  )
            }
            onChange={(newRiskLevel) => {
              if (newRiskLevel != null) {
                setDefaultRiskValue({ type: 'RISK_LEVEL', value: newRiskLevel });
              }
            }}
          />
        </div>
        <div>
          <div className={style.header}>
            {changedFields.some(([x]) => x === 'defaultRiskScore') && (
              <Tooltip title={CHANGED_FIELD_MESSAGE}>
                {({ ref }) => <WarningIcon rootRef={ref} />}
              </Tooltip>
            )}
            Risk score (0-100)
          </div>
          <NumberInput
            onChange={(value) => {
              if (value != null) {
                setDefaultRiskValue({ type: 'RISK_SCORE', value });
              }
            }}
            value={
              defaultRiskValue.type === 'RISK_SCORE'
                ? defaultRiskValue.value
                : getRiskScoreFromLevel(riskClassificationValues, defaultRiskValue.value)
            }
            min={0}
            max={100}
            step={0.01}
            isDisabled={!hasWritePermissions}
          />
        </div>
        <div />
        <div className={style.header}>
          {changedFields.some(([x]) => x === 'riskLevelAssignmentValues') && (
            <Tooltip title={CHANGED_FIELD_MESSAGE}>
              {({ ref }) => <WarningIcon rootRef={ref} />}
            </Tooltip>
          )}
          Value
        </div>
        <div className={style.header}>Risk level</div>
        <div className={style.header}>Risk score (0-100)</div>
        <div className={style.header}>
          {safeEntity.dataType === 'COUNTRY' && (
            <Dropdown
              options={[
                { value: 'FATF', label: 'FATF list' },
                { value: 'CPI', label: 'Corruption Index list' },
              ]}
              arrow={'LINE'}
              onSelect={(option) => handleSetDefaultValues(option.value)}
            >
              <Button type="PRIMARY" size="SMALL" style={{ width: 'max-content' }}>
                Load default lists
              </Button>
            </Dropdown>
          )}
        </div>
        {values.map(({ parameterValue, riskValue }, index) => {
          const handleChangeRiskLevel = (newRiskLevel: RiskLevel | undefined) => {
            if (newRiskLevel != null) {
              setValues(
                values.map((x, i) =>
                  i === index
                    ? { ...x, riskValue: { type: 'RISK_LEVEL', value: newRiskLevel } }
                    : x,
                ),
              );
            }
          };

          const handleChangeRiskScore = (newRiskScore: number | undefined) => {
            if (newRiskScore != null) {
              setValues(
                values.map((x, i) =>
                  i === index
                    ? { ...x, riskValue: { type: 'RISK_SCORE', value: newRiskScore } }
                    : x,
                ),
              );
            }
          };

          const handleDeleteKey = () => {
            setValues(values.filter((_, i) => i !== index));
          };

          return (
            <div className={style.row} key={index}>
              <div>
                {VALUE_RENDERERS[safeEntity.dataType]({
                  value: parameterValue.content,
                  onChange: hasWritePermissions
                    ? (
                        newValue?:
                          | RiskParameterValueLiteral
                          | RiskParameterValueRange
                          | RiskParameterValueMultiple
                          | RiskParameterValueTimeRange
                          | RiskParameterValueDayRange
                          | RiskParameterValueAmountRange,
                      ) => {
                        if (newValue) {
                          setValues(
                            values.map((oldValue, i) =>
                              i !== index
                                ? oldValue
                                : { ...oldValue, parameterValue: { content: newValue } },
                            ),
                          );
                        }
                      }
                    : undefined,
                  handleRemoveValue: hasWritePermissions ? handleRemoveValue : undefined,
                })}
              </div>
              <RiskLevelSwitch
                isDisabled={!hasWritePermissions}
                value={
                  riskValue.type === 'RISK_LEVEL'
                    ? riskValue.value
                    : getRiskLevelFromScore(
                        riskClassificationValues,
                        riskValue.value,
                        configSetting?.riskLevelAlias ?? [],
                      )
                }
                onChange={handleChangeRiskLevel}
              />
              <NumberInput
                value={
                  riskValue.type === 'RISK_SCORE'
                    ? riskValue.value
                    : getRiskScoreFromLevel(riskClassificationValues, riskValue.value)
                }
                onChange={handleChangeRiskScore}
                isDisabled={!hasWritePermissions}
                min={0}
                max={100}
                step={0.01}
              />
              <Button
                className={style.deleteButton}
                type="TEXT"
                isDisabled={(onlyDeleteLast && index !== values.length - 1) || !hasWritePermissions}
                onClick={handleDeleteKey}
              >
                <DeleteFilled />
              </Button>
            </div>
          );
        })}
        <div className={style.newItemRow}>
          <div>
            {INPUT_RENDERERS[safeEntity.dataType]({
              isDisabled: !hasWritePermissions,
              value: newValue,
              existedValues: values.map((x) => x.parameterValue.content),
              onChange: setNewValue,
              setShouldShowNewValueInput,
              shouldShowNewValueInput,
              setOnlyDeleteLast,
            })}
          </div>
          {shouldShowNewValueInput && (
            <>
              <RiskLevelSwitch
                isDisabled={!hasWritePermissions}
                value={
                  newRiskValue?.type === 'RISK_LEVEL'
                    ? newRiskValue.value
                    : newRiskValue?.value != null
                    ? getRiskLevelFromScore(
                        riskClassificationValues,
                        newRiskValue.value,
                        configSetting?.riskLevelAlias ?? [],
                      )
                    : undefined
                }
                onChange={(newRiskLevel) => {
                  if (newRiskLevel != null) {
                    setNewRiskValue({ type: 'RISK_LEVEL', value: newRiskLevel });
                  }
                }}
              />
              <NumberInput
                isDisabled={!hasWritePermissions}
                value={
                  newRiskValue?.type === 'RISK_SCORE'
                    ? newRiskValue.value
                    : newRiskValue?.value != null
                    ? getRiskScoreFromLevel(riskClassificationValues, newRiskValue.value)
                    : undefined
                }
                onChange={(value) => {
                  if (value != null) {
                    setNewRiskValue({ type: 'RISK_SCORE', value });
                  }
                }}
                min={0}
                max={100}
                step={0.01}
              />
              <Button
                isDisabled={
                  !newValue ||
                  newRiskValue == null ||
                  newValueValidationMessage != null ||
                  !hasWritePermissions
                }
                onClick={handleAdd}
              >
                Add
              </Button>
            </>
          )}
        </div>
        <div className={style.alertBox}>
          {newValueInfoMessage != null && newValueValidationMessage == null && (
            <Alert children={newValueInfoMessage} type="INFO" />
          )}
          {newValueValidationMessage != null && (
            <Alert children={newValueValidationMessage} type="ERROR" />
          )}
        </div>
      </div>
      <Alert
        type="INFO"
        children="Please note the risk level will automatically convert to risk score. You can also manually update the risk score and it will be considered in risk algorithm calculation."
      />
      <div className={style.footer}>
        <Button
          type="SECONDARY"
          isDisabled={isEqual || !hasWritePermissions}
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button
          isDisabled={isEqual || !hasWritePermissions || newValueValidationMessage != null}
          onClick={handleSave}
          type="PRIMARY"
          testName="save-risk-factor"
          isLoading={riskScoringRerun.data.isAnyJobRunning}
        >
          Save
        </Button>
        <Button
          type="SECONDARY"
          isDisabled={values.length === 0 || !hasWritePermissions}
          onClick={handleClearValues}
        >
          Clear all
        </Button>
      </div>
    </div>
  );
}

export default ValuesTable;
