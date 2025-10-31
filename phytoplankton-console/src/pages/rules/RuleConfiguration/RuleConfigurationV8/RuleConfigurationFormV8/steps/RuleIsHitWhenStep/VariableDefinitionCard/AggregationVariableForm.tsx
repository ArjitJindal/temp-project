import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { firstLetterUpper, humanizeConstant } from '@flagright/lib/utils/humanize';
import { getFiscalYearStart } from '@flagright/lib/utils/time';
import { round } from 'lodash';
import { CURRENCIES_SELECT_OPTIONS, MINUTE_GROUP_SIZE } from '@flagright/lib/constants';
import { canAggregateMinute } from '@flagright/lib/rules-engine';
import { getAllValuesByKey } from '@flagright/lib/utils';
import VariableFilters from 'src/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/VariableFilters';
import { isTransactionAmountVariable, isTransactionOriginOrDestinationVariable } from '../helpers';
import s from './style.module.less';
import AggregationVariableSummary from './AggregationVariableSummary';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import {
  CurrencyCode,
  LogicAggregationFunc,
  LogicAggregationTimeWindow,
  LogicAggregationTransactionDirection,
  LogicAggregationType,
  LogicAggregationUserDirection,
  LogicAggregationVariable,
  LogicAggregationVariableTimeWindow,
  LogicEntityVariable,
  RuleType,
} from '@/apis';
import Select from '@/components/library/Select';
import SelectionGroup from '@/components/library/SelectionGroup';

// TODO: Move PropertyColumns to library
import { PropertyColumns } from '@/pages/users-item/UserDetails/PropertyColumns';

import TextInput from '@/components/library/TextInput';
import { Dayjs, dayjs } from '@/utils/dayjs';
import Alert from '@/components/library/Alert';
import VariableTimeWindow from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/VariableTimeWindow';
import { getAggVarDefinition } from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/RuleParametersStep/utils';
import { Hint } from '@/components/library/Form/InputField';
import Modal from '@/components/library/Modal';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import NumberInput from '@/components/library/NumberInput';
import {
  FormRuleAggregationVariable,
  varLabelWithoutNamespace,
} from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/helpers';
import { StatePair } from '@/utils/state';
import { useIsChanged } from '@/utils/hooks';

interface AggregationVariableFormProps {
  ruleType: RuleType;
  variable: FormRuleAggregationVariable;
  isNew: boolean;
  entityVariables: LogicEntityVariable[];
  readOnly?: boolean;
  onUpdate: (newAggregationVariable: LogicAggregationVariable) => void;
  onCancel: () => void;
}

const USER_DIRECTION_OPTIONS: Array<{ value: LogicAggregationUserDirection; label: string }> = [
  { value: 'SENDER', label: 'Sender' },
  { value: 'RECEIVER', label: 'Receiver' },
  { value: 'SENDER_OR_RECEIVER', label: 'Both' },
];

const TX_DIRECTION_OPTIONS: Array<{ value: LogicAggregationTransactionDirection; label: string }> =
  [
    { value: 'SENDING', label: 'Sending' },
    { value: 'RECEIVING', label: 'Receiving' },
    { value: 'SENDING_RECEIVING', label: 'Both' },
  ];

const AGGREGATE_TARGET_OPTIONS = [
  { value: 'TIME', label: 'Time' },
  { value: 'LAST_N', label: "Last 'N' transactions" },
];

const BOOLEAN_OPTIONS = [
  {
    value: true,
    label: 'Yes',
  },
  {
    value: false,
    label: 'No',
  },
];

function swapOriginAndDestination(text?: string): string {
  if (!text) {
    return '';
  }
  return text.replace(/(origin|destination)/g, (match) => {
    return match === 'origin' ? 'destination' : 'origin';
  });
}
function roundToNearestMultiple(value: number, step: number) {
  return round(value / step) * step;
}

const roundedTimeWindowMinutes = (timeWindow?: LogicAggregationVariableTimeWindow) => {
  if (!timeWindow) {
    return timeWindow;
  }
  const { start, end } = timeWindow;
  if (start.granularity === 'minute' || end.granularity === 'minute') {
    if (canAggregateMinute(start.granularity, start.units, end.granularity, end.units)) {
      start.units =
        start.granularity === 'hour'
          ? start.units
          : roundToNearestMultiple(start.units, MINUTE_GROUP_SIZE);
      end.units =
        start.granularity === 'all_time' || end.granularity === 'hour'
          ? end.units
          : roundToNearestMultiple(end.units, MINUTE_GROUP_SIZE);
    }
  }
  return { start, end };
};

