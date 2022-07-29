import React, { useEffect, useState } from 'react';
import { Button } from 'antd';
import { DeleteFilled } from '@ant-design/icons';
import { ParameterName, ParameterValues, RiskLevelTableItem } from '../types';
import { INPUT_RENDERERS, VALUE_RENDERERS } from '../consts';
import style from './style.module.less';
import { RiskLevel } from '@/apis';
import RiskLevelSwitch from '@/pages/users/users-list/components/RiskLevelSwitch';
import { AsyncResource, getOr, isLoading } from '@/utils/asyncResource';

interface Props {
  item: RiskLevelTableItem;
  currentValuesRes: AsyncResource<ParameterValues>;
  onSave: (parameter: ParameterName, newValues: ParameterValues) => void;
}

export default function ValuesTable(props: Props) {
  const { currentValuesRes, item, onSave } = props;
  const { parameter, dataType } = item;

  const lastValues = getOr(currentValuesRes, []);

  const [values, setValues] = useState<ParameterValues>(lastValues);

  const [newKey, setNewKey] = useState<string[]>([]);
  const [newValue, setNewValue] = useState<RiskLevel | null>(null);

  useEffect(() => {
    setValues(getOr(currentValuesRes, []));
  }, [currentValuesRes]);

  const loading = isLoading(currentValuesRes);

  const handleUpdateValues = (cb: (oldValues: ParameterValues) => ParameterValues) => {
    setValues((oldValues) => {
      const result = cb(oldValues);
      result.sort((x, y) => x.parameterValue.localeCompare(y.parameterValue));
      return result;
    });
  };

  const handleAdd = () => {
    if (newKey && newValue != null) {
      for (const value of newKey) {
        handleUpdateValues((values) => [
          ...values.filter((x) => x.parameterValue !== value),
          {
            parameterValue: value,
            riskLevel: newValue,
          },
        ]);
      }
      setNewKey([]);
      setNewValue(null);
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
              values: newKey,
              onChange: setNewKey,
            })}
          </div>
          <div>
            <RiskLevelSwitch disabled={loading} current={newValue} onChange={setNewValue} />
          </div>
          <div>
            <Button disabled={loading || !newKey || newValue == null} onClick={handleAdd}>
              Set
            </Button>
          </div>
        </>
      </div>
      <div className={style.footer}>
        <Button disabled={loading} onClick={handleCancel}>
          Cancel changes
        </Button>
        <Button disabled={loading} onClick={handleSave} type="primary">
          Save changes
        </Button>
      </div>
    </div>
  );
}
