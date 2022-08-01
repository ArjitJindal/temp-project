import React, { useEffect, useState } from 'react';
import { Button } from 'antd';
import { DeleteFilled } from '@ant-design/icons';
import { ParameterName, ParameterValues, RiskLevelTableItem } from '../types';
import { INPUT_RENDERERS, VALUE_RENDERERS } from '../consts';
import style from './style.module.less';
import { RiskLevel } from '@/apis';
import RiskLevelSwitch from '@/pages/users/users-list/components/RiskLevelSwitch';
import { AsyncResource, isLoading, useLastSuccessValue } from '@/utils/asyncResource';
import { isEqual } from '@/utils/lang';

interface Props {
  item: RiskLevelTableItem;
  currentValuesRes: AsyncResource<ParameterValues>;
  onSave: (parameter: ParameterName, newValues: ParameterValues) => void;
}

export default function ValuesTable(props: Props) {
  const { currentValuesRes, item, onSave } = props;
  const { parameter, dataType } = item;

  const lastValues = useLastSuccessValue(currentValuesRes, []);
  const [values, setValues] = useState(lastValues);

  useEffect(() => {
    setValues(lastValues);
  }, [lastValues]);

  const isChanged = !isEqual(lastValues, values);
  const loading = isLoading(currentValuesRes);

  const [newValue, setNewValue] = useState<string[]>([]);
  const [newRiskLevel, setNewRiskLevel] = useState<RiskLevel | null>(null);

  const handleUpdateValues = (cb: (oldValues: ParameterValues) => ParameterValues) => {
    setValues((oldValues) => {
      const result = cb(oldValues);
      result.sort((x, y) => x.parameterValue.localeCompare(y.parameterValue));
      return result;
    });
  };

  const handleAdd = () => {
    if (newValue && newRiskLevel != null) {
      for (const value of newValue) {
        handleUpdateValues((values) => [
          ...values.filter((x) => x.parameterValue !== value),
          {
            parameterValue: value,
            riskLevel: newRiskLevel,
          },
        ]);
      }
      setNewValue([]);
      setNewRiskLevel(null);
    }
  };

  const handleSave = () => {
    onSave(parameter, values);
  };

  const handleCancel = () => {
    setValues(lastValues);
  };

  return (
    <div className={style.root}>
      <div className={style.table}>
        <div className={style.header}>Variable</div>
        <div className={style.header}>Risk Score</div>
        <div className={style.header}></div>
        {values.map(({ parameterValue, riskLevel }, i) => {
          const handleChangeRiskLevel = (newRiskLevel: RiskLevel) => {
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
          };

          const handleDeleteKey = () => {
            handleUpdateValues((values) =>
              values.filter((x) => x.parameterValue !== parameterValue),
            );
          };

          return (
            <React.Fragment key={i}>
              <div>
                {VALUE_RENDERERS[dataType]({
                  value: parameterValue,
                })}
              </div>
              <div>
                <RiskLevelSwitch
                  disabled={loading}
                  current={riskLevel}
                  onChange={handleChangeRiskLevel}
                />
              </div>
              <div>
                <Button
                  className={style.deleteButton}
                  type="text"
                  disabled={loading}
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
              values: newValue,
              onChange: setNewValue,
            })}
          </div>
          <div>
            <RiskLevelSwitch disabled={loading} current={newRiskLevel} onChange={setNewRiskLevel} />
          </div>
          <div>
            <Button disabled={loading || !newValue || newRiskLevel == null} onClick={handleAdd}>
              Set
            </Button>
          </div>
        </>
      </div>
      <div className={style.footer}>
        <Button disabled={loading || !isChanged} onClick={handleCancel}>
          Cancel changes
        </Button>
        <Button disabled={loading || !isChanged} onClick={handleSave} type="primary">
          Save changes
        </Button>
      </div>
    </div>
  );
}
