import React, { useCallback, useState } from 'react';
import cn from 'clsx';
import { AutoComplete, Popover } from 'antd';
import { DataSourceItemType } from 'antd/lib/auto-complete';
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
import { useApi } from '@/api';

export type VariablesValues = Record<string, any>;

interface Props {
  questionId: string;
  variables: QuestionVariableOption[];
  initialValues: VariablesValues;
  onConfirm: (values: VariablesValues) => void;
}

export default function Variables(props: Props) {
  const { variables, initialValues, onConfirm } = props;
  const [isVisible, setVisible] = useState(false);
  const [varsValues, setVarsValues] = useState(initialValues);
  const [dirty, setDirty] = useState<boolean>(false);

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
    setDirty(false);
    setVisible(false);
  }, [varsValues, onConfirm]);

  if (variables.length <= 3) {
    return (
      <VariablesPopoverContent
        {...props}
        varsValuesState={[
          varsValues,
          (updater: Updater<VariablesValues>) => {
            const newState = applyUpdater(varsValues, updater);
            setVarsValues(newState);
            setDirty(true);
          },
        ]}
        onConfirm={() => {
          if (dirty) {
            onConfirm(varsValues);
            setDirty(false);
          }
        }}
        modal={false}
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
            modal={true}
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
  props: Props & { varsValuesState: StatePair<VariablesValues>; modal: boolean },
) {
  const { variables, modal, questionId } = props;
  const labelPosition = modal ? 'TOP' : 'LEFT';
  const [varsValues, setVarsValues] = props.varsValuesState;
  return (
    <div
      className={cn(
        modal ? s.variablesModal : s.variables,
        variables.length === 1 ?? s.singleVariable,
      )}
    >
      {variables.map((variable) => {
        const varName = variable.name;
        if (varName == null) {
          return null;
        }
        return (
          <Label key={varName} label={humanizeAuto(varName ?? 'N/A')} position={labelPosition}>
            <div className={s.input}>
              {renderInput(questionId, variable, {
                value: varsValues[varName],
                onBlur: () => props.onConfirm(varsValues),
                onChange: (newValue) => {
                  setVarsValues((prevState) => ({
                    ...prevState,
                    [varName]: newValue,
                  }));
                },
              })}
            </div>
          </Label>
        );
      })}
    </div>
  );
}

function renderInput(
  questionId: string,
  variable: QuestionVariableOption,
  inputProps: InputProps<any>,
) {
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
        onBlur={inputProps.onBlur}
        onChange={(dayjsValue) => {
          const newValue = dayjsValue ? dayjsValue.valueOf() : undefined;
          inputProps.onChange?.(newValue);
        }}
      />
    );
  }
  if (variable.variableType === 'AUTOCOMPLETE') {
    if (variable.options !== undefined) {
      return (
        <AutoComplete
          {...inputProps}
          className={s.autocomplete}
          dataSource={variable.options.map((o) => ({ value: o, text: o }))}
        />
      );
    }
    return <TextInput {...inputProps} />;
  }
  if (variable.variableType === 'SEARCH') {
    return <Search questionId={questionId} variable={variable} inputProps={inputProps} />;
  }
  return <TextInput {...inputProps} />;
}

const Search = ({
  questionId,
  variable,
  inputProps,
}: {
  questionId: string;
  variable: QuestionVariableOption;
  inputProps: InputProps<any>;
}) => {
  const api = useApi();
  const variableKey = variable.name || '';
  const [dataSource, setDatasource] = useState<DataSourceItemType[]>();
  const onSearch = async (search: string) => {
    const results = await api.getQuestionVariableAutocomplete({
      questionId,
      variableKey,
      search,
    });
    setDatasource(results.suggestions?.map((s) => ({ value: s, text: s })));
  };

  return (
    <AutoComplete
      {...inputProps}
      onSearch={onSearch}
      className={s.autocomplete}
      dataSource={dataSource}
    />
  );
};
