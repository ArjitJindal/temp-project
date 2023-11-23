import React, { useCallback, useEffect, useState } from 'react';
import { Button } from 'antd';
import { DeleteFilled } from '@ant-design/icons';
import { isEqual as equal } from 'lodash';
import {
  DataType,
  Entity,
  ParameterName,
  ParameterValues,
  RiskLevelTableItem,
  RiskValueContent,
} from '../types';
import {
  DEFAULT_RISK_LEVEL,
  INPUT_RENDERERS,
  NEW_VALUE_INFOS,
  NEW_VALUE_VALIDATIONS,
  VALUE_RENDERERS,
} from '../consts';
import style from './style.module.less';
import { RiskLevel } from '@/apis';
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch';
import { AsyncResource, getOr, isLoading, useLastSuccessValue } from '@/utils/asyncResource';
import { DEFAULT_COUNTRY_RISK_VALUES } from '@/utils/defaultCountriesRiskLevel';
import { useHasPermissions } from '@/utils/user-utils';
import { P } from '@/components/ui/Typography';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { levelToAlias } from '@/utils/risk-levels';
import { useApi } from '@/api';
import { SETTINGS } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import Alert from '@/components/library/Alert';

interface Props {
  item: RiskLevelTableItem;
  currentValuesRes: AsyncResource<ParameterValues>;
  onSave: (
    parameter: ParameterName,
    newValues: ParameterValues,
    entity: Entity,
    defaultRiskLevel: RiskLevel,
  ) => void;
  currentDefaultRiskLevel: AsyncResource<RiskLevel>;
}

const labelsExist: { [key in DataType]?: { input: boolean; value: boolean } } = {
  DAY_RANGE: { input: true, value: true },
  TIME_RANGE: { input: true, value: false },
  AMOUNT_RANGE: { input: true, value: true },
};

const labelExistsStyle = (dataType: DataType, type: 'input' | 'value'): React.CSSProperties => {
  if (labelsExist[dataType]?.[type]) {
    return { marginTop: '1.8rem' };
  }
  return {};
};

