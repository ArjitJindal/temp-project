import {
  FieldSettings,
  ListItem,
  SelectFieldSettings,
  TextWidgetProps,
  WidgetProps,
} from '@react-awesome-query-builder/core';
import {
  AsyncListValues,
  BasicConfig,
  Config,
  CoreWidgets,
  FieldWidget,
  MultiSelectFieldSettings,
  Operator,
} from '@react-awesome-query-builder/ui';
import moment from 'moment';
import { TimePicker } from 'antd';
import { useState, useEffect } from 'react';
import { isArray, isEmpty } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
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
  isCustomOperator,
  MULTI_SELECT_BUILTIN_OPERATORS,
  MULTI_SELECT_LIST_OPERATORS,
  REGEX_MATCH_OPERATORS,
} from './operators';
import { FieldInput, isViewMode, LHS_ONLY_SYMBOL, RHS_ONLY_SYMBOL } from './helpers';
import { isValidRegex } from './functions';
import { MultiListSelectDynamic, SingleListSelectDynamic } from './ListSelectDynamic';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';
import Label from '@/components/library/Label';
import NumberInput from '@/components/library/NumberInput';
import Toggle from '@/components/library/Toggle';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { LogicOperatorType, TransactionsUniquesField, UsersUniquesField } from '@/apis';
import PropertyInput from '@/components/library/JsonSchemaEditor/Property/PropertyInput';
import { ExtendedSchema } from '@/components/library/JsonSchemaEditor/types';
import Tooltip from '@/components/library/Tooltip';
import Slider from '@/components/library/Slider';
import { QueryBuilderConfig } from '@/components/ui/LogicBuilder/types';
import ViewModeTags from '@/components/ui/LogicBuilder/ViewModeTags';
import VariableInfoPopover from '@/components/ui/LogicBuilder/VariableInfoPopover';
import { message } from '@/components/library/Message';
import { useGetAlias } from '@/components/AppWrapper/Providers/SettingsProvider';

type FieldSettingsWithUniqueType = FieldSettings & {
  uniqueType?: TransactionsUniquesField;
  allowNewValues?: boolean;
};

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

const isTransactionKeyField = (
  entityKey: TextWidgetProps['field'],
  props: TextWidgetProps['config'],
): boolean => {
  if (typeof entityKey === 'string') {
    const field = entityKey.split('.')[0];
    const fieldData = props.fields[field] as any;
    if (fieldData?.fieldSettings) {
      const { uniqueType } = fieldData.fieldSettings;
      if (uniqueType) {
        return uniqueType.startsWith('TRANSACTION_');
      }
      return true;
    }
  }
  return false;
};

function isTagsValueField(field: TextWidgetProps['field'], uniqueType?: string): boolean {
  const result =
    uniqueType === 'TAGS_VALUE' && typeof field === 'string' && field.endsWith('.value');
  return result;
}

function isTagsKeyField(field: TextWidgetProps['field'], uniqueType?: string): boolean {
  const result = uniqueType === 'TAGS_KEY' && typeof field === 'string' && field.endsWith('.key');
  return result;
}

const tagKeyStore: Record<string, string> = {};
const valueFieldForceUpdateCallbacks: Record<string, Set<() => void>> = {};

function setTagKeyValue(entityId: string, keyValue: string | undefined) {
  const previousValue = tagKeyStore[entityId];

  if (keyValue) {
    tagKeyStore[entityId] = keyValue;
  } else {
    delete tagKeyStore[entityId];
  }

  // If the key value changed, trigger all value field callbacks for this entity
  if (previousValue !== keyValue) {
    const callbacks = valueFieldForceUpdateCallbacks[entityId];
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach((callback) => callback());
    }
  }
}

function registerValueFieldForceUpdate(entityId: string, callback: () => void) {
  if (!valueFieldForceUpdateCallbacks[entityId]) {
    valueFieldForceUpdateCallbacks[entityId] = new Set();
  }
  valueFieldForceUpdateCallbacks[entityId].add(callback);

  return () => {
    const callbacks = valueFieldForceUpdateCallbacks[entityId];
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        delete valueFieldForceUpdateCallbacks[entityId];
      }
    }
  };
}