const MAX_AGGREGATION_FROM_YEARS = 5;
const MAX_AGGREGATED_TRANSACTIONS = 10;
function getTimestamp(now: Dayjs, timeWindow: LogicAggregationTimeWindow) {
  if (timeWindow.granularity === 'fiscal_year') {
    if (!timeWindow.fiscalYear) {
      throw new Error('Missing fiscal year');
    }
    return getFiscalYearStart(now, timeWindow.fiscalYear).subtract(timeWindow.units, 'year');
  } else if (timeWindow.granularity === 'all_time') {
    return now.subtract(MAX_AGGREGATION_FROM_YEARS, 'year');
  } else if (timeWindow.granularity === 'now') {
    return now;
  }
  return now.subtract(timeWindow.units, timeWindow.granularity);
}

const LESS_THAN_HOUR_GRANULARITY_MAX_HOURS = 1;
const HOUR_GRANULARITY_MAX_DAYS = 60;
function validateAggregationTimeWindow(timeWindow: LogicAggregationVariableTimeWindow) {
  const { start, end } = timeWindow;
  const now = dayjs();
  const startTs = getTimestamp(now, start);
  const endTs = getTimestamp(now, end);

  if (startTs.valueOf() >= endTs.valueOf()) {
    return (
      <>
        <b>Time to</b> should be earlier than <b>Time from</b>
      </>
    );
  }
  const granularities = new Set([start.granularity, end.granularity]);
  if (
    (granularities.has('minute') || granularities.has('second')) &&
    endTs.diff(startTs, 'hour', true) > LESS_THAN_HOUR_GRANULARITY_MAX_HOURS
  ) {
    return (
      <>
        For <b>Minute</b> / <b>Second</b> granularity, the total duration cannot exceed{' '}
        <b>{LESS_THAN_HOUR_GRANULARITY_MAX_HOURS} hour</b>
      </>
    );
  }
  if (granularities.has('hour') && endTs.diff(startTs, 'day', true) > HOUR_GRANULARITY_MAX_DAYS) {
    return (
      <>
        For <b>Hour</b> granularity, the total duration cannot exceed{' '}
        <b>{HOUR_GRANULARITY_MAX_DAYS} days</b>
      </>
    );
  }

  if (
    granularities.has('day') &&
    start.rollingBasis &&
    endTs.diff(startTs, 'day', true) > HOUR_GRANULARITY_MAX_DAYS
  ) {
    return (
      <>
        For <b>Day</b> granularity with rolling basis, the total duration cannot exceed{' '}
        <b>{HOUR_GRANULARITY_MAX_DAYS} days due to time granularity down to the second.</b>
      </>
    );
  }
  if (endTs.diff(startTs, 'year', true) > MAX_AGGREGATION_FROM_YEARS) {
    return (
      <>
        The total duration cannot exceed <b>{MAX_AGGREGATION_FROM_YEARS} years</b>
      </>
    );
  }
  return null;
}

export const AggregationVariableFormContent: React.FC<
  Pick<AggregationVariableFormProps, 'ruleType' | 'entityVariables' | 'readOnly'> & {
    onValidFormValues?: (isValidFormValues: boolean) => void;
    formValuesState: StatePair<FormRuleAggregationVariable>;
    hideFilters?: boolean;
    hideSummary?: boolean;
  }
