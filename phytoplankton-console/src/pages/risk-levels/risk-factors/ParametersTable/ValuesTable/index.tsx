import React, { useCallback, useEffect, useState } from 'react';
import { Button } from 'antd';
import { DeleteFilled } from '@ant-design/icons';
import { isEqual as equal } from 'lodash';
import { getRiskLevelFromScore, getRiskScoreFromLevel } from '@flagright/lib/utils';
import cn from 'clsx';
import {
  Entity,
  ParameterName,
  ParameterValues,
  RiskLevelTableItem,
  RiskValueContent,
} from '../types';
import {
  DEFAULT_RISK_VALUE,
  INPUT_RENDERERS,
  NEW_VALUE_INFOS,
  VALUE_RENDERERS,
  PARAMETER_VALUES_FORM_VALIDATIONS,
  validate,
} from '../consts';
import style from './style.module.less';
import { RiskLevel, RiskParameterValue, RiskScoreValueLevel, RiskScoreValueScore } from '@/apis';
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch';
import { AsyncResource, getOr, isLoading, useLastSuccessValue } from '@/utils/asyncResource';
import { DEFAULT_COUNTRY_RISK_VALUES } from '@/utils/defaultCountriesRiskLevel';
import { useHasPermissions } from '@/utils/user-utils';
import { P } from '@/components/ui/Typography';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { levelToAlias, useRiskClassificationScores } from '@/utils/risk-levels';
import { useApi } from '@/api';
import { SETTINGS } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import Alert from '@/components/library/Alert';
import Slider from '@/components/library/Slider';
import NumberInput from '@/components/library/NumberInput';
import { CY_LOADING_FLAG_CLASS } from '@/utils/cypress';

interface Props {
  item: RiskLevelTableItem;
  currentValuesRes: AsyncResource<ParameterValues>;
  onSave: (
    parameter: ParameterName,
    newValues: ParameterValues,
    entity: Entity,
    defaultRiskLevel: RiskScoreValueLevel | RiskScoreValueScore,
    weight: number,
  ) => void;
  currentDefaultValue: AsyncResource<RiskScoreValueLevel | RiskScoreValueScore>;
  currentWeight: AsyncResource<number>;
  canEditParameters?: boolean;
}