function getTagKeyValue(entityId: string): string | undefined {
  const keyValue = tagKeyStore[entityId];
  return keyValue;
}

function getEntityIdFromField(fieldPath: string): string | undefined {
  if (
    typeof fieldPath === 'string' &&
    (fieldPath.endsWith('.key') || fieldPath.endsWith('.value'))
  ) {
    return fieldPath.replace(/\.(key|value)$/, '');
  }
  return undefined;
}

// Component wrapper for value fields that need to update when key changes
function DynamicValueFieldWrapper(props: {
  entityId: string;
  children: (keyFilter: string | undefined, forceUpdateTrigger: number) => React.ReactNode;
}) {
  const [forceUpdateTrigger, setForceUpdateTrigger] = useState(0);
  const keyFilter = getTagKeyValue(props.entityId);

  useEffect(() => {
    const cleanup = registerValueFieldForceUpdate(props.entityId, () => {
      setForceUpdateTrigger((prev) => prev + 1);
    });
    return cleanup;
  }, [props.entityId]);

  return <>{props.children(keyFilter, forceUpdateTrigger)}</>;
}

function WidgetWrapper(props: {
  widgetFactoryProps: WidgetProps<Config>;
  children: React.ReactNode;
}) {
  const { widgetFactoryProps } = props;
  const tooltip = widgetFactoryProps.fieldDefinition?.tooltip ?? '';
  if (isOperatorParameterField(widgetFactoryProps)) {
    const operator = getOperator(widgetFactoryProps);
    if (!operator || !operator.parameters) {
      return null;
    }
    const parameterValues = (
      Array.isArray(widgetFactoryProps.value) ? widgetFactoryProps.value : []
    ).slice(0, operator.parameters.length);
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

  return (
    <Label
      label={
        <div className={s.label}>
          Value
          {tooltip && (
            <Tooltip title={tooltip} placement="top">
              <InformationLineIcon className={s.icon} />
            </Tooltip>
          )}
        </div>
      }
      testId={'value-source'}
    >
      {props.children}
    </Label>
  );
}

const customNumberWidget: CoreWidgets['number'] = {
  type: `number`,
  factory: (props) => {
    let value: number | undefined;
    if (Array.isArray(props.value)) {
      console.warn(`This widget doesn't support array values, using first item `);
      value = props.value?.[0] ?? undefined;
    } else {
      value = props.value ?? undefined;
    }

    if (isViewMode(props.config)) {
      return <ViewModeTags>{[value]}</ViewModeTags>;
    }

    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <NumberInput value={value} onChange={(v) => props.setValue(v ?? 0)} allowClear={true} />
      </WidgetWrapper>
    );
  },
};

