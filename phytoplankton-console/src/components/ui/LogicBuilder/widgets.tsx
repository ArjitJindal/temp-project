import {
  SelectWidget,
  ListItem,
  TextWidget,
  WidgetProps,
  NumberWidget,
  BooleanWidget,
  MultiSelectWidget,
  SelectFieldSettings,
} from '@react-awesome-query-builder/core';
import {
  CoreWidgets,
  Config,
  BasicConfig,
  BaseWidgetProps,
  DateTimeWidget,
  Operator,
  FieldWidget,
  FactoryWithContext,
  MultiSelectFieldSettings,
} from '@react-awesome-query-builder/ui';
import moment from 'moment';
import { TimePicker } from 'antd';
import React from 'react';
import { isEmpty } from 'lodash';
import DatePicker from '../DatePicker';
import s from './index.module.less';
import {
  deserializeCountries,
  getFieldOptions,
  isAnyInOpreator,
  omitCountryGroups,
  serializeCountries,
} from './widget-utils';
import ListSelect from './ListSelect';
import {
  MULTI_SELECT_BUILTIN_OPERATORS,
  MULTI_SELECT_LIST_OPERATORS,
  isCustomOperator,
} from './operators';
import { FieldInput, LHS_ONLY_SYMBOL, RHS_ONLY_SYMBOL } from './helpers';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import { humanizeAuto } from '@/utils/humanize';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';
import Label from '@/components/library/Label';
import NumberInput from '@/components/library/NumberInput';
import Toggle from '@/components/library/Toggle';
import { dayjs } from '@/utils/dayjs';
import { RuleOperatorType } from '@/apis';
import PropertyInput from '@/components/library/JsonSchemaEditor/Property/PropertyInput';
import { ExtendedSchema } from '@/components/library/JsonSchemaEditor/types';
import Tooltip from '@/components/library/Tooltip';

function getOperator(props: any) {
  const operator = props.config.operators[props.operator];
  if (operator) {
    return operator as Operator<Config> & { parameters?: ExtendedSchema[] };
  }
  return null;
}

export function isOperatorParameterField(props: any): boolean {
  const operator = getOperator(props);
  if (!operator) {
    return false;
  }
  return (
    (props.delta ?? 0) + 1 === operator.cardinality &&
    !!operator.parameters &&
    operator.parameters.length > 0
  );
}

function WidgetWrapper(props: {
  widgetFactoryProps: WidgetProps<BasicConfig>;
  children: React.ReactNode;
}) {
  const { widgetFactoryProps } = props;
  if (isOperatorParameterField(widgetFactoryProps)) {
    const operator = getOperator(widgetFactoryProps);
    if (!operator || !operator.parameters) {
      return null;
    }
    const parameterValues = (widgetFactoryProps.value ?? []).slice(0, operator.parameters.length);
    return (
      <div className={s.operatorParametersContainer}>
        {operator.parameters.map((schema, i) => {
          return (
            <Label
              key={i}
              label={
                <div className={s.label}>
                  {schema.title}
                  {schema.description && (
                    <Tooltip title={schema.description} placement="top">
                      <InformationLineIcon />
                    </Tooltip>
                  )}
                </div>
              }
            >
              <PropertyInput
                schema={schema}
                onChange={(v) => {
                  const newParameterValues = [...parameterValues];
                  newParameterValues[i] = v;
                  widgetFactoryProps.setValue(newParameterValues);
                }}
                value={parameterValues[i]}
              />
            </Label>
          );
        })}
      </div>
    );
  }

  const showLabel = widgetFactoryProps.config?.settings.showLabels !== false;
  if (!showLabel) {
    return <>{props.children}</>;
  }
  return <Label label={'Value'}>{props.children}</Label>;
}

const customNumberWidget: NumberWidget<BasicConfig> = {
  type: `number`,
  factory: (props) => {
    let value: number | undefined;
    if (Array.isArray(props.value)) {
      console.warn(`This widget doesn't support array values, using first item `);
      value = props.value?.[0] ?? undefined;
    } else {
      value = props.value ?? undefined;
    }
    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <NumberInput value={value} onChange={(v) => props.setValue(v ?? 0)} allowClear={true} />
      </WidgetWrapper>
    );
  },
};

const customTextWidget: TextWidget<BasicConfig> = {
  type: `text`,
  factory: (props) => {
    const isEnumType = !isEmpty((props as SelectFieldSettings).listValues);
    const operator = props.operator as RuleOperatorType;

    if (MULTI_SELECT_LIST_OPERATORS.includes(operator)) {
      return (
        <WidgetWrapper widgetFactoryProps={props}>
          <ListSelect
            value={(props.value as any) ?? undefined}
            onChange={(newValue) => {
              props.setValue(newValue as any);
            }}
          />
        </WidgetWrapper>
      );
    }

    // All text-type operators should support multi-values
    if (
      isCustomOperator(operator) ||
      (!isEnumType && MULTI_SELECT_BUILTIN_OPERATORS.includes(operator))
    ) {
      return (
        <WidgetWrapper widgetFactoryProps={props}>
          <Select<string>
            portaled={true}
            mode={'TAGS'}
            allowClear={true}
            options={[]}
            value={(props.value as any) ?? undefined}
            onChange={(newValue) => {
              props.setValue(newValue as any);
            }}
          />
        </WidgetWrapper>
      );
    }
    if (isEnumType) {
      if (MULTI_SELECT_BUILTIN_OPERATORS.includes(props.operator)) {
        return (customMultiselectWidget.factory as FactoryWithContext<MultiSelectFieldSettings>)(
          props,
        );
      } else {
        return (customSelectWidget.factory as FactoryWithContext<SelectFieldSettings>)(props);
      }
    }

    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <TextInput value={props.value ?? undefined} onChange={props.setValue} allowClear={true} />
      </WidgetWrapper>
    );
  },
};

