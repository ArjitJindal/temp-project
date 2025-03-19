import React, { useCallback, useState, useEffect } from 'react';
import { Button } from 'antd';
import { DeleteFilled } from '@ant-design/icons';
import { isEqual as equal } from 'lodash';
import { getRiskLevelFromScore, getRiskScoreFromLevel } from '@flagright/lib/utils';
import cn from 'clsx';
import style from './style.module.less';
import {
  Entity,
  ParameterName,
  ParameterValues,
  RiskLevelTableItem,
  RiskValueContent,
} from '@/pages/risk-levels/risk-factors/ParametersTable/types';
import {
  DEFAULT_RISK_VALUE,
  INPUT_RENDERERS,
  NEW_VALUE_INFOS,
  VALUE_RENDERERS,
  PARAMETER_VALUES_FORM_VALIDATIONS,
  validate,
} from '@/pages/risk-levels/risk-factors/ParametersTable/consts';
import {
  RiskLevel,
  RiskParameterValueLiteral,
  RiskParameterValueRange,
  RiskParameterValueMultiple,
  RiskParameterValueTimeRange,
  RiskParameterValueDayRange,
  RiskParameterValueAmountRange,
  RiskScoreValueLevel,
  RiskScoreValueScore,
} from '@/apis';
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch';
import { getOr } from '@/utils/asyncResource';
import {
  DEFAULT_COUNTRY_RISK_VALUES,
  DEFAULT_CPI_COUNTRY_RISK_VALUES,
} from '@/utils/defaultCountriesRiskLevel';
import { useHasPermissions } from '@/utils/user-utils';
import { P } from '@/components/ui/Typography';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { levelToAlias, useRiskClassificationScores } from '@/utils/risk-levels';
import Alert from '@/components/library/Alert';
import Slider from '@/components/library/Slider';
import NumberInput from '@/components/library/NumberInput';
import Dropdown from '@/components/library/Dropdown';

interface Props {
  parameter: RiskLevelTableItem;
  values: ParameterValues;
  setValues: (values: ParameterValues) => void;
  entity: Entity;
  defaultRiskValue: RiskScoreValueLevel | RiskScoreValueScore;
  weight: number;
  setDefaultRiskValue: (val: RiskScoreValueLevel | RiskScoreValueScore) => void;
  setWeight: (val: number) => void;
  onSave: (
    parameter: ParameterName,
    values: ParameterValues,
    entity: Entity,
    defaultRiskValue: RiskScoreValueLevel | RiskScoreValueScore,
    weight: number,
  ) => void;
  canEditParameters?: boolean;
  initialValues?: ParameterValues;
}

