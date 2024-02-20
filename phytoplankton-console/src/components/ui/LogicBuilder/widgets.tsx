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
} from '@react-awesome-query-builder/ui';
import DatePicker from '../DatePicker';
import { deserializeCountries, omitCountryGroups, serializeCountries } from './widget-utils';
import { humanizeAuto } from '@/utils/humanize';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';
import Label from '@/components/library/Label';
import NumberInput from '@/components/library/NumberInput';
import Toggle from '@/components/library/Toggle';
import Slider, { CommonProps as SliderCommonProps } from '@/components/library/Slider';
import { dayjs } from '@/utils/dayjs';
import { RuleOperatorType } from '@/apis';

function WidgetWrapper(props: {
  widgetFactoryProps: WidgetProps<BasicConfig>;
  children: React.ReactNode;
}) {
  const showLabel = props.widgetFactoryProps.config?.settings.showLabels !== false;
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
    const operator = props.operator as RuleOperatorType;
    if (
      operator === 'op:inlist' ||
      operator === 'op:!inlist' ||
      operator === 'select_any_in' ||
      operator === 'select_not_any_in'
    ) {
      // TODO (V8): Create a ListSelect component which loads whitelist/blacklist from server
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
    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <TextInput value={props.value ?? undefined} onChange={props.setValue} allowClear={true} />
      </WidgetWrapper>
    );
  },
};

const customSliderWidget: NumberWidget<BasicConfig> = {
  type: `text`,
  factory: (props) => {
    const commonProps: SliderCommonProps = {
      min: props.min,
      max: props.max,
      step: props.step,
    };
    if (Array.isArray(props.value)) {
      return (
        <WidgetWrapper widgetFactoryProps={props}>
          <Slider
            {...commonProps}
            mode={'RANGE'}
            value={[props.value?.[0] ?? 0, props.value?.[1] ?? 100]}
            onChange={props.setValue}
          />
        </WidgetWrapper>
      );
    }
    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <Slider
          {...commonProps}
          mode={'SINGLE'}
          value={props.value ?? undefined}
          onChange={props.setValue}
        />
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

export const customWidgets: CoreWidgets<Config> = {
  ...BasicConfig.widgets,
  text: customTextWidget,
  number: customNumberWidget,
  // textarea: customTextareaWidget,
  slider: customSliderWidget,
  // rangeslider: customRangesliderWidget,
  select: customSelectWidget,
  multiselect: customMultiselectWidget,
  // treeselect: customTreeselectWidget,
  // treemultiselect: customTreemultiselectWidget,
  // date: customDateWidget,
  // time: customTimeWidget,
  datetime: customDateAndTimeWidget,
  boolean: customBooleanWidget,
  // field: customWidget,
  // func: customWidget,
  // case_value: customFieldWidget,
};