const customTextWidget: CoreWidgets['text'] = {
  type: `text`,
  factory: (props) => {
    const isEnumType = !isEmpty((props as SelectFieldSettings).listValues);
    const operator = props.operator as LogicOperatorType;
    // All text-type operators should support multi-values
    const isArrayType =
      (MULTI_SELECT_BUILTIN_OPERATORS.includes(operator) || isCustomOperator(operator)) &&
      !REGEX_MATCH_OPERATORS.includes(operator);

    // NOTE: As we apply some hacks to allow comparing a text value with multiple text values, we cannot
    // rely on react-awesome-query-builder to clear value when the changed operator is not compatible with
    // the existing value. So we need to clear the value by ourselves when switching between text and array.
    if (isArrayType) {
      if (!isArray(props.value)) {
        setTimeout(() => props.setValue(undefined), 0);
      }
    } else {
      if (isArray(props.value)) {
        setTimeout(() => props.setValue(undefined), 0);
      }
    }

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

    const fieldSettings = props.fieldDefinition.fieldSettings as FieldSettingsWithUniqueType;

    if (fieldSettings?.uniqueType?.length && fieldSettings?.allowNewValues) {
      const uniqueTypeProps = getUniqueTypeProps(
        props.field,
        props.config,
        fieldSettings.uniqueType,
      );

      const isKeyField = isTagsKeyField(props.field, fieldSettings.uniqueType);
      const isValueField = isTagsValueField(props.field, fieldSettings.uniqueType);

      if (isKeyField) {
        const entityId = getEntityIdFromField(String(props.field));
        if (entityId) {
          const keyValue =
            typeof props.value === 'string' ? props.value : String(props.value || '');
          setTagKeyValue(entityId, keyValue);
        }
      } else if (isValueField) {
        const entityId = getEntityIdFromField(String(props.field));
        if (entityId) {
          return (
            <DynamicValueFieldWrapper entityId={entityId}>
              {(dynamicKeyFilter) => {
                const keyValue = getTagKeyValue(entityId);
                const currentValue = !keyValue ? undefined : props.value;
                if (!keyValue) {
                  props.setValue(undefined);
                }

                if (isArrayType) {
                  return (
                    <WidgetWrapper widgetFactoryProps={{ ...props, allowCustomValues: true }}>
                      <MultiListSelectDynamic
                        uniqueTypeProps={uniqueTypeProps}
                        value={currentValue as any}
                        onChange={(newValue) => {
                          const formattedValue = newValue?.map((v) => v.trim());
                          props.setValue(formattedValue as any);
                        }}
                        filter={dynamicKeyFilter}
                      />
                    </WidgetWrapper>
                  );
                }
                return (
                  <WidgetWrapper widgetFactoryProps={{ ...props, allowCustomValues: true }}>
                    <SingleListSelectDynamic
                      uniqueTypeProps={uniqueTypeProps}
                      value={currentValue}
                      onChange={(val) => props.setValue(val)}
                      filter={dynamicKeyFilter}
                    />
                  </WidgetWrapper>
                );
              }}
            </DynamicValueFieldWrapper>
          );
        }
      }

      if (MULTI_SELECT_BUILTIN_OPERATORS.includes(props.operator as LogicOperatorType)) {
        return (
          <WidgetWrapper widgetFactoryProps={{ ...props, allowCustomValues: true }}>
            <MultiListSelectDynamic
              uniqueTypeProps={uniqueTypeProps}
              value={props.value as any}
              onChange={(newValue) => {
                if (isKeyField) {
                  const entityId = getEntityIdFromField(String(props.field));
                  if (entityId) {
                    const keyValue =
                      typeof props.value === 'string' ? props.value : String(props.value || '');

                    setTagKeyValue(entityId, keyValue);
                  }
                }
                const formattedValue = newValue?.map((v) => v.trim());
                props.setValue(formattedValue as any);
              }}
            />
          </WidgetWrapper>
        );
      }
      if (isArrayType) {
        return (
          <WidgetWrapper widgetFactoryProps={{ ...props, allowCustomValues: true }}>
            <MultiListSelectDynamic
              uniqueTypeProps={uniqueTypeProps}
              value={props.value as any}
              onChange={(newValue) => {
                const formattedValue = newValue?.map((v) => v.trim());
                props.setValue(formattedValue as any);
              }}
            />
          </WidgetWrapper>
        );
      }
      return (
        <WidgetWrapper widgetFactoryProps={{ ...props, allowCustomValues: true }}>
          <SingleListSelectDynamic
            uniqueTypeProps={uniqueTypeProps}
            value={props.value as string}
            onChange={(val) => {
              if (isKeyField) {
                const entityId = getEntityIdFromField(String(props.field));
                if (entityId) {
                  const keyValue =
                    typeof props.value === 'string' ? props.value : String(props.value || '');

                  setTagKeyValue(entityId, keyValue);
                }
              }
              return props.setValue(val);
            }}
          />
        </WidgetWrapper>
      );
    }

    if (isEnumType) {
      const validateValue = props.validateValue;
      if (MULTI_SELECT_BUILTIN_OPERATORS.includes(props.operator)) {
        return customMultiselectWidget.factory({
          ...props,
          value: Array.isArray(props.value) ? props.value : [],
          setValue(val: null | undefined | string[] | number[], asyncListValues?: AsyncListValues) {
            return props.setValue(val as unknown as string, asyncListValues);
          },
          validateValue(val, ...rest) {
            return validateValue
              ? val.every((x) =>
                  validateValue?.call(this, typeof x === 'string' ? x : `${x}`, ...rest),
                )
              : true;
          },
        });
      } else {
        return customSelectWidget.factory({
          ...props,
          validateValue: function (val, ...rest) {
            return validateValue
              ? validateValue.call(this, typeof val === 'string' ? val : `${val}`, ...rest)
              : true;
          },
        });
      }
    }

    if (isViewMode(props.config)) {
      return <ViewModeTags>{[props.value]}</ViewModeTags>;
    }

    if (isArrayType) {
      return (
        <WidgetWrapper widgetFactoryProps={props}>
          <Select
            mode={'MULTIPLE_DYNAMIC'}
            allowClear={true}
            options={[]}
            value={(props.value as any) ?? undefined}
            onChange={(newValue) => {
              const formattedValue = newValue?.map((v) => v.trim());
              props.setValue(formattedValue as any);
            }}
          />
        </WidgetWrapper>
      );
    }

    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <TextInput
          value={props.value ?? undefined}
          onChange={props.setValue}
          allowClear={true}
          onBlur={() => {
            if (REGEX_MATCH_OPERATORS.includes(operator) && props.value) {
              const isValid = isValidRegex(props.value);
              if (!isValid) {
                message.error('Invalid regular expression to match');
                props.setValue(undefined);
              }
            }
          }}
        />
      </WidgetWrapper>
    );
  },
};