> = ({
  onValidFormValues,
  formValuesState,
  ruleType,
  entityVariables,
  readOnly,
  hideFilters = false,
  hideSummary = false,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [formValues, setFormValues] = formValuesState;
  const [aggregateByLastN, setAggregateByLastN] = useState(!!formValues.lastNEntities);
  const settings = useSettings();
  const hasCustomAggregationFields = useFeatureEnabled('CUSTOM_AGGREGATION_FIELDS');

  const TYPE_OPTIONS: Array<{ value: LogicAggregationType; label: string }> = [
    {
      value: 'USER_TRANSACTIONS' as LogicAggregationType,
      label: `${firstLetterUpper(settings.userAlias)} ID`,
    },
    { value: 'PAYMENT_DETAILS_TRANSACTIONS' as LogicAggregationType, label: 'Payment ID' },
    ...(hasCustomAggregationFields
      ? [
          { value: 'PAYMENT_DETAILS_ADDRESS' as LogicAggregationType, label: 'Address' },
          { value: 'PAYMENT_DETAILS_EMAIL' as LogicAggregationType, label: 'Email' },
          { value: 'PAYMENT_DETAILS_NAME' as LogicAggregationType, label: 'Name' },
        ]
      : []),
  ];

  const aggregateFieldOptions = useMemo(() => {
    return entityVariables
      .filter((v) => v.entity === 'TRANSACTION' && !isTransactionOriginOrDestinationVariable(v.key))
      .map((v) => ({
        value: v.key,
        // NOTE: Remove redundant namespace prefix as we only show transaction variables
        label: varLabelWithoutNamespace(v.uiDefinition.label),
      }));
  }, [entityVariables]);
  const arrayOfObjectsVars = useMemo(() => {
    return entityVariables
      .filter(
        (v) =>
          v.entity === 'TRANSACTION' &&
          !isTransactionOriginOrDestinationVariable(v.key) &&
          v.uiDefinition.type === '!group',
      )
      .map((v) => ({
        key: v.key,
        options: Object.entries(v?.uiDefinition.subfields)
          .map(([key, value]: [string, any]) => ({
            value: key,
            label: value.label,
          }))
          .filter((x) => !(v.key.endsWith('tags') && x.value === 'value')),
      }));
  }, [entityVariables]);

  const aggregateGroupByFieldOptions = useMemo(() => {
    return entityVariables
      .filter(
        (v) =>
          v.entity === 'TRANSACTION' &&
          !isTransactionOriginOrDestinationVariable(v.key) &&
          (v.valueType === 'string' || isTransactionAmountVariable(v.key)) &&
          v.key !== formValues.aggregationFieldKey &&
          v.key !== 'TRANSACTION:transactionId',
      )
      .map((v) => ({
        value: v.key,
        // NOTE: Remove redundant namespace prefix as we only show transaction variables
        label: varLabelWithoutNamespace(v.uiDefinition.label),
      }));
  }, [entityVariables, formValues.aggregationFieldKey]);
  const secondaryAggregationKeyOptions = useMemo(() => {
    if (!formValues.aggregationFieldKey) {
      return [];
    }
    const entityVariable = entityVariables.find((v) => v.key === formValues.aggregationFieldKey);
    const label = varLabelWithoutNamespace(entityVariable?.uiDefinition.label);
    const originRegex = /origin/i;
    const destinationRegex = /destination/i;
    if (!entityVariable) {
      return [];
    }
    if (!originRegex.test(entityVariable.key) && !destinationRegex.test(entityVariable.key)) {
      return [
        {
          value: entityVariable.key,
          label: label,
        },
      ];
    } else {
      return [
        {
          value: entityVariable.key,
          label: label,
        },
        {
          value: swapOriginAndDestination(entityVariable.key),
          label: swapOriginAndDestination(label),
        },
      ];
    }
  }, [formValues.aggregationFieldKey, entityVariables]);
  const aggregateFunctionOptions: Array<{
    value: LogicAggregationFunc;
    label: string;
  }> = useMemo(() => {
    const options: Array<{ value: LogicAggregationFunc; label: string }> = [];
    const entityVariable = entityVariables.find((v) => v.key === formValues?.aggregationFieldKey);

    const uniqueAggregationOptions: Array<{ value: LogicAggregationFunc; label: string }> = [
      { value: 'UNIQUE_COUNT', label: 'Unique count' },
      { value: 'UNIQUE_VALUES', label: 'Unique values' },
      { value: 'CHANGE_COUNT', label: 'Count of changes' },
    ];
    const timestampEntityRegex = /timestamp/gi;
    const tagsVariableRegex = /tags$/;

    if (entityVariable?.valueType === 'number') {
      const numberValueOptions: Array<{ value: LogicAggregationFunc; label: string }> = [
        { value: 'AVG', label: 'Average' },
        { value: 'SUM', label: 'Sum' },
        {
          value: 'MIN',
          label: 'Min',
        },
        {
          value: 'MAX',
          label: 'Max',
        },
        {
          value: 'STDEV',
          label: 'Standard deviation',
        },
      ];
      options.push(...numberValueOptions);

      // Timestamps are high cardinality entities, and we ideally want to
      // exclude them for unique aggregations
      if (!timestampEntityRegex.test(entityVariable?.key)) {
        options.push(...uniqueAggregationOptions);
      }
    } else if (entityVariable?.key === 'TRANSACTION:transactionId') {
      options.push({ value: 'COUNT', label: 'Count' });
      // we can use unique values for transaction id only if Last N is selected
      if (formValues.lastNEntities) {
        options.push({ value: 'UNIQUE_VALUES', label: 'Unique values' });
      }
    } else if (entityVariable?.valueType === 'string') {
      options.push(...uniqueAggregationOptions);
    } else if (tagsVariableRegex.test(entityVariable?.key ?? '')) {
      options.push(...uniqueAggregationOptions);
    }
    return options;
  }, [entityVariables, formValues.aggregationFieldKey, formValues.lastNEntities]);
  const timeWindowValidationError = useMemo<ReactNode>(() => {
    return validateAggregationTimeWindow(formValues.timeWindow);
  }, [formValues.timeWindow]);
  const baseCurrencyRequired = useMemo(() => {
    const hasTxAmountInFilters = Boolean(
      getAllValuesByKey<string>('var', formValues.filtersLogic).find(isTransactionAmountVariable),
    );

    const isAggFieldTxAmount = formValues.aggregationFieldKey
      ? isTransactionAmountVariable(formValues.aggregationFieldKey)
      : false;

    const isGroupByFieldTxAmount = formValues.aggregationGroupByFieldKey
      ? isTransactionAmountVariable(formValues.aggregationGroupByFieldKey)
      : false;

    return hasTxAmountInFilters || isAggFieldTxAmount || isGroupByFieldTxAmount;
  }, [
    formValues.aggregationFieldKey,
    formValues.filtersLogic,
    formValues.aggregationGroupByFieldKey,
  ]);

  const selectedArrayOfObjectsVar = useMemo(() => {
    return arrayOfObjectsVars.find((v) => v.key === formValues.aggregationFieldKey);
  }, [arrayOfObjectsVars, formValues.aggregationFieldKey]);

  useEffect(() => {
    if (baseCurrencyRequired && !formValues.baseCurrency) {
      setFormValues((prevValues) => ({
        ...prevValues,
        baseCurrency: settings.defaultValues?.currency ?? 'USD',
      }));
    }
    if (!selectedArrayOfObjectsVar) {
      setFormValues((prevValues) => ({
        ...prevValues,
        aggregationFilterFieldKey: undefined,
        aggregationFilterFieldValue: undefined,
      }));
    }
  }, [
    setFormValues,
    baseCurrencyRequired,
    formValues.baseCurrency,
    settings.defaultValues?.currency,
    selectedArrayOfObjectsVar,
  ]);
  const lastNEntitiesValidation = useMemo(() => {
    if (formValues.lastNEntities == null && !aggregateByLastN) {
      return true;
    }
    return (
      formValues.lastNEntities != null &&
      formValues.lastNEntities > 0 &&
      formValues.lastNEntities <= MAX_AGGREGATED_TRANSACTIONS
    );
  }, [formValues.lastNEntities, aggregateByLastN]);
  const arrayOfObjectsVarFilterFieldValidation = useMemo(() => {
    if (selectedArrayOfObjectsVar) {
      if (selectedArrayOfObjectsVar.key.endsWith('tags')) {
        return Boolean(
          formValues.aggregationFilterFieldKey && formValues.aggregationFilterFieldValue,
        );
      }
      return Boolean(formValues.aggregationFilterFieldKey);
    }
    return true;
  }, [
    selectedArrayOfObjectsVar,
    formValues.aggregationFilterFieldKey,
    formValues.aggregationFilterFieldValue,
  ]);
  const isValidFormValues = useMemo(() => {
    return !!(
      formValues.type &&
      formValues.transactionDirection &&
      formValues.aggregationFieldKey &&
      (!baseCurrencyRequired || (baseCurrencyRequired && formValues.baseCurrency)) &&
      formValues.aggregationFunc &&
      !timeWindowValidationError &&
      lastNEntitiesValidation &&
      arrayOfObjectsVarFilterFieldValidation
    );
  }, [
    baseCurrencyRequired,
    formValues.aggregationFieldKey,
    formValues.aggregationFunc,
    formValues.baseCurrency,
    formValues.transactionDirection,
    formValues.type,
    timeWindowValidationError,
    lastNEntitiesValidation,
    arrayOfObjectsVarFilterFieldValidation,
  ]);

  const isValidChanged = useIsChanged(isValidFormValues);
  useEffect(() => {
    if (isValidChanged) {
      onValidFormValues?.(isValidFormValues);
    }
  }, [isValidFormValues, isValidChanged, onValidFormValues]);

  const variableAutoName = useMemo(() => {
    if (isValidFormValues) {
      const aggVarDefinition = getAggVarDefinition(
        formValues as LogicAggregationVariable,
        entityVariables,
      );
      return aggVarDefinition.uiDefinition.label;
    }
    return 'Auto-generated if left empty';
  }, [entityVariables, formValues, isValidFormValues]);
  const handleUpdateForm = useCallback(
    (newValues: Partial<FormRuleAggregationVariable>) => {
      setFormValues((prevValues) => ({ ...prevValues, ...newValues }));
    },
    [setFormValues],
  );

  return (
    <>
      {!readOnly && (
        <Label label="Variable name" required={{ value: false, showHint: !readOnly }}>
          <TextInput
            value={formValues.name}
            onChange={(name) => handleUpdateForm({ name })}
            placeholder={variableAutoName}
            allowClear
            testName="variable-name-v8"
            isDisabled={readOnly}
          />
        </Label>
      )}
      <PropertyColumns>
        <Label label="Variable type" required={{ value: true, showHint: !readOnly }}>
          <SelectionGroup
            value={'TRANSACTION'}
            mode={'SINGLE'}
            options={[{ value: 'TRANSACTION', label: 'Transaction' }]}
            isDisabled={readOnly}
          />
        </Label>
        {ruleType === 'TRANSACTION' && (
          <Label label="Check transactions for" required={{ value: true, showHint: !readOnly }}>
            <Select<LogicAggregationType>
              mode="SINGLE"
              value={formValues.type}
              onChange={(type) => handleUpdateForm({ type })}
              options={TYPE_OPTIONS}
              isDisabled={readOnly}
              testId="variable-type-v8"
            />
          </Label>
        )}
        {ruleType === 'TRANSACTION' && (
          <Label
            label={`Check for sender / receiver`}
            required={{ value: true, showHint: !readOnly }}
          >
            <SelectionGroup
              value={formValues.userDirection ?? 'SENDER_OR_RECEIVER'}
              onChange={(userDirection) => handleUpdateForm({ userDirection })}
              mode={'SINGLE'}
              options={USER_DIRECTION_OPTIONS}
              testName="variable-user-direction-v8"
              isDisabled={readOnly}
            />
          </Label>
        )}
        <Label
          label={`Check for ${
            formValues.type === 'USER_TRANSACTIONS'
              ? `${settings.userAlias} transactions`
              : 'transactions'
          }'s past transaction direction`}
          required={{ value: true, showHint: !readOnly }}
        >
          <SelectionGroup
            value={formValues.transactionDirection ?? 'SENDING_RECEIVING'}
            onChange={(transactionDirection) => handleUpdateForm({ transactionDirection })}
            mode={'SINGLE'}
            options={TX_DIRECTION_OPTIONS}
            testName="variable-tx-direction-v8"
            isDisabled={readOnly}
          />
        </Label>
        <>
          <Label
            label={
              formValues.transactionDirection === 'SENDING_RECEIVING'
                ? 'Sending aggregate Field'
                : 'Aggregate field'
            }
            required={{ value: true, showHint: !readOnly }}
            testId="variable-aggregate-field-v8"
          >
            <Select<string>
              value={formValues.aggregationFieldKey}
              onChange={(aggregationFieldKey) =>
                handleUpdateForm({ aggregationFieldKey, aggregationFunc: undefined })
              }
              mode="SINGLE"
              options={aggregateFieldOptions}
              isDisabled={readOnly}
            />
          </Label>
          {formValues.transactionDirection === 'SENDING_RECEIVING' && (
            <Label
              label="Receiving aggregate Field"
              required={{ value: true, showHint: !readOnly }}
              testId="variable-aggregate-field-v8"
            >
              <Select<string>
                isDisabled={!formValues.aggregationFieldKey || readOnly}
                value={formValues.secondaryAggregationFieldKey ?? formValues.aggregationFieldKey}
                onChange={(secondaryAggregationFieldKey) =>
                  handleUpdateForm({ secondaryAggregationFieldKey, aggregationFunc: undefined })
                }
                mode="SINGLE"
                options={secondaryAggregationKeyOptions}
              />
              {!formValues.aggregationFieldKey && (
                <Hint isError={false}>Select sending key first</Hint>
              )}
            </Label>
          )}
        </>
        <div>
          <Label
            label="Aggregate function"
            required={{ value: true, showHint: !readOnly }}
            testId="variable-aggregate-function-v8"
          >
            <Select<LogicAggregationFunc>
              isDisabled={readOnly}
              value={formValues.aggregationFunc}
              onChange={(aggregationFunc) =>
                handleUpdateForm(
                  aggregationFunc === 'UNIQUE_VALUES'
                    ? { aggregationFunc, includeCurrentEntity: false }
                    : { aggregationFunc },
                )
              }
              mode="SINGLE"
              options={aggregateFunctionOptions}
            />
          </Label>
          {(formValues.aggregationFunc === 'UNIQUE_COUNT' ||
            formValues.aggregationFunc === 'UNIQUE_VALUES') && (
            <div className={s.hint}>
              {`For performance reasons ${humanizeConstant(
                formValues.aggregationFunc,
              ).toLowerCase()}
              aggregation is limited to 25,000. Contact us to increase this limit.`}
            </div>
          )}
        </div>
        {selectedArrayOfObjectsVar && (
          <Label label="Filter key" required={{ value: true, showHint: true }}>
            <Select<string>
              value={formValues.aggregationFilterFieldKey}
              onChange={(aggregationFilterFieldKey) =>
                handleUpdateForm({ aggregationFilterFieldKey })
              }
              mode="SINGLE"
              options={selectedArrayOfObjectsVar?.options}
            />
          </Label>
        )}
        {selectedArrayOfObjectsVar && selectedArrayOfObjectsVar.key.endsWith('tags') && (
          <Label label="Filter value" required={{ value: true, showHint: true }}>
            <TextInput
              value={formValues.aggregationFilterFieldValue}
              onChange={(aggregationFilterFieldValue) =>
                handleUpdateForm({ aggregationFilterFieldValue })
              }
            />
          </Label>
        )}
        <Label
          label="Group by"
          hint="Group by a field to get the aggregate value for each unique value of this field. For example, If you group by 'transaction type' with 'Count' as the aggregate function, you will get the count of transactions for each unique transaction type."
          testId="variable-aggregate-groupby-field-v8"
          required={{ value: false, showHint: !readOnly }}
        >
          <Select<string>
            value={formValues.aggregationGroupByFieldKey}
            onChange={(aggregationGroupByFieldKey) =>
              handleUpdateForm({ aggregationGroupByFieldKey })
            }
            mode="SINGLE"
            options={aggregateGroupByFieldOptions}
            isDisabled={readOnly}
          />
        </Label>
        {/* TODO (v8): Base currency design TBD */}
        {baseCurrencyRequired ? (
          <Label label="Base currency" required={{ value: true, showHint: !readOnly }}>
            <Select<string>
              value={formValues.baseCurrency}
              onChange={(baseCurrency) =>
                handleUpdateForm({ baseCurrency: baseCurrency as CurrencyCode })
              }
              mode="SINGLE"
              placeholder="Select base currency"
              options={CURRENCIES_SELECT_OPTIONS}
              isDisabled={readOnly}
            />
          </Label>
        ) : (
          <></>
        )}
      </PropertyColumns>
      <PropertyColumns>
        <Label label={`Aggregate target`} required={{ value: true, showHint: !readOnly }}>
          <SelectionGroup
            isDisabled={readOnly}
            value={aggregateByLastN ? 'LAST_N' : 'TIME'}
            onChange={(transactionDirection) => {
              const val = transactionDirection === 'LAST_N';
              setAggregateByLastN(val);
              handleUpdateForm(
                val
                  ? {
                      lastNEntities: 5,
                      timeWindow: {
                        start: {
                          units: 0,
                          granularity: 'all_time',
                        },
                        end: {
                          units: 0,
                          granularity: 'now',
                        },
                      },
                    }
                  : {
                      lastNEntities: undefined,
                      timeWindow: {
                        start: {
                          units: 1,
                          granularity: 'day',
                        },
                        end: {
                          units: 0,
                          granularity: 'now',
                        },
                      },
                    },
              );
            }}
            mode={'SINGLE'}
            options={AGGREGATE_TARGET_OPTIONS}
            testName="aggregate-target-v8"
          />
        </Label>

        {ruleType !== 'USER' && (
          <Label
            label={`Include current transaction`}
            required={{ value: true, showHint: !readOnly }}
          >
            <SelectionGroup
              value={formValues.includeCurrentEntity ?? true}
              onChange={(includeCurrentEntity) => {
                handleUpdateForm({
                  includeCurrentEntity,
                });
              }}
              mode={'SINGLE'}
              options={BOOLEAN_OPTIONS}
              testName="aggregate-target-v8"
              isDisabled={readOnly}
            />
          </Label>
        )}
        {!aggregateByLastN && (
          <div className={s.timeWindow}>
            <VariableTimeWindow
              isDisabled={readOnly}
              value={formValues.timeWindow}
              onChange={(newValue) => {
                newValue = roundedTimeWindowMinutes(newValue);
                handleUpdateForm({
                  timeWindow: newValue,
                });
              }}
            />
          </div>
        )}
        {aggregateByLastN && (
          <Label
            label="Transactions count"
            hint="Can aggregate up to last 10 transactions."
            required={{ value: true, showHint: !readOnly }}
          >
            <NumberInput
              isDisabled={readOnly}
              value={formValues.lastNEntities}
              onChange={(lastNEntities) => handleUpdateForm({ lastNEntities })}
              placeholder="Enter number of transactions"
              isError={!lastNEntitiesValidation}
              max={MAX_AGGREGATED_TRANSACTIONS}
            />
          </Label>
        )}
        {!aggregateByLastN && (
          <Label
            label="Use event timestamp for aggregation"
            hint="When enabled, transaction event timestamps will be used for time-based aggregation instead of transaction timestamp."
            required={{ value: false, showHint: !readOnly }}
          >
            <SelectionGroup
              value={formValues.useEventTimestamp ?? false}
              onChange={(useEventTimestamp) => {
                handleUpdateForm({
                  useEventTimestamp,
                });
              }}
              mode={'SINGLE'}
              options={BOOLEAN_OPTIONS}
              isDisabled={readOnly}
            />
          </Label>
        )}
      </PropertyColumns>
      {timeWindowValidationError && <Alert type="ERROR">{timeWindowValidationError}</Alert>}
      {!hideFilters && (
        <div>
          {!formValues.filtersLogic && !showFilters && !readOnly ? (
            <Link to="" onClick={() => setShowFilters(true)}>
              Add filters
            </Link>
          ) : (
            <Label label="Filters">
              <VariableFilters
                entityVariableTypes={[
                  'TRANSACTION',
                  'TRANSACTION_EVENT',
                  'BUSINESS_USER',
                  'CONSUMER_USER',
                  'USER',
                ]}
                formValuesState={[formValues, setFormValues]}
                ruleType={ruleType}
                readOnly={readOnly}
                settings={{
                  removeEmptyRulesOnLoad: true,
                }}
              />
            </Label>
          )}
        </div>
      )}
      {!hideSummary && (
        <Alert type="INFO">
          Variable summary
          <br />
          <AggregationVariableSummary
            ruleType={ruleType}
            variableFormValues={formValues}
            entityVariables={entityVariables}
          />
        </Alert>
      )}
    </>
  );
};

export const AggregationVariableForm = (props: AggregationVariableFormProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const { isNew, readOnly, variable, onCancel, onUpdate } = props;
  const [formValues, setFormValues] = useState<FormRuleAggregationVariable>(() => {
    // For other rules, keep existing behavior
    return {
      ...variable,
      includeCurrentEntity: variable.includeCurrentEntity ?? true,
    };
  });

  const [isValidFormValues, setIsValidFormValues] = useState(false);
  return (
    <Modal
      title="Aggregation variable"
      isOpen={isOpen}
      onCancel={() => {
        setIsOpen(false);
        onCancel();
      }}
      width="L"
      hideOk={readOnly}
      onOk={() => {
        onUpdate(formValues as LogicAggregationVariable);
        setIsOpen(false);
      }}
      okText={isNew ? 'Add' : 'Update'}
      okProps={{ isDisabled: !isValidFormValues }}
      disablePadding
      subTitle="
      An aggregate variable summarizes multiple values from a dataset using operations like sum,
      average, count, maximum, or minimum"
    >
      <Card.Section direction="vertical">
        <AggregationVariableFormContent
          {...props}
          formValuesState={[formValues, setFormValues]}
          onValidFormValues={setIsValidFormValues}
        />
      </Card.Section>
    </Modal>
  );
};
