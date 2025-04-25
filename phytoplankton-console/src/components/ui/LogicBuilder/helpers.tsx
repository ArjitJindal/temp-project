import { BasicConfig, Config, Settings, ValueSourceItem } from '@react-awesome-query-builder/ui';
import '@react-awesome-query-builder/ui/css/styles.css';
import cn from 'clsx';
import { isEmpty } from 'lodash';
import s from './index.module.less';
import { JSON_LOGIC_OPERATORS, MULTI_SELECT_LIST_OPERATORS, SELECT_OPERATORS } from './operators';
import ViewModeTags from './ViewModeTags';
import {
  addVirtualFieldsForNestedSubfields,
  getVirtualFieldDescription,
  getVirtualFieldVarName,
  isVirtualFieldVarName,
} from './virtual-fields';
import { LogicBuilderConfig, QueryBuilderConfig } from '@/components/ui/LogicBuilder/types';
import { customWidgets, isOperatorParameterField } from '@/components/ui/LogicBuilder/widgets';
import Select, { Option } from '@/components/library/Select';
import Label, { Props as LabelProps } from '@/components/library/Label';
import Dropdown from '@/components/library/Dropdown';
import ArrowDownSLineIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import DeleteOutlined from '@/components/ui/icons/Remix/system/delete-bin-6-line.react.svg';
import Button from '@/components/library/Button';
import { TagColor } from '@/components/library/Tag';
import VariableInfoPopover from '@/components/ui/LogicBuilder/VariableInfoPopover';

const InitialConfig = BasicConfig;

export const LHS_ONLY_SYMBOL = '$1';
export const RHS_ONLY_SYMBOL = '$2';

export function makeConfig(
  params: LogicBuilderConfig,
  settings?: Partial<Settings>,
): QueryBuilderConfig {
  const variableColors: { [variableName: string]: TagColor | undefined } = Object.keys(
    params.fields,
  ).reduce((acc, x) => ({ ...acc, [x]: x.startsWith('agg:') ? 'action' : 'gray' }), {});

  const {
    mode = 'EDIT',
    onClickVariable,
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
  const isViewMode = mode === 'VIEW';
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
    operators: operators,
    fields: addVirtualFieldsForNestedSubfields(fields),
    settings: {
      ...InitialConfig.settings,
      mode,
      variableColors,
      onClickVariable,
      immutableGroupsMode: isViewMode,
      immutableFieldsMode: isViewMode,
      immutableOpsMode: isViewMode,
      immutableValuesMode: isViewMode,
      removeEmptyGroupsOnLoad: false,
      removeIncompleteRulesOnLoad: false,
      showLabels: !hideLabels && !isViewMode,
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
      removeEmptyRulesOnLoad: false,
      canLeaveEmptyGroup: false,
      maxNesting: enableNesting ? undefined : 1,
      forceShowConj: false,
      addRuleLabel: addRuleLabel,
      addGroupLabel: addGroupLabel,
      addSubRuleLabel: 'Add sub condition',
      groupActionsPosition: 'bottomLeft',
      canReorder: !isViewMode && enableReorder,
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
          options = Object.entries(props.valueSources).map(([key, value]) => {
            const { label } = value as ValueSourceItem;
            return {
              value: key,
              label,
            };
          });
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
              {!props.readonly && <ArrowDownSLineIcon className={s.arrowIcon} />}
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
        const options = filteredItems.map((x) => ({ label: x.label, value: x.path }));
        const selectedKey = props.selectedKey;
        if (isViewMode) {
          const option = options.find((x) => x.value === selectedKey);

          return (
            <VariableInfoPopover
              onClick={
                onClickVariable != null && selectedKey != null
                  ? () => {
                      onClickVariable?.(selectedKey);
                    }
                  : undefined
              }
            >
              <ViewModeTags color={selectedKey ? variableColors[selectedKey] : undefined}>
                {option?.label ?? selectedKey}
              </ViewModeTags>
            </VariableInfoPopover>
          );
        }
        return (
          <FieldInput
            options={options}
            value={selectedKey}
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
        const isLHSSelectType =
          (props as any).fieldConfig?.type === 'text' &&
          !isEmpty((props as any).fieldConfig?.fieldSettings?.listValues);
        // NOTE: Enum type variable is set to `text` type instead of `select` type to allow comparing
        // enum with text value. But we still only show select operators for enum type variable.
        const options = isLHSSelectType
          ? props.items?.filter((item) =>
              [...SELECT_OPERATORS, ...MULTI_SELECT_LIST_OPERATORS].includes(item.key),
            )
          : props.items;
        const finalOptions = options.map((x) => ({ label: x.label, value: x.key }));
        if (isViewMode) {
          return (
            <ViewModeTags>
              {finalOptions.find((x) => x.value === props.selectedKey)?.label ?? props.selectedKey}
            </ViewModeTags>
          );
        }
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
              options={finalOptions}
              value={props.selectedKey}
              onChange={(key) => {
                const item = options.find((x) => x.key === key);
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
        const options = props.items.map((x) => ({ label: x.label, value: x.key }));
        const value = props.selectedKey;

        if (isViewMode) {
          return <ViewModeTags>{options.find((x) => x.value === value)?.label}</ViewModeTags>;
        }

        return (
          <Label label={'Function'} testId="logic-function">
            <Select
              autoTrim={true}
              dropdownMatchWidth={true}
              portaled={true}
              allowClear={false}
              options={options}
              value={value}
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
      ...(settings ?? {}),
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
  value: string | null | undefined;
  onChange: (value) => void;
  showlabel?: boolean;
}

export const FieldInput = (props: FieldInputProps) => {
  const { options, value, onChange, showlabel = true } = props;
  const selectedOption =
    value != null
      ? options.find((x) => x.value === value || x.value === getVirtualFieldVarName(value))
      : null;
  const selectedOptionVirtualFieldsOptions = options
    .filter(
      (x) =>
        isVirtualFieldVarName(x.value) && getVirtualFieldVarName(x.value) === selectedOption?.value,
    )
    .map((x) => {
      return {
        label: getVirtualFieldDescription(x.value),
        value: x.value,
        virtualField: x.value,
      };
    });
  return (
    <OptionalLabel label={'Variable'} showLabel={showlabel} testId="logic-variable">
      <div className={s.variableSelects}>
        <Select
          autoTrim={true}
          dropdownMatchWidth={false}
          portaled={true}
          allowClear={false}
          options={options.filter((x) => !isVirtualFieldVarName(x.value))}
          value={selectedOption?.value}
          onChange={onChange}
          tooltip
        />
        {selectedOption && selectedOptionVirtualFieldsOptions.length > 0 && (
          <Select
            options={[
              { label: 'string', value: selectedOption.value },
              ...selectedOptionVirtualFieldsOptions,
            ]}
            value={value}
            onChange={onChange}
          />
        )}
      </div>
    </OptionalLabel>
  );
};

export function isViewMode(config: Config): boolean {
  return (config as QueryBuilderConfig)?.settings?.mode === 'VIEW';
}