const customBooleanWidget: BooleanWidget<BasicConfig> = {
  type: `boolean`,
  factory: (props) => {
    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <Toggle size="SMALL" value={props.value ?? undefined} onChange={props.setValue} />
      </WidgetWrapper>
    );
  },
};

const customDateAndTimeWidget: DateTimeWidget<BasicConfig> = {
  type: `datetime`,
  factory: (props) => {
    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <DatePicker
          showTime
          value={props.value ? dayjs(props.value as any) : undefined}
          onChange={(v) => props.setValue(dayjs(v).valueOf() as any)}
        />
      </WidgetWrapper>
    );
  },
};

function getSelectOptions(
  props: BaseWidgetProps & SelectFieldSettings,
): Array<ListItem | string | number> {
  let listValues: Array<ListItem | string | number> = [];
  if (props.listValues == null) {
    listValues = [];
  } else if (Array.isArray(props.listValues)) {
    listValues = props.listValues;
  } else if (typeof props.listValues === 'object') {
    listValues = Object.entries(props.listValues).map(([key, value]) => ({
      title: humanizeAuto(key),
      value: value,
    }));
  }
  return listValues;
}

const customSelectWidget: SelectWidget<BasicConfig> = {
  type: `select`,
  factory: (props) => {
    let listValues = getSelectOptions(props);
    if (props.field.includes('country')) {
      listValues = omitCountryGroups(listValues);
    }
    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <Select
          autoTrim={true}
          dropdownMatchWidth={false}
          portaled={true}
          allowClear={true}
          options={
            listValues.map((x) => {
              if (typeof x === 'string' || typeof x === 'number') {
                return { label: x, value: x };
              }
              return { label: x.title, value: x.value };
            }) ?? []
          }
          value={props.value}
          onChange={props.setValue}
        />
      </WidgetWrapper>
    );
  },
};

const customMultiselectWidget: MultiSelectWidget<BasicConfig> = {
  type: `select`,
  factory: (props) => {
    const listValues = getSelectOptions(props);
    const isCountryField = props.field.includes('country');

    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <Select<string | number>
          portaled={true}
          mode={props.allowCustomValues ? 'TAGS' : 'MULTIPLE'}
          allowClear={true}
          options={
            listValues.map((x) => {
              if (typeof x === 'string' || typeof x === 'number') {
                return { label: x, value: x };
              }
              return { label: x.title, value: x.value };
            }) ?? []
          }
          value={
            isCountryField
              ? deserializeCountries(props.value as string[])
              : props.value ?? undefined
          }
          onChange={(newValue) => {
            props.setValue(isCountryField ? serializeCountries(newValue) : newValue);
          }}
        />
      </WidgetWrapper>
    );
  },
};

const customTimeWidget: DateTimeWidget<BasicConfig> = {
  type: `time`,
  jsonLogic: (val) => {
    if (typeof val === 'number') {
      return val;
    }
    if (typeof val === 'string') {
      const [hour, minute, second] = val.split(':');
      return Number(hour) * 3600 + Number(minute) * 60 + Number(second);
    }
    return val;
  },
  factory: (props) => {
    const currentTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { value, setValue } = props;
    const [hour, minute, second] = ((value ?? '') as string).split(':');
    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <TimePicker
          value={
            value
              ? moment.unix(
                  dayjs()
                    .utc()
                    .hour(Number(hour))
                    .minute(Number(minute))
                    .second(Number(second))
                    .unix(),
                )
              : undefined
          }
          onChange={(v) => {
            if (!v) {
              setValue(undefined);
              return;
            }
            const newValue = dayjs(v.valueOf()).utc().format('HH:mm:ss');
            setValue(newValue);
          }}
          placeholder=""
          suffixIcon={<Label label={currentTimeZone}></Label>}
          format={'HH:mm'}
          showNow={true}
        />
      </WidgetWrapper>
    );
  },
};

const customFieldWidget: FieldWidget<Config> = {
  valueSrc: 'field',
  formatValue: () => {}, // no need to format value
  factory: (props) => {
    const options = getFieldOptions(props.config?.fields ?? {}, props.field).filter((item) => {
      const lhsOnly = item.key.endsWith(LHS_ONLY_SYMBOL);
      const rhsOnly = item.key.endsWith(RHS_ONLY_SYMBOL);
      if (!lhsOnly && !rhsOnly && !isAnyInOpreator(props.operator)) {
        return true;
      }
      return rhsOnly && isAnyInOpreator(props.operator);
    });
    return (
      <FieldInput
        options={options.map((x) => ({ label: x.label, value: x.path }))}
        value={options.find((x) => x.path === props.value)?.label ?? undefined}
        onChange={(path) => {
          const item = options.find((x) => x.path === path);
          if (item?.path) {
            props.setValue(item.path);
          }
        }}
        showlabel={props.config?.settings.showLabels !== false}
      />
    );
  },
};

export const customWidgets: CoreWidgets<Config> = {
  ...BasicConfig.widgets,
  text: customTextWidget,
  number: customNumberWidget,
  // textarea: customTextareaWidget,
  // slider: customSliderWidget,
  // rangeslider: customRangesliderWidget,
  select: customSelectWidget,
  multiselect: customMultiselectWidget,
  // treeselect: customTreeselectWidget,
  // treemultiselect: customTreemultiselectWidget,
  // date: customDateWidget,
  time: customTimeWidget,
  datetime: customDateAndTimeWidget,
  boolean: customBooleanWidget,
  field: customFieldWidget,
  // func: customWidget,
  // case_value: customFieldWidget,
};
