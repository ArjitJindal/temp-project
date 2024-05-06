import { BasicConfig, CoreOperators, Config, Empty } from '@react-awesome-query-builder/ui';
import '@react-awesome-query-builder/ui/css/styles.css';
import cn from 'clsx';
import s from './index.module.less';
import { JSON_LOGIC_FUNCTIONS } from './functions';
import { JSON_LOGIC_OPERATORS } from './operators';
import { LogicBuilderConfig } from '@/components/ui/LogicBuilder/types';
import { customWidgets, isOperatorParameterField } from '@/components/ui/LogicBuilder/widgets';
import Select, { Option } from '@/components/library/Select';
import Label, { Props as LabelProps } from '@/components/library/Label';
import Dropdown from '@/components/library/Dropdown';
import ArrowDownSLineIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import DeleteOutlined from '@/components/ui/icons/Remix/system/delete-bin-6-line.react.svg';
import Button from '@/components/library/Button';

const InitialConfig = BasicConfig;

export const LHS_ONLY_SYMBOL = '$1';
export const RHS_ONLY_SYMBOL = '$2';

export function makeConfig(params: LogicBuilderConfig): Omit<Config, 'operators'> & {
  operators: Omit<CoreOperators<Config>, 'multiselect_not_contains' | 'multiselect_contains'>;
} {
  const {
    fields,
    enableNesting = true,
    enableReorder = true,
    hideLabels = false,
    addRuleLabel = 'Add condition',
    addGroupLabel = 'Add group',
  } = params;
  const operators = {
    ...JSON_LOGIC_OPERATORS,
    ...params.operators,
  };
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
    operators: operators,
    fields: fields,
    settings: {
      ...InitialConfig.settings,
      removeEmptyGroupsOnLoad: false,
      removeIncompleteRulesOnLoad: false,
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
      showErrorMessage: true,
      renderValueSources: (props) => {
        if (isOperatorParameterField(props)) {
          // Not applicable, hide it
          return <></>;
        }
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
        const filteredItems = props.items.filter((item) => {
          const lhsOnly = item.key.endsWith(LHS_ONLY_SYMBOL);
          const rhsOnly = item.key.endsWith(RHS_ONLY_SYMBOL);
          if (!lhsOnly && !rhsOnly) {
            return true;
          }
          return lhsOnly;
        });
        return (
          <FieldInput
            options={filteredItems.map((x) => ({ label: x.label, value: x.path }))}
            value={props.selectedKey}
            onChange={(path) => {
              const item = props.items.find((x) => x.path === path);
              if (item?.path) {
                props.setField(item.path);
              }
            }}
            showlabel={props.config?.settings.showLabels !== false}
          />
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
              tooltip
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
              tooltip
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

interface FieldInputProps {
  options: Option<any>[];
  value: string | Empty;
  onChange: (value) => void;
  showlabel?: boolean;
}

export const FieldInput = (props: FieldInputProps) => {
  const { options, value, onChange, showlabel = true } = props;
  return (
    <OptionalLabel label={'Variable'} showLabel={showlabel} testId="logic-variable">
      <Select
        autoTrim={true}
        dropdownMatchWidth={false}
        portaled={true}
        allowClear={false}
        options={options}
        value={value}
        onChange={onChange}
        tooltip
      />
    </OptionalLabel>
  );
};
