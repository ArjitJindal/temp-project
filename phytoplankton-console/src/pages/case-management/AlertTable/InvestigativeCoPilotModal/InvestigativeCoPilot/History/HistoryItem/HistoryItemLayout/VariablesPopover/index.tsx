import React, { useCallback, useState } from 'react';
import { Popover } from 'antd';
import s from './index.module.less';
import { QuestionVariableOption } from '@/apis';
import { humanizeAuto } from '@/utils/humanize';
import Label from '@/components/library/Label';
import TextInput from '@/components/library/TextInput';
import { InputProps } from '@/components/library/Form';
import NumberInput from '@/components/library/NumberInput';
import DatePicker from '@/components/ui/DatePicker';
import { DATE_TIME_ISO_FORMAT, dayjs, Dayjs } from '@/utils/dayjs';
import Button from '@/components/library/Button';
import { useDeepEqualEffect } from '@/utils/hooks';

export type VariablesValues = Record<string, any>;

interface Props {
  variables: QuestionVariableOption[];
  initialValues: VariablesValues;
  children: React.ReactNode;
  onConfirm: (values: VariablesValues) => void;
}

const INITIAL_VARS_STATE: VariablesValues = {};

export default function VariablesPopover(props: Props) {
  const { variables, children, initialValues, onConfirm } = props;
  const [isVisible, setVisible] = useState(false);
  const [varsValues, setVarsValues] = useState(INITIAL_VARS_STATE);

  useDeepEqualEffect(() => {
    if (!isVisible) {
      setVarsValues(initialValues);
    }
  }, [isVisible, initialValues]);

  const handleCancel = useCallback(() => {
    setVisible(false);
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(varsValues);
    setVisible(false);
  }, [varsValues, onConfirm]);

  return (
    <Popover
      visible={isVisible}
      overlayClassName={s.popoverRoot}
      trigger="click"
      content={
        <div className={s.root}>
          <div className={s.variables}>
            {variables.map((variable) => {
              const varName = variable.name;
              if (varName == null) {
                return null;
              }
              return (
                <Label key={varName} label={humanizeAuto(varName ?? 'N/A')}>
                  {renderInput(variable, {
                    value: varsValues[varName],
                    onChange: (newValue) => {
                      if (newValue != null) {
                        setVarsValues((prevState) => ({
                          ...prevState,
                          [varName]: newValue,
                        }));
                      }
                    },
                  })}
                </Label>
              );
            })}
          </div>
          <div className={s.buttons}>
            <Button onClick={handleConfirm}>Confirm</Button>
            <Button type="SECONDARY" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      }
      placement="bottomRight"
      onVisibleChange={setVisible}
    >
      {children}
    </Popover>
  );
}

function renderInput(variable: QuestionVariableOption, inputProps: InputProps<any>) {
  if (variable.variableType === 'INTEGER' || variable.variableType === 'FLOAT') {
    return <NumberInput {...inputProps} />;
  }

  if (variable.variableType === 'DATETIME') {
    const value: Dayjs | null = inputProps.value
      ? dayjs(inputProps.value, DATE_TIME_ISO_FORMAT)
      : null;

    return (
      <DatePicker
        showTime={true}
        value={value}
        allowClear
        onChange={(dayjsValue) => {
          const newValue = dayjsValue ? dayjsValue.format(DATE_TIME_ISO_FORMAT) : undefined;
          inputProps.onChange?.(newValue);
        }}
      />
    );
  }
  if (variable.variableType === 'STRING') {
    return <TextInput {...inputProps} />;
  }
  return <TextInput {...inputProps} />;
}
