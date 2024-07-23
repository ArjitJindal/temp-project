import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFiscalYearStart } from '@flagright/lib/utils/time';
import { isEqual, lowerCase, round } from 'lodash';
import { CURRENCIES_SELECT_OPTIONS, MINUTE_GROUP_SIZE } from '@flagright/lib/constants';
import { canAggregateMinute } from '@flagright/lib/rules-engine';
import pluralize from 'pluralize';
import { getAllValuesByKey } from '@flagright/lib/utils';
import { RuleLogicBuilder } from '../RuleLogicBuilder';
import { isTransactionAmountVariable, isTransactionOriginOrDestinationVariable } from '../helpers';
import s from './style.module.less';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import {
  CurrencyCode,
  RuleAggregationFunc,
  RuleAggregationTimeWindow,
  RuleAggregationTransactionDirection,
  RuleAggregationType,
  RuleAggregationUserDirection,
  RuleAggregationVariable,
  RuleAggregationVariableTimeWindow,
  RuleEntityVariable,
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
import { humanizeAuto } from '@/utils/humanize';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

function varLabelWithoutNamespace(label: string): string {
  return label.replace(/^.+\s*\/\s*/, '');
}
function varLabelWithoutDirection(label: string): string {
  return label.replace(/^(origin|destination)\s*/, '');
}

export type FormRuleAggregationVariable = Partial<RuleAggregationVariable> & {
  timeWindow: RuleAggregationVariableTimeWindow;
};
interface AggregationVariableFormProps {
  ruleType: RuleType;
  variable: FormRuleAggregationVariable;
  isNew: boolean;
  entityVariables: RuleEntityVariable[];
  readOnly?: boolean;
  onUpdate: (newAggregationVariable: RuleAggregationVariable) => void;
  onCancel: () => void;
}
const TYPE_OPTIONS: Array<{ value: RuleAggregationType; label: string }> = [
  { value: 'USER_TRANSACTIONS', label: 'User ID' },
  { value: 'PAYMENT_DETAILS_TRANSACTIONS', label: 'Payment ID' },
];
const USER_DIRECTION_OPTIONS: Array<{ value: RuleAggregationUserDirection; label: string }> = [
  { value: 'SENDER', label: 'Sender' },
  { value: 'RECEIVER', label: 'Receiver' },
  { value: 'SENDER_OR_RECEIVER', label: 'Both' },
];

const TX_DIRECTION_OPTIONS: Array<{ value: RuleAggregationTransactionDirection; label: string }> = [
  { value: 'SENDING', label: 'Sending' },
  { value: 'RECEIVING', label: 'Receiving' },
  { value: 'SENDING_RECEIVING', label: 'Both' },
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

const roundedTimeWindowMinutes = (timeWindow?: RuleAggregationVariableTimeWindow) => {
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
function getTimestamp(now: Dayjs, timeWindow: RuleAggregationTimeWindow) {
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
function validateAggregationTimeWindow(timeWindow: RuleAggregationVariableTimeWindow) {
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
        <b>{HOUR_GRANULARITY_MAX_DAYS} days</b>
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

export const AggregationVariableForm: React.FC<AggregationVariableFormProps> = ({
  ruleType,
  variable,
  entityVariables,
  isNew,
  readOnly,
  onUpdate,
  onCancel,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [formValues, setFormValues] = useState<FormRuleAggregationVariable>(variable);
  const settings = useSettings();
  const aggregateFieldOptions = useMemo(() => {
    return entityVariables
      .filter((v) => v.entity === 'TRANSACTION' && !isTransactionOriginOrDestinationVariable(v.key))
      .map((v) => ({
        value: v.key,
        // NOTE: Remove redundant namespace prefix as we only show transaction variables
        label: varLabelWithoutNamespace(v.uiDefinition.label),
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
    value: RuleAggregationFunc;
    label: string;
  }> = useMemo(() => {
    const options: Array<{ value: RuleAggregationFunc; label: string }> = [];
    const entityVariable = entityVariables.find((v) => v.key === formValues?.aggregationFieldKey);

    if (entityVariable?.valueType === 'number') {
      const numberValueOptions: Array<{ value: RuleAggregationFunc; label: string }> = [
        { value: 'AVG', label: 'Average' },
        { value: 'SUM', label: 'Sum' },
      ];
      options.push(...numberValueOptions);
    } else if (entityVariable?.key === 'TRANSACTION:transactionId') {
      options.push({ value: 'COUNT', label: 'Count' });
    } else if (entityVariable?.valueType === 'string') {
      const stringValueOptions: Array<{ value: RuleAggregationFunc; label: string }> = [
        { value: 'UNIQUE_COUNT', label: 'Unique count' },
        { value: 'UNIQUE_VALUES', label: 'Unique values' },
      ];
      options.push(...stringValueOptions);
    }
    return options;
  }, [entityVariables, formValues.aggregationFieldKey]);
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

  useEffect(() => {
    if (baseCurrencyRequired && !formValues.baseCurrency) {
      setFormValues((prevValues) => ({
        ...prevValues,
        baseCurrency: settings.defaultValues?.currency ?? 'USD',
      }));
    }
  }, [baseCurrencyRequired, formValues.baseCurrency, settings.defaultValues?.currency]);
  const isValidFormValues = useMemo(() => {
    return (
      formValues.type &&
      formValues.transactionDirection &&
      formValues.aggregationFieldKey &&
      (!baseCurrencyRequired || (baseCurrencyRequired && formValues.baseCurrency)) &&
      formValues.aggregationFunc &&
      !timeWindowValidationError
    );
  }, [
    baseCurrencyRequired,
    formValues.aggregationFieldKey,
    formValues.aggregationFunc,
    formValues.baseCurrency,
    formValues.transactionDirection,
    formValues.type,
    timeWindowValidationError,
  ]);
  const variableAutoName = useMemo(() => {
    if (isValidFormValues) {
      const aggVarDefinition = getAggVarDefinition(
        formValues as RuleAggregationVariable,
        entityVariables,
      );
      return aggVarDefinition.uiDefinition.label;
    }
    return 'Auto-generated if left empty';
  }, [entityVariables, formValues, isValidFormValues]);
  const handleUpdateForm = useCallback((newValues: Partial<FormRuleAggregationVariable>) => {
    setFormValues((prevValues) => ({ ...prevValues, ...newValues }));
  }, []);
  const [isOpen, setIsOpen] = useState(true);
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
        onUpdate(formValues as RuleAggregationVariable);
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
        <Label label="Variable name" required={{ value: false, showHint: true }}>
          <TextInput
            value={formValues.name}
            onChange={(name) => handleUpdateForm({ name })}
            placeholder={variableAutoName}
            allowClear
            testName="variable-name-v8"
          />
        </Label>
        <PropertyColumns>
          <Label label="Variable type" required={{ value: true, showHint: true }}>
            <SelectionGroup
              value={'TRANSACTION'}
              mode={'SINGLE'}
              options={[{ value: 'TRANSACTION', label: 'Transaction' }]}
            />
          </Label>
          {ruleType === 'TRANSACTION' && (
            <Label label="Check transactions for" required={{ value: true, showHint: true }}>
              <SelectionGroup
                value={formValues.type}
                onChange={(type) => handleUpdateForm({ type })}
                mode={'SINGLE'}
                options={TYPE_OPTIONS}
                testName="variable-type-v8"
              />
            </Label>
          )}
          {ruleType === 'TRANSACTION' && (
            <Label label={`Check for sender / receiver`} required={{ value: true, showHint: true }}>
              <SelectionGroup
                value={formValues.userDirection ?? 'SENDER_OR_RECEIVER'}
                onChange={(userDirection) => handleUpdateForm({ userDirection })}
                mode={'SINGLE'}
                options={USER_DIRECTION_OPTIONS}
                testName="variable-user-direction-v8"
              />
            </Label>
          )}
          <Label
            label={`Check for ${
              formValues.type === 'USER_TRANSACTIONS' ? 'user' : 'Payment ID'
            }'s past transaction direction`}
            required={{ value: true, showHint: true }}
          >
            <SelectionGroup
              value={formValues.transactionDirection ?? 'SENDING_RECEIVING'}
              onChange={(transactionDirection) => handleUpdateForm({ transactionDirection })}
              mode={'SINGLE'}
              options={TX_DIRECTION_OPTIONS}
              testName="variable-tx-direction-v8"
            />
          </Label>
          <>
            <Label
              label={
                formValues.transactionDirection === 'SENDING_RECEIVING'
                  ? 'Sending aggregate Field'
                  : 'Aggregate field'
              }
              required={{ value: true, showHint: true }}
              testId="variable-aggregate-field-v8"
            >
              <Select<string>
                value={formValues.aggregationFieldKey}
                onChange={(aggregationFieldKey) =>
                  handleUpdateForm({ aggregationFieldKey, aggregationFunc: undefined })
                }
                mode="SINGLE"
                options={aggregateFieldOptions}
              />
            </Label>
            {formValues.transactionDirection === 'SENDING_RECEIVING' && (
              <Label
                label="Receiving aggregate Field"
                required={{ value: true, showHint: true }}
                testId="variable-aggregate-field-v8"
              >
                <Select<string>
                  isDisabled={!formValues.aggregationFieldKey}
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
          <Label
            label="Aggregate function"
            required={{ value: true, showHint: true }}
            testId="variable-aggregate-function-v8"
          >
            <Select<RuleAggregationFunc>
              value={formValues.aggregationFunc}
              onChange={(aggregationFunc) => handleUpdateForm({ aggregationFunc })}
              mode="SINGLE"
              options={aggregateFunctionOptions}
            />
            {formValues.aggregationFunc === 'UNIQUE_VALUES' && (
              <Hint isError={false}>
                {'The current transaction entity value will not be included in the aggregate'}
              </Hint>
            )}
          </Label>
          <Label
            label="Group by"
            hint="Group by a field to get the aggregate value for each unique value of this field. For example, If you group by 'transaction type' with 'Count' as the aggregate function, you will get the count of transactions for each unique transaction type."
            testId="variable-aggregate-groupby-field-v8"
            required={{ value: false, showHint: true }}
          >
            <Select<string>
              value={formValues.aggregationGroupByFieldKey}
              onChange={(aggregationGroupByFieldKey) =>
                handleUpdateForm({ aggregationGroupByFieldKey })
              }
              mode="SINGLE"
              options={aggregateGroupByFieldOptions}
            />
          </Label>
          {/* TODO (v8): Base currency design TBD */}
          {baseCurrencyRequired && (
            <Label label="Base currency" required={{ value: true, showHint: true }}>
              <Select<string>
                value={formValues.baseCurrency}
                onChange={(baseCurrency) =>
                  handleUpdateForm({ baseCurrency: baseCurrency as CurrencyCode })
                }
                mode="SINGLE"
                placeholder="Select base currency"
                options={CURRENCIES_SELECT_OPTIONS}
              />
            </Label>
          )}
          <div className={s.timeWindow}>
            <VariableTimeWindow
              value={formValues.timeWindow}
              onChange={(newValue) => {
                newValue = roundedTimeWindowMinutes(newValue);
                handleUpdateForm({
                  timeWindow: newValue,
                });
              }}
            />
          </div>
        </PropertyColumns>
        {timeWindowValidationError && <Alert type="error">{timeWindowValidationError}</Alert>}
        <div>
          {!formValues.filtersLogic && !showFilters ? (
            <Link to="" onClick={() => setShowFilters(true)}>
              Add filters
            </Link>
          ) : (
            <Label label="Filters">
              <RuleLogicBuilder
                ruleType={ruleType}
                entityVariableTypes={[
                  'TRANSACTION',
                  'TRANSACTION_EVENT',
                  'BUSINESS_USER',
                  'CONSUMER_USER',
                  'USER',
                ]}
                jsonLogic={formValues.filtersLogic}
                // NOTE: Only entity variables are allowed for aggregation variable filters
                aggregationVariables={[]}
                onChange={(jsonLogic) => {
                  if (!isEqual(jsonLogic, formValues.filtersLogic)) {
                    handleUpdateForm({ filtersLogic: jsonLogic });
                  }
                }}
              />
            </Label>
          )}
        </div>
        <AggregationVariableSummary
          ruleType={ruleType}
          variableFormValues={formValues}
          entityVariables={entityVariables}
        />
      </Card.Section>
    </Modal>
  );
};

interface AggregationVariableSummaryProps {
  ruleType: RuleType;
  variableFormValues: FormRuleAggregationVariable;
  entityVariables: RuleEntityVariable[];
}

function formatTimeWindow(timeWindow: RuleAggregationTimeWindow): string {
  if (timeWindow.granularity === 'all_time') {
    return 'the beginning of time';
  }
  if (timeWindow.granularity === 'now' || timeWindow.units === 0) {
    return 'now';
  }
  return `${timeWindow.units} ${pluralize(
    lowerCase(humanizeAuto(timeWindow.granularity)),
    timeWindow.units,
  )} ago`;
}

const AggregationVariableSummary: React.FC<AggregationVariableSummaryProps> = ({
  ruleType,
  variableFormValues,
  entityVariables,
}) => {
  const {
    type,
    userDirection,
    transactionDirection,
    aggregationFieldKey,
    aggregationGroupByFieldKey,
    aggregationFunc,
    timeWindow,
    filtersLogic,
  } = variableFormValues;

  if (
    !type ||
    !userDirection ||
    !transactionDirection ||
    !aggregationFieldKey ||
    !aggregationFunc ||
    !timeWindow
  ) {
    return (
      <Alert type="info" size="m">
        Variable summary
        <br />
        N/A
      </Alert>
    );
  }
  const aggFuncLabel = humanizeAuto(aggregationFunc);
  const aggregationFieldVariable = entityVariables.find((v) => v.key === aggregationFieldKey);
  const aggregationGroupByFieldVariable = aggregationGroupByFieldKey
    ? entityVariables.find((v) => v.key === aggregationGroupByFieldKey)
    : undefined;
  let aggFieldLabel =
    aggregationFunc === 'COUNT'
      ? undefined
      : pluralize(
          lowerCase(varLabelWithoutNamespace(aggregationFieldVariable?.uiDefinition.label)),
        );
  if (aggFieldLabel && transactionDirection === 'SENDING_RECEIVING') {
    aggFieldLabel = varLabelWithoutDirection(aggFieldLabel);
  }
  const aggGroupByFieldLabel =
    aggregationGroupByFieldVariable &&
    lowerCase(varLabelWithoutNamespace(aggregationGroupByFieldVariable.uiDefinition.label));
  const txDirectionLabel =
    transactionDirection === 'SENDING'
      ? 'sending'
      : transactionDirection === 'RECEIVING'
      ? 'receiving'
      : 'sending or receiving';
  const userDirectionLabel =
    ruleType === 'TRANSACTION'
      ? userDirection === 'SENDER'
        ? 'sender '
        : userDirection === 'RECEIVER'
        ? 'receiver '
        : 'sender or receiver '
      : '';
  const userLabel = type === 'USER_TRANSACTIONS' ? 'user' : 'payment ID';
  const filtersCount = filtersLogic?.and?.length ?? filtersLogic?.or?.length ?? 0;

  const textComponents = [
    <b>{aggFuncLabel}</b>,
    'of',
    aggFieldLabel ? <b>{aggFieldLabel}</b> : undefined,
    aggFieldLabel ? 'in' : undefined,
    <b>{txDirectionLabel} transactions</b>,
    aggGroupByFieldLabel ? (
      <span>
        (with the same <b>{aggGroupByFieldLabel}</b>)
      </span>
    ) : undefined,
    'by a',
    <b>
      {userDirectionLabel}
      {userLabel}
    </b>,
    'from',
    <b>{formatTimeWindow(timeWindow.end)}</b>,
    'to',
    <b>{formatTimeWindow(timeWindow.start)}</b>,
    filtersLogic
      ? `(with ${filtersCount} ${pluralize('filter', filtersCount)} applied)`
      : undefined,
  ].filter(Boolean);

  return (
    <Alert type="info" size="m">
      Variable summary
      <br />
      {textComponents.map((v, i) => (
        <span key={i}>{v} </span>
      ))}
    </Alert>
  );
};
