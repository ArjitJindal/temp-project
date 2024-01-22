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
import { CoreWidgets, Config, BasicConfig, BaseWidgetProps } from '@react-awesome-query-builder/ui';
import { humanizeAuto } from '@/utils/humanize';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';
import Label from '@/components/library/Label';
import NumberInput from '@/components/library/NumberInput';
import Toggle from '@/components/library/Toggle';
import Slider, { CommonProps as SliderCommonProps } from '@/components/library/Slider';

function WidgetWrapper(props: { widgetFactoryProps: WidgetProps; children: React.ReactNode }) {
  return <Label label={'Value'}>{props.children}</Label>;
}

const customNumberWidget: NumberWidget = {
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

const customTextWidget: TextWidget = {
  type: `text`,
  factory: (props) => {
    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <TextInput value={props.value ?? undefined} onChange={props.setValue} allowClear={true} />
      </WidgetWrapper>
    );
  },
};

const customSliderWidget: NumberWidget = {
  type: `text`,
  factory: (props) => {
    const commonProps: SliderCommonProps = {
      min: props.min,
      max: props.max,
      step: props.step,
      marks: props.marks,
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

const customBooleanWidget: BooleanWidget = {
  type: `boolean`,
  factory: (props) => {
    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <Toggle size="SMALL" value={props.value ?? undefined} onChange={props.setValue} />
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

const customSelectWidget: SelectWidget = {
  type: `select`,
  factory: (props) => {
    const listValues = getSelectOptions(props);
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

const customMultiselectWidget: MultiSelectWidget = {
  type: `select`,
  factory: (props) => {
    const listValues = getSelectOptions(props);
    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <Select<string | number>
          portaled={true}
          mode="MULTIPLE"
          allowClear={true}
          options={
            listValues.map((x) => {
              if (typeof x === 'string' || typeof x === 'number') {
                return { label: x, value: x };
              }
              return { label: x.title, value: x.value };
            }) ?? []
          }
          value={props.value ?? undefined}
          onChange={(newValue) => {
            props.setValue(newValue as string[] | number[] | undefined);
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
  // datetime: customDatetimeWidget,
  boolean: customBooleanWidget,
  // field: customWidget,
  // func: customWidget,
  // case_value: customFieldWidget,
};