function ValuesTable(props: Props) {
  const {
    parameter,
    values,
    setValues,
    defaultRiskValue,
    weight,
    setDefaultRiskValue,
    setWeight,
    canEditParameters = true,
    initialValues,
  } = props;

  const riskClassificationQuery = useRiskClassificationScores();
  const riskClassificationValues = getOr(riskClassificationQuery, []);

  const configSetting = useSettings();
  const defaultCurrency = configSetting?.defaultValues?.currency ?? 'USD';
  const hasWritePermissions =
    useHasPermissions(['risk-scoring:risk-factors:write']) && canEditParameters;

  useEffect(() => {
    if ((!values || values.length === 0) && initialValues && initialValues.length > 0) {
      setValues(initialValues);
    }
  }, [initialValues, values, setValues]);

  const [newValue, setNewValue] = useState<RiskValueContent | null>(null);
  const [newRiskValue, setNewRiskValue] = useState<RiskScoreValueLevel | RiskScoreValueScore>();
  const [shouldShowNewValueInput, setShouldShowNewValueInput] = useState(true);
  const [onlyDeleteLast, setOnlyDeleteLast] = useState(false);

  const isEqual = equal(
    { values, defaultRiskValue, weight },
    { values: initialValues || [], defaultRiskValue, weight },
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
      if (parameter.dataType === 'RANGE') {
        if (newValue?.kind === 'RANGE') {
          initialNewValue = { kind: 'RANGE', start: newValue.end, end: 100 };
        }
      }
      setNewValue(initialNewValue);
      setNewRiskValue(undefined);
    }
  };

  const handleCancel = () => {
    if (initialValues) {
      setValues(initialValues);
    } else {
      setValues([]);
      setDefaultRiskValue(DEFAULT_RISK_VALUE);
      setWeight(1);
    }
  };

  const dataTypeValidations = PARAMETER_VALUES_FORM_VALIDATIONS[parameter.dataType] ?? [];
  const newValueValidationMessage: string | null = validate(
    parameter.dataType,
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
        newParameterName: parameter.parameter,
        previousValues: values,
        defaultCurrency: defaultCurrency,
      });
    },
    null,
  );

  const handleSetDefaultValues = useCallback(
    (valueType: string) => {
      if (parameter.dataType === 'COUNTRY') {
        if (valueType === 'FATF') {
          setValues(DEFAULT_COUNTRY_RISK_VALUES);
        } else if (valueType === 'CPI') {
          setValues(DEFAULT_CPI_COUNTRY_RISK_VALUES);
        }
      }
    },
    [setValues, parameter.dataType],
  );

  const handleClearValues = () => {
    setValues([]);
  };

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
    [values, setValues],
  );

  const aliasForVeryHigh = configSetting?.riskLevelAlias
    ? levelToAlias('VERY_HIGH', configSetting?.riskLevelAlias)
    : 'VERY_HIGH';

  return (
    <div className={cn(style.root)}>
      <div className={style.table}>
        <div className={style.topHeader}>
          <div className={style.header}>Weight</div>
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
            The system configuration designates the default value as '{aliasForVeryHigh}' when no
            specific risk level is allocated.
          </P>
        </div>
        <div className={style.risk}>
          <div className={style.header}>Risk level</div>
          <RiskLevelSwitch
            isDisabled={!hasWritePermissions}
            value={
              defaultRiskValue.type === 'RISK_LEVEL'
                ? defaultRiskValue.value
                : getRiskLevelFromScore(riskClassificationValues, defaultRiskValue.value)
            }
            onChange={(newRiskLevel) => {
              if (newRiskLevel != null) {
                setDefaultRiskValue({ type: 'RISK_LEVEL', value: newRiskLevel });
              }
            }}
          />
        </div>
        <div>
          <div className={style.header}>Risk score (0-100)</div>
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
        <div className={style.header}>Value</div>
        <div className={style.header}>Risk level</div>
        <div className={style.header}>Risk score (0-100)</div>
        <div className={style.header}>
          {parameter.dataType === 'COUNTRY' && (
            <Dropdown
              options={[
                { value: 'FATF', label: 'FATF list' },
                { value: 'CPI', label: 'Corruption Index list' },
              ]}
              arrow={'LINE'}
              onSelect={(option) => handleSetDefaultValues(option.value)}
            >
              <Button type="primary" size="small" block>
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
                {VALUE_RENDERERS[parameter.dataType]({
                  value: parameterValue.content,
                  onChange: (
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
                  },
                  handleRemoveValue,
                })}
              </div>
              <RiskLevelSwitch
                isDisabled={!hasWritePermissions}
                value={
                  riskValue.type === 'RISK_LEVEL'
                    ? riskValue.value
                    : getRiskLevelFromScore(riskClassificationValues, riskValue.value)
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
                type="text"
                disabled={(onlyDeleteLast && index !== values.length - 1) || !hasWritePermissions}
                onClick={handleDeleteKey}
              >
                <DeleteFilled />
              </Button>
            </div>
          );
        })}
        <div className={style.newItemRow}>
          <div>
            {INPUT_RENDERERS[parameter.dataType]({
              disabled: !hasWritePermissions,
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
                    ? getRiskLevelFromScore(riskClassificationValues, newRiskValue.value)
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
                disabled={
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
        <Button disabled={isEqual || !hasWritePermissions} onClick={handleCancel}>
          Cancel
        </Button>
        <Button disabled={values.length === 0 || !hasWritePermissions} onClick={handleClearValues}>
          Clear all
        </Button>
      </div>
    </div>
  );
}

export default ValuesTable;