const customBooleanWidget: CoreWidgets['boolean'] = {
  type: `boolean`,
  factory: (props) => {
    if (props.value === undefined) {
      setTimeout(() => {
        props.setValue(false);
      }, 2);
    }

    if (isViewMode(props.config)) {
      return <ViewModeTags>{props.value && [String(props.value)]}</ViewModeTags>;
    }

    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <div style={{ marginTop: 5 }}>
          <Toggle size="S" value={props.value ?? false} onChange={props.setValue} />
        </div>
      </WidgetWrapper>
    );
  },
};

const customDateAndTimeWidget: CoreWidgets['datetime'] = {
  type: `datetime`,
  // This fixes the default JsonLogic conversion, when datetime converted to
  // ISO-string, even if function parameter are not datetime
  jsonLogic: (value) => {
    return value;
  },
  jsonLogicImport: (value) => {
    return value;
  },
  factory: (props) => {
    const dayjsValue = props.value ? dayjs(props.value as any) : undefined;

    if (isViewMode(props.config)) {
      return <ViewModeTags>{dayjsValue?.format(DEFAULT_DATE_TIME_FORMAT)}</ViewModeTags>;
    }

    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <DatePicker
          showTime
          value={dayjsValue}
          onChange={(v) => props.setValue(dayjs(v).valueOf() as any)}
        />
      </WidgetWrapper>
    );
  },
};

function getSelectOptions(
  props: SelectFieldSettings | MultiSelectFieldSettings,
  getAlias: ReturnType<typeof useGetAlias>,
): Array<ListItem | string | number> {
  let listValues: Array<ListItem | string | number> = [];
  if (props.listValues == null) {
    listValues = [];
  } else if (Array.isArray(props.listValues)) {
    listValues = props.listValues.map((x) => {
      return {
        title: getAlias(x.value),
        value: x.value,
      };
    });
  } else if (typeof props.listValues === 'object') {
    listValues = Object.entries(props.listValues).map(
      ([key, value]): ListItem => ({
        title: humanizeAuto(key),
        value: value as string | number,
      }),
    );
  }
  return listValues;
}

