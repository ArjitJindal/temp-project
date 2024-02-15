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
import VariableTimeWindow from '@/pages/rules/RuleConfigurationDrawerV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/VariableTimeWindow';
import { getAggVarDefinition } from '@/pages/rules/RuleConfigurationDrawer/steps/RuleParametersStep/utils';

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
  { value: 'USER_TRANSACTIONS', label: 'User transactions' },
  { value: 'PAYMENT_DETAILS_TRANSACTIONS', label: 'Payment details transactions' },
];
const TX_DIRECTION_OPTIONS: Array<{ value: RuleAggregationTransactionDirection; label: string }> = [
  { value: 'SENDING', label: 'Sending' },
  { value: 'RECEIVING', label: 'Receiving' },
  { value: 'SENDING_RECEIVING', label: 'All' },
];
export const AggregationVariableForm: React.FC<AggregationVariableFormProps> = ({
  variable,
  entityVariables,
  isNew,
  onUpdate,
  onCancel,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [formValues, setFormValues] = useState<FormRuleAggregationVariable>(variable);
  const aggregateFieldOptions = useMemo(
    () =>
      entityVariables
        // NOTE: As 'Transaction direction' already determines whether to use origin/destination variables,
        // we only keep origin variabes here and hide 'origin' from the label
        .filter((v) => v.entity === 'TRANSACTION' && !v.key.startsWith('TRANSACTION:destination'))
        .map((v) => ({
          value: v.key,
          // NOTE: Remove redundant namespace prefix as we only show transaction variables
          label: v.uiDefinition.label.replace(/^Transaction\s*\/\s*/, '').replace(/^origin/, ''),
        })),
    [entityVariables],
  );
  const aggregateFunctionOptions: Array<{
    value: RuleAggregationFunc;
    label: string;
  }> = useMemo(() => {
    const options: Array<{ value: RuleAggregationFunc; label: string }> = [
      { value: 'COUNT', label: 'Count' },
    ];
    const entityVariable = entityVariables.find((v) => v.key === formValues.aggregationFieldKey);
    if (entityVariable?.valueType === 'number') {
      const numberValueOptions: Array<{ value: RuleAggregationFunc; label: string }> = [
        { value: 'AVG', label: 'Average' },
        { value: 'SUM', label: 'Sum' },
      ];
      options.push(...numberValueOptions);
    } else if (entityVariable?.valueType === 'string') {
      // TODO (V8): Only allow low cardinality fields. Fields like transaction id should not be allowed.
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
    } else {
      startTs = dayjs().subtract(start.units, start.granularity);
    }

    if (end.granularity === 'fiscal_year') {
      if (end.fiscalYear != null) {
        endTs = getFiscalYearStart(dayjs(), end.fiscalYear).subtract(end.units, 'year');
      }
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
      formValues.direction &&
      formValues.aggregationFieldKey &&
      (!isTxAmount || (isTxAmount && formValues.baseCurrency)) &&
      formValues.aggregationFunc &&
      isValidTimeWindow
    );
  }, [
    formValues.aggregationFieldKey,
    formValues.aggregationFunc,
    formValues.baseCurrency,
    formValues.direction,
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
    if (newValues.aggregationFunc === 'COUNT') {
      newValues.aggregationFieldKey = 'TRANSACTION:transactionId';
    }
    setFormValues((prevValues) => ({ ...prevValues, ...newValues }));
  }, []);
  const isAggFuncCount = formValues.aggregationFunc === 'COUNT';
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
              value={formValues.type}
              onChange={(type) => handleUpdateForm({ type })}
              mode={'SINGLE'}
              options={TYPE_OPTIONS}
              testName="variable-type-v8"
            />
          </Label>
          <Label label="Transaction direction" required={{ value: true, showHint: true }}>
            <SelectionGroup
              value={formValues.direction}
              onChange={(direction) => handleUpdateForm({ direction })}
              mode={'SINGLE'}
              options={TX_DIRECTION_OPTIONS}
              testName="variable-direction-v8"
            />
          </Label>
          <Label
            label="Aggregate field"
            required={{ value: true, showHint: true }}
            testId="variable-aggregate-field-v8"
          >
            <Select<string>
              value={isAggFuncCount ? '-' : formValues.aggregationFieldKey}
              onChange={(aggregationFieldKey) =>
                handleUpdateForm({ aggregationFieldKey, aggregationFunc: undefined })
              }
              mode="SINGLE"
              options={aggregateFieldOptions}
              isDisabled={isAggFuncCount}
            />
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
          </Label>
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
          </Label>
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
            <b>Time from</b> should be earlier than <b>Time to</b>
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
