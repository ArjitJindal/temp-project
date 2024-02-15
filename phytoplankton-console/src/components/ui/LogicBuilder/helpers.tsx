import { BasicConfig } from '@react-awesome-query-builder/ui';
import '@react-awesome-query-builder/ui/css/styles.css';

import cn from 'clsx';
import React from 'react';
import s from './index.module.less';
import { JSON_LOGIC_FUNCTIONS } from './functions';
import { LogicBuilderConfig } from '@/components/ui/LogicBuilder/types';
import { customWidgets } from '@/components/ui/LogicBuilder/widgets';
import Select, { Option } from '@/components/library/Select';
import Label, { Props as LabelProps } from '@/components/library/Label';
import Dropdown from '@/components/library/Dropdown';
import ArrowDownSLineIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import DeleteOutlined from '@/components/ui/icons/Remix/system/delete-bin-6-line.react.svg';
import Button from '@/components/library/Button';

const InitialConfig = BasicConfig;

export function makeConfig(params: LogicBuilderConfig): BasicConfig {
  const {
    fields,
    enableNesting = true,
    enableReorder = true,
    hideLabels = false,
    addRuleLabel = 'Add condition',
    addGroupLabel = 'Add group',
    enabledValueSources = undefined,
  } = params;
  // todo: make a proper config initialization instead of mutating 3rd party config
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
      ...JSON_LOGIC_FUNCTIONS,
    },
    operators: enabledValueSources
      ? Object.entries({
          ...InitialConfig.operators,
          ...params.operators,
        }).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: {
              ...value,
              valueSources: enabledValueSources,
            },
          }),
          InitialConfig.operators,
        )
      : {
          ...InitialConfig.operators,
          ...params.operators,
        },
    fields: fields,
    settings: {
      ...InitialConfig.settings,
      showLabels: !hideLabels,
      fieldSources: ['field', 'func'],
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
      maxNesting: enableNesting ? undefined : 1,
      forceShowConj: false,
      addRuleLabel: addRuleLabel,
      addGroupLabel: addGroupLabel,
      addSubRuleLabel: 'Add sub condition',
      groupActionsPosition: 'bottomLeft',
      canReorder: enableReorder,
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
          <Dropdown
            selectedKeys={[props.valueSrc ?? '']}
            options={options}
            onSelect={(option) => {
              props.setValueSrc(option.value);
            }}
          >
            <div className={cn(s.selectedValueSource)}>
              <ArrowDownSLineIcon className={s.arrowIcon} />
            </div>
          </Dropdown>
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
          <OptionalLabel
            label={'Variable'}
            showLabel={props.config?.settings.showLabels !== false}
            testId="logic-variable"
          >
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
          </OptionalLabel>
        );
      },
      renderOperator: (props) => {
        return (
          <OptionalLabel
            label={'Operator'}
            showLabel={props.config?.settings.showLabels !== false}
            testId="logic-operator"
          >
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
          </OptionalLabel>
        );
      },
      renderFunc: (props) => {
        return (
          <Label label={'Function'} testId="logic-function">
            <Select
              autoTrim={true}
              dropdownMatchWidth={true}
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

function OptionalLabel(
  props: LabelProps & {
    showLabel: boolean;
  },
) {
  const { children, showLabel = true, ...rest } = props;
  if (!showLabel) {
    return <>{children}</>;
  }
  return <Label {...rest}>{children}</Label>;
}