function SelectWidget(props: any) {
  const getAlias = useGetAlias();
  let listValues = getSelectOptions(props, getAlias);
  if (props.field.includes('country')) {
    listValues = omitCountryGroups(listValues);
  }
  const options =
    listValues.map((x) => {
      if (typeof x === 'string' || typeof x === 'number') {
        return { label: x, value: x };
      }
      return { label: x.title, value: x.value };
    }) ?? [];
  if (isViewMode(props.config)) {
    const option = options.find((x) => x.value === props.value);
    return <ViewModeTags>{[option?.label ?? props.value]}</ViewModeTags>;
  }

  const fieldSettings = props.fieldDefinition.fieldSettings as FieldSettingsWithUniqueType;

  if (fieldSettings?.uniqueType?.length && fieldSettings?.allowNewValues) {
    const uniqueTypeProps = getUniqueTypeProps(props.field, props.config, fieldSettings.uniqueType);

    return (
      <WidgetWrapper widgetFactoryProps={{ ...props, allowCustomValues: true }}>
        <SingleListSelectDynamic
          uniqueTypeProps={uniqueTypeProps}
          value={props.value as string}
          onChange={(val) => props.setValue(val)}
        />
      </WidgetWrapper>
    );
  }

  return (
    <WidgetWrapper widgetFactoryProps={props}>
      <Select allowClear={true} options={options} value={props.value} onChange={props.setValue} />
    </WidgetWrapper>
  );
}

const customSelectWidget: CoreWidgets['select'] = {
  type: `select`,
  factory: (props) => {
    return <SelectWidget {...props} />;
  },
};

