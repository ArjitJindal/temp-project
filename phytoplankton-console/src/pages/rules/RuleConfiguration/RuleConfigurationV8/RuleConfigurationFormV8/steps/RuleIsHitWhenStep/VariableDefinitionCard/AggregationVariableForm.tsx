import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFiscalYearStart } from '@flagright/lib/utils/time';
import { isEqual } from 'lodash';
import { CURRENCIES_SELECT_OPTIONS } from '@flagright/lib/constants';
import { RuleLogicBuilder } from '../RuleLogicBuilder';
import { isTransactionAmountVariable } from '../helpers';
import s from './style.module.less';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import {
  CurrencyCode,
  RuleAggregationFunc,
  RuleAggregationTransactionDirection,
  RuleAggregationType,
  RuleAggregationUserDirection,
  RuleAggregationVariable,
  RuleAggregationVariableTimeWindow,
  RuleEntityVariable,
} from '@/apis';
import Select from '@/components/library/Select';
import SelectionGroup from '@/components/library/SelectionGroup';

// TODO: Move PropertyColumns to library
import { PropertyColumns } from '@/pages/users-item/UserDetails/PropertyColumns';
import Button from '@/components/library/Button';
import TextInput from '@/components/library/TextInput';
import { dayjs } from '@/utils/dayjs';
import Alert from '@/components/library/Alert';
import VariableTimeWindow from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/VariableTimeWindow';
import { getAggVarDefinition } from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/RuleParametersStep/utils';
import { Hint } from '@/components/library/Form/InputField';

export type FormRuleAggregationVariable = Partial<RuleAggregationVariable> & {
  timeWindow: RuleAggregationVariableTimeWindow;
};
interface AggregationVariableFormProps {
  variable: FormRuleAggregationVariable;
  isNew: boolean;
  entityVariables: RuleEntityVariable[];
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
  if (!text) return '';
  return text.replace(/(origin|destination)/g, (match) => {
    return match === 'origin' ? 'destination' : 'origin';
  });
}

export const AggregationVariableForm: React.FC<AggregationVariableFormProps> = ({
  variable,
  entityVariables,
  isNew,
  onUpdate,
  onCancel,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [formValues, setFormValues] = useState<FormRuleAggregationVariable>(variable);
  const aggregateFieldOptions = useMemo(() => {
    return entityVariables
      .filter((v) => v.entity === 'TRANSACTION')
      .map((v) => ({
        value: v.key,
        // NOTE: Remove redundant namespace prefix as we only show transaction variables
        label: v.uiDefinition.label.replace(/^Transaction\s*\/\s*/, ''),
      }));
  }, [entityVariables]);
  const secondaryAggregationKeyOptions = useMemo(() => {
    if (!formValues.aggregationFieldKey) return [];
    const entityVariable = entityVariables.find((v) => v.key === formValues.aggregationFieldKey);
    const label = entityVariable?.uiDefinition.label.replace(/^Transaction\s*\/\s*/, '');
    const originRegex = /origin/i;
    const destinationRegex = /destination/i;
    if (!entityVariable) return [];
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
    const entityVariable = entityVariables.find((v) => v.key === formValues.aggregationFieldKey);

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
  const isValidTimeWindow = useMemo(() => {
    const { start, end } = formValues.timeWindow;
    let startTs;
    let endTs;
    if (start.granularity === 'fiscal_year') {
      if (start.fiscalYear != null) {
        startTs = getFiscalYearStart(dayjs(), start.fiscalYear).subtract(start.units, 'year');
      }
    } else if (start.granularity === 'all_time' || start.granularity === 'now') {
      startTs = start.granularity === 'all_time' ? dayjs().subtract(5, 'year') : dayjs(); // start CANNOT be now
    } else {
      startTs = dayjs().subtract(start.units, start.granularity);
    }

    if (end.granularity === 'fiscal_year') {
      if (end.fiscalYear != null) {
        endTs = getFiscalYearStart(dayjs(), end.fiscalYear).subtract(end.units, 'year');
      }
    } else if (end.granularity === 'now' || end.granularity === 'all_time') {
      endTs = end.granularity === 'now' ? dayjs() : dayjs(); // end CANNOT be all_time
    } else {
      endTs = dayjs().subtract(end.units, end.granularity);
    }
    if (startTs == null || endTs == null) {
      return false;
    }
    return startTs.valueOf() < endTs.valueOf();
  }, [formValues.timeWindow]);
  const isValidFormValues = useMemo(() => {
    const isTxAmount = formValues.aggregationFieldKey
      ? isTransactionAmountVariable(formValues.aggregationFieldKey)
      : false;
    return (
      formValues.type &&
      formValues.transactionDirection &&
      formValues.aggregationFieldKey &&
      (!isTxAmount || (isTxAmount && formValues.baseCurrency)) &&
      formValues.aggregationFunc &&
      isValidTimeWindow
    );
  }, [
    formValues.aggregationFieldKey,
    formValues.aggregationFunc,
    formValues.baseCurrency,
    formValues.transactionDirection,
    formValues.type,
    isValidTimeWindow,
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
  return (
    <>
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
          <Label label="Check transactions for" required={{ value: true, showHint: true }}>
            <SelectionGroup
              value={formValues.type}
              onChange={(type) => handleUpdateForm({ type })}
              mode={'SINGLE'}
              options={TYPE_OPTIONS}
              testName="variable-type-v8"
            />
          </Label>
          <Label label={`Check for sender / receiver`} required={{ value: true, showHint: true }}>
            <SelectionGroup
              value={formValues.userDirection ?? 'SENDER_OR_RECEIVER'}
              onChange={(userDirection) => handleUpdateForm({ userDirection })}
              mode={'SINGLE'}
              options={USER_DIRECTION_OPTIONS}
              testName="variable-user-direction-v8"
            />
          </Label>
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
          {/* TODO (v8): Base currency design TBD */}
          {formValues.aggregationFieldKey &&
            isTransactionAmountVariable(formValues.aggregationFieldKey) && (
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
            <Label
              label="Time window"
              required={{ value: true, showHint: true }}
              testId="time-from-to"
            >
              <VariableTimeWindow
                value={formValues.timeWindow}
                onChange={(newValue) => {
                  handleUpdateForm({
                    timeWindow: newValue,
                  });
                }}
              />
            </Label>
          </div>
        </PropertyColumns>
        {!isValidTimeWindow && (
          <Alert type="error">
            <b>Time to</b> should be earlier than <b>Time from</b>
          </Alert>
        )}
        <div>
          {!formValues.filtersLogic && !showFilters ? (
            <Link to="" onClick={() => setShowFilters(true)}>
              Add filters
            </Link>
          ) : (
            <Label label="Filters">
              <RuleLogicBuilder
                entityVariableTypes={['TRANSACTION']}
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
      </Card.Section>
      <Card.Section direction="horizontal">
        <Button
          type="PRIMARY"
          onClick={() => onUpdate(formValues as RuleAggregationVariable)}
          isDisabled={!isValidFormValues}
          testName={`${isNew ? 'add' : 'update'}-variable-v8`}
        >
          {isNew ? 'Add' : 'Update'}
        </Button>
        <Button type="SECONDARY" onClick={onCancel}>
          Cancel
        </Button>
      </Card.Section>
    </>
  );
};