export default function ValuesTable(props: Props) {
  const { currentValuesRes, item, onSave, currentDefaultRiskLevel } = props;
  const { parameter, dataType, entity } = item;
  const lastValues = useLastSuccessValue(currentValuesRes, []);
  const lastDefaultRiskLevel = useLastSuccessValue(currentDefaultRiskLevel, DEFAULT_RISK_LEVEL);
  const [values, setValues] = useState(lastValues);
  const [defaultRiskLevel, setDefaultRiskLevel] = useState(lastDefaultRiskLevel);
  const api = useApi();
  const queryData = useQuery(SETTINGS(), () => api.getTenantsSettings());
  const defaultCurrency = getOr(queryData.data, {}).defaultValues?.currency ?? 'USD';
  const hasWritePermissions = useHasPermissions(['risk-scoring:risk-factors:write']);

  useEffect(() => {
    setValues(lastValues);
  }, [lastValues]);

  const isEqual = equal(
    { values, defaultRiskLevel },
    { values: lastValues, defaultRiskLevel: lastDefaultRiskLevel },
  );

  const loading = isLoading(currentValuesRes);

  const [newValue, setNewValue] = useState<RiskValueContent | null>(null);
  const [newRiskLevel, setNewRiskLevel] = useState<RiskLevel>();
  const [shouldShowNewValueInput, setShouldShowNewValueInput] = useState(true);
  const [onlyDeleteLast, setOnlyDeleteLast] = useState(false);
  const handleUpdateValues = useCallback((cb: (oldValues: ParameterValues) => ParameterValues) => {
    setValues(cb);
  }, []);

  const handleAdd = () => {
    if (newValue && newRiskLevel != null) {
      handleUpdateValues((oldValues) => [
        ...oldValues,
        {
          parameterValue: {
            content: newValue,
          },
          riskLevel: newRiskLevel,
        },
      ]);
      setNewValue(null);
      setNewRiskLevel(undefined);
    }
  };

  const handleSave = () => {
    onSave(parameter, values, entity, defaultRiskLevel);
  };

  const handleCancel = () => {
    setValues(lastValues);
  };

  const newValueValidationMessage: string | null = NEW_VALUE_VALIDATIONS.reduce<string | null>(
    (acc, validation): string | null => {
      if (newValue == null || acc != null) {
        return acc;
      }
      return validation({
        newValue: newValue,
        newRiskLevel: newRiskLevel ?? null,
        newParameterName: parameter,
        previousValues: values,
      });
    },
    null,
  );

  const newValueInfoMessage = NEW_VALUE_INFOS.reduce<string | null>(
    (acc, information): string | null => {
      if (newValue == null || acc != null) return acc;
      return information({
        newValue: newValue,
        newRiskLevel: newRiskLevel ?? null,
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
      const newValues = values.map(({ parameterValue: { content }, riskLevel }) => {
        if (content.kind !== 'MULTIPLE') return { parameterValue: { content }, riskLevel };
        content.values = content.values.filter(({ content: val }) => val !== value);
        return { parameterValue: { content }, riskLevel };
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
    <div className={style.root}>
      <div className={style.table}>
        <div className={style.topHeader}>
          <div className={style.header}>Default risk level</div>
          <P grey variant="sml" className={style.description}>
            Any value lacking an assigned risk level will be categorized under default risk level.
            The system configuration designates the default value as '{aliasForVeryHigh}' when no
            specific risk level is allocated.
          </P>
        </div>
        <div className={style.risk}>
          <RiskLevelSwitch
            isDisabled={loading || !hasWritePermissions}
            value={defaultRiskLevel}
            onChange={(newRiskLevel) => {
              if (newRiskLevel != null) {
                setDefaultRiskLevel(newRiskLevel);
              }
            }}
          />
        </div>
      </div>
      <div className={style.table}>
        <div className={style.header}>Value</div>
        <div className={style.header}>Risk level</div>
        <div className={style.header}>
          {item.dataType === 'COUNTRY' && (
            <Button onClick={() => handleSetDefaultValues()} size="small" type="primary" block>
              Load default
            </Button>
          )}
        </div>
        {values.map(({ parameterValue, riskLevel }, index) => {
          const handleChangeRiskLevel = (newRiskLevel: RiskLevel | undefined) => {
            if (newRiskLevel != null) {
              handleUpdateValues((values) =>
                values.map((x) =>
                  x.parameterValue === parameterValue
                    ? {
                        ...x,
                        riskLevel: newRiskLevel,
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
            <React.Fragment key={JSON.stringify(parameterValue)}>
              <div>
                {VALUE_RENDERERS[dataType]({
                  value: parameterValue.content,
                  handleRemoveValue,
                })}
              </div>
              <div style={labelExistsStyle(dataType, 'value')}>
                <RiskLevelSwitch
                  isDisabled={loading || !hasWritePermissions}
                  value={riskLevel}
                  onChange={handleChangeRiskLevel}
                />
              </div>
              <div style={labelExistsStyle(dataType, 'value')}>
                <Button
                  className={style.deleteButton}
                  type="text"
                  disabled={
                    loading ||
                    (onlyDeleteLast && index !== values.length - 1) ||
                    !hasWritePermissions
                  }
                  onClick={handleDeleteKey}
                >
                  <DeleteFilled />
                </Button>
              </div>
            </React.Fragment>
          );
        })}
        <>
          <div>
            {INPUT_RENDERERS[dataType]({
              disabled: loading,
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
              <div style={labelExistsStyle(dataType, 'input')}>
                <RiskLevelSwitch
                  isDisabled={loading || !hasWritePermissions}
                  value={newRiskLevel}
                  onChange={setNewRiskLevel}
                />
              </div>
              <div style={labelExistsStyle(dataType, 'input')}>
                <Button
                  disabled={
                    loading ||
                    !newValue ||
                    newRiskLevel == null ||
                    newValueValidationMessage != null ||
                    !hasWritePermissions
                  }
                  onClick={handleAdd}
                >
                  Add
                </Button>
              </div>
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
      <div className={style.footer}>
        <Button disabled={loading || isEqual || !hasWritePermissions} onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          disabled={loading || !hasWritePermissions || isEqual}
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