function MultiSelectWidget(props: any) {
  const getAlias = useGetAlias();
  const listValues = getSelectOptions(props, getAlias);
  const isCountryField = props.field?.includes('country');

  const options =
    listValues.map((x) => {
      if (typeof x === 'string' || typeof x === 'number') {
        return { label: x, value: x };
      }
      return { label: x.title, value: x.value };
    }) ?? [];

  const value: (string | number)[] | undefined =
    isCountryField && isArray(props.value)
      ? deserializeCountries(props.value as string[])
      : props.value ?? undefined;

  if (MULTI_SELECT_LIST_OPERATORS.includes(props.operator as LogicOperatorType)) {
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

  const fieldSettings = props.fieldDefinition.fieldSettings as FieldSettingsWithUniqueType;

  if (fieldSettings?.uniqueType?.length && fieldSettings?.allowNewValues) {
    const uniqueTypeProps = getUniqueTypeProps(props.field, props.config, fieldSettings.uniqueType);

    return (
      <WidgetWrapper widgetFactoryProps={{ ...props, allowCustomValues: true }}>
        <MultiListSelectDynamic
          uniqueTypeProps={uniqueTypeProps}
          value={props.value as string[]}
          onChange={(val) => props.setValue(val)}
        />
      </WidgetWrapper>
    );
  }

  if (isViewMode(props.config)) {
    return (
      <ViewModeTags>
        {value
          ? options.filter((x) => value?.includes(x.value) ?? false).map(({ label }) => label)
          : null}
      </ViewModeTags>
    );
  }

  return (
    <WidgetWrapper widgetFactoryProps={props}>
      <Select
        mode={props.allowCustomValues ? 'MULTIPLE_DYNAMIC' : 'MULTIPLE'}
        allowClear={true}
        options={options}
        value={value}
        onChange={(newValue) => {
          props.setValue(
            isCountryField ? serializeCountries(newValue?.map((x) => `${x}`)) : newValue,
          );
        }}
      />
    </WidgetWrapper>
  );
}

const customMultiselectWidget: CoreWidgets['multiselect'] = {
  type: `select`,
  factory: (props) => {
    return <MultiSelectWidget {...props} />;
  },
};

const customTimeWidget: CoreWidgets['time'] = {
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

    const timestamp = value
      ? dayjs().utc().hour(Number(hour)).minute(Number(minute)).second(Number(second)).unix()
      : undefined;

    if (isViewMode(props.config)) {
      return (
        <ViewModeTags>
          {timestamp && dayjs(timestamp).format(DEFAULT_DATE_TIME_FORMAT)}
        </ViewModeTags>
      );
    }

    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <TimePicker
          value={timestamp ? moment.unix(timestamp) : undefined}
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

const customSliderWidget: CoreWidgets['slider'] = {
  type: `number`,
  factory: (props) => {
    if (isViewMode(props.config)) {
      return <ViewModeTags>{[props.value]}</ViewModeTags>;
    }
    return (
      <WidgetWrapper widgetFactoryProps={props}>
        <Slider
          mode={'SINGLE'}
          min={props.min}
          max={props.max}
          value={typeof props.value === 'number' ? props.value : undefined}
          onChange={(value) => {
            props.setValue(value);
          }}
        />
      </WidgetWrapper>
    );
  },
};

const customFieldWidget: FieldWidget<Config> = {
  valueSrc: 'field',
  factory: (props) => {
    const options = getFieldOptions(
      props.config?.fields ?? {},
      props.field,
      props.fieldDefinition.type,
    ).filter((item) => {
      const lhsOnly = item.key.endsWith(LHS_ONLY_SYMBOL);
      const rhsOnly = item.key.endsWith(RHS_ONLY_SYMBOL);
      if (!lhsOnly && !rhsOnly && !isAnyInOpreator(props.operator)) {
        return true;
      }
      return rhsOnly && isAnyInOpreator(props.operator);
    });
    const finalOptions = options.map((x) => ({ label: x.label, value: x.path }));
    const finalValue = options.find((x) => x.path === props.value)?.path ?? undefined;

    const queryBuilderConfig = props.config as QueryBuilderConfig;
    if (isViewMode(queryBuilderConfig)) {
      const { variableColors, onClickVariable } = queryBuilderConfig.settings;
      const selectedOption = finalOptions.find((x) => x.value === finalValue);
      return (
        <VariableInfoPopover onClick={props.value && (() => onClickVariable?.(props.value))}>
          <ViewModeTags color={variableColors?.[props.value]}>
            {selectedOption?.label ?? finalValue}
          </ViewModeTags>
        </VariableInfoPopover>
      );
    }
    return (
      <FieldInput
        options={finalOptions}
        value={finalValue}
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

function wrapDefaultWidget(widget) {
  return {
    ...widget,
    factory: (props, ctx) => {
      return (
        <WidgetWrapper widgetFactoryProps={props}>{widget.factory?.(props, ctx)}</WidgetWrapper>
      );
    },
  };
}

function getUniqueTypeProps(
  field: TextWidgetProps['field'],
  config: TextWidgetProps['config'],
  uniqueType: TransactionsUniquesField | UsersUniquesField,
) {
  const type = isTransactionKeyField(field, config) ? 'transactions' : 'users';
  return type === 'transactions'
    ? {
        type: 'transactions' as const,
        uniqueType: uniqueType as TransactionsUniquesField,
      }
    : {
        type: 'users' as const,
        uniqueType: uniqueType as UsersUniquesField,
      };
}

export const customWidgets: CoreWidgets = {
  ...BasicConfig.widgets,
  text: customTextWidget,
  number: customNumberWidget,
  textarea: wrapDefaultWidget(BasicConfig.widgets.textarea),
  slider: customSliderWidget,
  rangeslider: wrapDefaultWidget(BasicConfig.widgets.rangeslider),
  select: customSelectWidget,
  multiselect: customMultiselectWidget,
  treeselect: wrapDefaultWidget(BasicConfig.widgets.treeselect),
  treemultiselect: wrapDefaultWidget(BasicConfig.widgets.treemultiselect),
  date: wrapDefaultWidget(BasicConfig.widgets.date),
  time: customTimeWidget,
  datetime: customDateAndTimeWidget,
  boolean: customBooleanWidget,
  field: customFieldWidget,
  // func: wrapDefaultWidget(BasicConfig.widgets.rangeslider),
  // case_value: wrapWidget(BasicConfig.widgets.case_value),
} as CoreWidgets;
