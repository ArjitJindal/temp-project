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
import { dayjs, Dayjs } from '@/utils/dayjs';
import Button from '@/components/library/Button';
import { useDeepEqualEffect } from '@/utils/hooks';
import { applyUpdater, StatePair, Updater } from '@/utils/state';

export type VariablesValues = Record<string, any>;

interface Props {
  variables: QuestionVariableOption[];
  initialValues: VariablesValues;
  onConfirm: (values: VariablesValues) => void;
}

export default function Variables(props: Props) {
  const { variables, initialValues, onConfirm } = props;
  const [isVisible, setVisible] = useState(false);
  const [varsValues, setVarsValues] = useState(initialValues);

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

  if (variables.length <= 2) {
    return (
      <VariablesPopoverContent
        {...props}
        varsValuesState={[
          varsValues,
          (updater: Updater<VariablesValues>) => {
            const newState = applyUpdater(varsValues, updater);
            setVarsValues(newState);
            onConfirm(newState);
          },
        ]}
        labelPosition={'LEFT'}
      />
    );
  }

  return (
    <Popover
      visible={isVisible}
      overlayClassName={s.popoverRoot}
      trigger="click"
      content={
        <div className={s.root}>
          <VariablesPopoverContent
            {...props}
            varsValuesState={[varsValues, setVarsValues]}
            labelPosition={'TOP'}
          />
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
      <Button size="SMALL" type="TETRIARY">
        Parameters
      </Button>
    </Popover>
  );
}

export function VariablesPopoverContent(
  props: Props & { varsValuesState: StatePair<VariablesValues>; labelPosition: 'TOP' | 'LEFT' },
) {
  const { variables, labelPosition } = props;
  const [varsValues, setVarsValues] = props.varsValuesState;
  return (
    <div className={s.variables}>
      {variables.map((variable) => {
        const varName = variable.name;
        if (varName == null) {
          return null;
        }
        return (
          <Label key={varName} label={humanizeAuto(varName ?? 'N/A')} position={labelPosition}>
            {renderInput(variable, {
              value: varsValues[varName],
              onChange: (newValue) => {
                setVarsValues((prevState) => ({
                  ...prevState,
                  [varName]: newValue,
                }));
              },
            })}
          </Label>
        );
      })}
    </div>
  );
}

function renderInput(variable: QuestionVariableOption, inputProps: InputProps<any>) {
  if (variable.variableType === 'INTEGER' || variable.variableType === 'FLOAT') {
    return <NumberInput {...inputProps} />;
  }

  if (variable.variableType === 'DATE' || variable.variableType === 'DATETIME') {
    const value: Dayjs | null = inputProps.value ? dayjs(inputProps.value) : null;

    return (
      <DatePicker
        showTime={variable.variableType === 'DATETIME'}
        value={value}
        allowClear
        onChange={(dayjsValue) => {
          const newValue = dayjsValue ? dayjsValue.valueOf() : undefined;
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