export default function ValuesTable(props: Props) {
  const {
    currentValuesRes,
    item,
    onSave,
    currentDefaultValue,
    currentWeight,
    canEditParameters = true,
  } = props;

  const { parameter, dataType, entity } = item;
  const lastValues = useLastSuccessValue(currentValuesRes, []);
  const lastDefaultRiskValue = useLastSuccessValue(currentDefaultValue, DEFAULT_RISK_VALUE);
  const riskClassificationQuery = useRiskClassificationScores();
  const riskClassificationValues = getOr(riskClassificationQuery, []);
  const lastWeight = useLastSuccessValue(currentWeight, 1);
  const [values, setValues] = useState(lastValues);
  const [defaultRiskValue, setDefaultRiskValue] = useState(lastDefaultRiskValue);
  const [weight, setWeight] = useState(lastWeight);
  const api = useApi();
  const queryData = useQuery(SETTINGS(), () => api.getTenantsSettings());
  const defaultCurrency = getOr(queryData.data, {}).defaultValues?.currency ?? 'USD';
  const hasWritePermissions =
    useHasPermissions(['risk-scoring:risk-factors:write']) && canEditParameters;

  useEffect(() => {
    setValues(lastValues);
  }, [lastValues]);

  useEffect(() => {
    setWeight(lastWeight);
  }, [lastWeight]);

  useEffect(() => {
    setDefaultRiskValue(lastDefaultRiskValue);
  }, [lastDefaultRiskValue]);
  const isEqual = equal(
    { values, defaultRiskValue, weight },
    { values: lastValues, defaultRiskValue: lastDefaultRiskValue, weight: lastWeight },
  );

  const loading = isLoading(currentValuesRes);

  const [newValue, setNewValue] = useState<RiskValueContent | null>(null);
  const [newRiskValue, setNewRiskValue] = useState<RiskScoreValueLevel | RiskScoreValueScore>();
  const [shouldShowNewValueInput, setShouldShowNewValueInput] = useState(true);
  const [onlyDeleteLast, setOnlyDeleteLast] = useState(false);
  const handleUpdateValues = useCallback((cb: (oldValues: ParameterValues) => ParameterValues) => {
    setValues(cb);
  }, []);

  const handleAdd = () => {
    if (newValue && newRiskValue != null) {
      handleUpdateValues((oldValues) => [
        ...oldValues,
        {
          parameterValue: {
            content: newValue,
          },
          riskValue: newRiskValue,
        },
      ]);
      let initialNewValue: RiskValueContent | null = null;
      if (dataType === 'RANGE') {
        if (newValue?.kind === 'RANGE') {
          initialNewValue = { kind: 'RANGE', start: newValue.end, end: 100 };
        }
      }
      setNewValue(initialNewValue);
      setNewRiskValue(undefined);
    }
  };

  const handleSave = () => {
    onSave(parameter, values, entity, defaultRiskValue, weight);
  };

  const handleCancel = () => {
    setValues(lastValues);
    setDefaultRiskValue(lastDefaultRiskValue);
    setWeight(lastWeight);
  };

  const dataTypeValidations = PARAMETER_VALUES_FORM_VALIDATIONS[dataType] ?? [];

  const newValueValidationMessage: string | null = validate(dataType, dataTypeValidations, {
    newValue: newValue,
    previousValues: values.map((x) => x.parameterValue.content),
  });

  const newValueInfoMessage = NEW_VALUE_INFOS.reduce<string | null>(
    (acc, information): string | null => {
      if (newValue == null || acc != null) return acc;
      return information({
        newValue: newValue,
        newRiskValue: newRiskValue ?? null,
        newParameterName: parameter,
        previousValues: values,
        defaultCurrency: defaultCurrency,
      });
    },
    null,
  );

  const handleSetDefaultValues = useCallback(() => {
    if (item.dataType === 'COUNTRY') {
      setValues(DEFAULT_COUNTRY_RISK_VALUES);
    }
  }, [setValues, item.dataType]);

  const handleClearValues = useCallback(() => {
    setValues([]);
  }, [setValues]);

  const handleRemoveValue = useCallback(
    (value: string) => {
      const newValues = values.map(({ parameterValue: { content }, riskValue }) => {
        if (content.kind !== 'MULTIPLE') return { parameterValue: { content }, riskValue };
        content.values = content.values.filter(({ content: val }) => val !== value);
        return { parameterValue: { content }, riskValue };
      });

      handleUpdateValues(() =>
        newValues.filter(({ parameterValue: { content } }) =>
          content.kind === 'MULTIPLE' ? content.values.length > 0 : true,
        ),
      );
    },
    [values, handleUpdateValues],
  );
  const configSetting = useSettings();
  const aliasForVeryHigh = configSetting?.riskLevelAlias
    ? levelToAlias('VERY_HIGH', configSetting?.riskLevelAlias)
    : 'VERY_HIGH';
  return (
    <div className={cn(style.root, loading && CY_LOADING_FLAG_CLASS)}>
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
              isDisabled: loading || !hasWritePermissions,
            }}
            isDisabled={loading || !hasWritePermissions}
          />
        </div>
        <div /> {/* Empty div to align with the rest of the table */}
        <div /> {/* Empty div to align with the rest of the table */}
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
            isDisabled={loading || !hasWritePermissions}
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
            isDisabled={loading || !hasWritePermissions}
          />
        </div>
        <div /> {/* Empty div to align with the rest of the table */}
        <div className={style.header}>Value</div>
        <div className={style.header}>Risk level</div>
        <div className={style.header}>Risk score (0-100)</div>
        <div className={style.header}>
          {item.dataType === 'COUNTRY' && (
            <Button onClick={() => handleSetDefaultValues()} size="small" type="primary" block>
              Load default
            </Button>
          )}
        </div>
        {values.map(({ parameterValue, riskValue }, index) => {
          const handleChangeRiskLevel = (newRiskLevel: RiskLevel | undefined) => {
            if (newRiskLevel != null) {
              handleUpdateValues((values) =>
                values.map((x) =>
                  x.parameterValue === parameterValue
                    ? {
                        ...x,
                        riskValue: {
                          type: 'RISK_LEVEL',
                          value: newRiskLevel,
                        },
                      }
                    : x,
                ),
              );
            }
          };

          const handleChangeRiskScore = (newRiskScore: number | undefined) => {
            if (newRiskScore != null) {
              handleUpdateValues((values) =>
                values.map((x) =>
                  x.parameterValue === parameterValue
                    ? {
                        ...x,
                        riskValue: {
                          type: 'RISK_SCORE',
                          value: newRiskScore,
                        },
                      }
                    : x,
                ),
              );
            }
          };

          const handleDeleteKey = () => {
            handleUpdateValues((values) =>
              values.filter((x) => x.parameterValue !== parameterValue),
            );
          };

          return (
            <React.Fragment key={index}>
              <div>
                {VALUE_RENDERERS[dataType]({
                  value: parameterValue.content,
                  onChange: (newValue: unknown) => {
                    handleUpdateValues((values: ParameterValues) => {
                      return values?.map((oldValue, i) => {
                        if (i !== index) {
                          return oldValue;
                        }
                        return {
                          ...oldValue,
                          parameterValue: {
                            content: newValue as RiskParameterValue['content'],
                          },
                        };
                      });
                    });
                  },
                  handleRemoveValue,
                })}
              </div>
              <RiskLevelSwitch
                isDisabled={loading || !hasWritePermissions}
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
                isDisabled={loading || !hasWritePermissions}
                min={0}
                max={100}
                step={0.01}
              />
              <Button
                data-cy="delete-risk-factor"
                className={style.deleteButton}
                type="text"
                disabled={
                  loading || (onlyDeleteLast && index !== values.length - 1) || !hasWritePermissions
                }
                onClick={handleDeleteKey}
              >
                <DeleteFilled />
              </Button>
            </React.Fragment>
          );
        })}
        <>
          <div>
            {INPUT_RENDERERS[dataType]({
              disabled: loading || !hasWritePermissions,
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
                isDisabled={loading || !hasWritePermissions}
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
                isDisabled={loading || !hasWritePermissions}
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
                data-cy="add-risk-factor"
                disabled={
                  loading ||
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
        </>
        <div className={style.alertBox}>
          {newValueInfoMessage != null && newValueValidationMessage == null && (
            <Alert children={newValueInfoMessage} type="info" />
          )}
          {newValueValidationMessage != null && (
            <Alert children={newValueValidationMessage} type="error" />
          )}
        </div>
      </div>
      <Alert
        type="info"
        children="Please note the risk level will automatically convert to risk score. You can also manually update the risk score and it will be considered in risk algorithm calculation."
      />
      <div className={style.footer}>
        <Button disabled={loading || isEqual || !hasWritePermissions} onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          data-cy="save-risk-factor"
          disabled={loading || !hasWritePermissions || isEqual || newValueValidationMessage != null}
          onClick={handleSave}
          type="primary"
        >
          Save
        </Button>
        <Button
          disabled={loading || values.length === 0 || !hasWritePermissions}
          onClick={handleClearValues}
        >
          Clear all
        </Button>
      </div>
    </div>
  );
}
