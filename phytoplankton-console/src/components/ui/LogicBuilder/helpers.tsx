import { BasicConfig } from '@react-awesome-query-builder/ui';
import '@react-awesome-query-builder/ui/css/styles.css';

import cn from 'clsx';
import React from 'react';
import s from './index.module.less';
import { LogicBuilderConfig } from '@/components/ui/LogicBuilder/types';
import { customWidgets } from '@/components/ui/LogicBuilder/widgets';
import Select, { Option } from '@/components/library/Select';
import Label from '@/components/library/Label';
import Dropdown from '@/components/library/Dropdown';
import ArrowDownSLineIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import DeleteOutlined from '@/components/ui/icons/Remix/system/delete-bin-6-line.react.svg';
import Button from '@/components/library/Button';

const InitialConfig = BasicConfig;

export function makeConfig(params: LogicBuilderConfig): BasicConfig {
  const { fields, disableNesting } = params;
  InitialConfig.operators.select_any_in.valueTypes = ['multiselect', 'text'];
  InitialConfig.operators.select_not_any_in.valueTypes = ['multiselect', 'text'];
  return {
    ...InitialConfig,
    widgets: customWidgets,
    types: {
      ...InitialConfig.types,
      ...params.types,
    },
    funcs: {
      ...InitialConfig.funcs,
      ...params.funcs,
    },
    operators: {
      ...InitialConfig.operators,
      ...params.operators,
    },
    fields: fields,
    settings: {
      ...InitialConfig.settings,
      valueSourcesInfo: {
        ...InitialConfig.settings.valueSourcesInfo,
        value: {
          label: 'Value',
        },
        field: {
          label: 'Variable',
        },
      },
      showNot: false,
      canLeaveEmptyGroup: false,
      maxNesting: disableNesting === false ? undefined : 1,
      forceShowConj: false,
      addRuleLabel: 'Add condition',
      addSubRuleLabel: 'Add sub condition',
      addGroupLabel: 'Add complex condition',
      groupActionsPosition: 'bottomLeft',
      renderValueSources: (props) => {
        let options: Option<string>[];
        if (Array.isArray(props.valueSources)) {
          options = props.valueSources.map(([key, { label }]) => ({
            value: key,
            label,
          }));
        } else {
          options = Object.entries(props.valueSources).map(([key, { label }]) => ({
            value: key,
            label,
          }));
        }
        return (
          <Label label={'Source'} testId="logic-source">
            <Select
              autoTrim={true}
              dropdownMatchWidth={false}
              portaled={true}
              allowClear={false}
              value={props.valueSrc}
              onChange={(newValue) => {
                if (newValue) {
                  props.setValueSrc(newValue);
                }
              }}
              options={options}
            />
          </Label>
        );
      },
      renderConjs: (props) => {
        const options = Object.values(props.conjunctionOptions ?? {}).map((x) => ({
          label: x.label,
          value: x.key,
        }));
        const disabled = props.disabled || props.readonly;
        return (
          <Dropdown
            disabled={disabled}
            options={options}
            onSelect={(option) => {
              props.setConjunction(option.value);
            }}
          >
            <div className={cn(s.selectedConjunction, disabled && s.isDisabled)}>
              {props.selectedConjunction ?? options[0]?.label ?? '-'}
              <ArrowDownSLineIcon className={s.arrowIcon} />
            </div>
          </Dropdown>
        );
      },
      renderField: (props) => {
        return (
          <Label label={'Variable'} testId="logic-variable">
            <Select
              autoTrim={true}
              dropdownMatchWidth={false}
              portaled={true}
              allowClear={false}
              options={props.items.map((x) => ({ label: x.label, value: x.path }))}
              value={props.selectedKey}
              onChange={(path) => {
                const item = props.items.find((x) => x.path === path);
                if (item?.path) {
                  props.setField(item.path);
                }
              }}
            />
          </Label>
        );
      },
      renderOperator: (props) => {
        return (
          <Label label={'Operator'} testId="logic-operator">
            <Select
              autoTrim={true}
              dropdownMatchWidth={false}
              portaled={true}
              allowClear={false}
              options={props.items.map((x) => ({ label: x.label, value: x.key }))}
              value={props.selectedKey}
              onChange={(key) => {
                const item = props.items.find((x) => x.key === key);
                if (item && item.path) {
                  props.setField(item.path);
                }
              }}
            />
          </Label>
        );
      },
      renderButton: (props) => {
        if (props.type.startsWith('del')) {
          return (
            <button onClick={props.onClick} className={s.delRuleButton} disabled={props.readonly}>
              <DeleteOutlined />
            </button>
          );
        }
        return (
          <Button onClick={props.onClick} type="SECONDARY" size="SMALL" isDisabled={props.readonly}>
            {props.label}
          </Button>
        );
      },
    },
  };
}
