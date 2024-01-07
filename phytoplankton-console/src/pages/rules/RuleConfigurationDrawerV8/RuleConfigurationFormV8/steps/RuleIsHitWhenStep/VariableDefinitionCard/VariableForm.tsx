import React, { useCallback, useMemo, useState } from 'react';
import { Tooltip } from 'antd';
import { Link } from 'react-router-dom';
import { isEqual } from 'lodash';
import { getAggVarDefinition } from '../../../../../RuleConfigurationDrawer/steps/RuleParametersStep/utils';
import { RuleLogicBuilder } from '../RuleLogicBuilder';
import s from './style.module.less';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import {
  RuleAggregationFunc,
  RuleAggregationTimeWindow,
  RuleAggregationTimeWindowGranularity,
  RuleAggregationTransactionDirection,
  RuleAggregationType,
  RuleAggregationVariable,
  RuleAggregationVariableTimeWindow,
} from '@/apis';
import Select from '@/components/library/Select';
import SelectionGroup from '@/components/library/SelectionGroup';
import NumberInput from '@/components/library/NumberInput';
import { RULE_AGGREGATION_TIME_WINDOW_GRANULARITYS } from '@/apis/models-custom/RuleAggregationTimeWindowGranularity';
import { humanizeAuto } from '@/utils/humanize';
import Checkbox from '@/components/library/Checkbox';

// TODO: Move PropertyColumns to library
import { PropertyColumns } from '@/pages/users-item/UserDetails/PropertyColumns';
import Button from '@/components/library/Button';
import TextInput from '@/components/library/TextInput';
import { dayjs } from '@/utils/dayjs';
import Alert from '@/components/library/Alert';

export type FormRuleAggregationVariable = Partial<RuleAggregationVariable> & {
  timeWindow: RuleAggregationVariableTimeWindow;
};
interface VariableFormProps {
  variable: FormRuleAggregationVariable;
  isNew: boolean;
  entityVariables: any[];
  onUpdate: (newAggregationVariable: RuleAggregationVariable) => void;
  onCancel: () => void;
}
const TYPE_OPTIONS: Array<{ value: RuleAggregationType; label: string }> = [
  { value: 'USER_TRANSACTIONS', label: 'User transactions' },
  { value: 'PAYMENT_DETAILS_TRSANCTIONS', label: 'Payment details transactions' },
];
const TX_DIRECTION_OPTIONS: Array<{ value: RuleAggregationTransactionDirection; label: string }> = [
  { value: 'SENDING', label: 'Sending' },
  { value: 'RECEIVING', label: 'Receiving' },
  { value: 'SENDING_RECEIVING', label: 'All' },
];
export const VariableForm: React.FC<VariableFormProps> = ({
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
        .filter((v) => v.entity === 'TRANSACTION')
        .map((v) => ({ value: v.key, label: v.uiDefinition.label })),
    [entityVariables],
  );
  const aggregateFunctionOptions: Array<{
    value: RuleAggregationFunc;
    label: string;
  }> = useMemo(() => {
    const options: Array<{ value: RuleAggregationFunc; label: string }> = [
      { value: 'COUNT', label: 'Count' },
    ];
    const numberValueOptions: Array<{ value: RuleAggregationFunc; label: string }> = [
      { value: 'AVG', label: 'Average' },
      { value: 'SUM', label: 'Sum' },
    ];
    const entityVariable = entityVariables.find((v) => v.key === formValues.aggregationFieldKey);
    if (entityVariable?.valueType === 'number') {
      options.push(...numberValueOptions);
    }
    return options;
  }, [entityVariables, formValues.aggregationFieldKey]);
  const isValidTimeWindow = useMemo(() => {
    const { start, end } = formValues.timeWindow;
    return (
      dayjs().subtract(start.units, start.granularity) <
      dayjs().subtract(end.units, end.granularity)
    );
  }, [formValues.timeWindow]);
  const isValidFormValues = useMemo(() => {
    return (
      formValues.type &&
      formValues.direction &&
      formValues.aggregationFieldKey &&
      formValues.aggregationFunc &&
      isValidTimeWindow
    );
  }, [
    formValues.aggregationFieldKey,
    formValues.aggregationFunc,
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
          />
        </Label>
        <PropertyColumns>
          <Label label="Variable type" required={{ value: true, showHint: true }}>
            <SelectionGroup
              value={formValues.type}
              onChange={(type) => handleUpdateForm({ type })}
              mode={'SINGLE'}
              options={TYPE_OPTIONS}
            />
          </Label>
          <Label label="Transaction direction" required={{ value: true, showHint: true }}>
            <SelectionGroup
              value={formValues.direction}
              onChange={(direction) => handleUpdateForm({ direction })}
              mode={'SINGLE'}
              options={TX_DIRECTION_OPTIONS}
            />
          </Label>
          <Label label="Aggregate field" required={{ value: true, showHint: true }}>
            <Select<string>
              value={formValues.aggregationFieldKey}
              onChange={(aggregationFieldKey) => handleUpdateForm({ aggregationFieldKey })}
              mode="SINGLE"
              options={aggregateFieldOptions}
            />
          </Label>
          <Label label="Aggregate function" required={{ value: true, showHint: true }}>
            <Select<RuleAggregationFunc>
              value={formValues.aggregationFunc}
              onChange={(aggregationFunc) => handleUpdateForm({ aggregationFunc })}
              mode="SINGLE"
              options={aggregateFunctionOptions}
            />
          </Label>
          <TimeWindow
            label={'Time from'}
            timeWindow={formValues.timeWindow?.start}
            onChange={(startTimeWindow) => {
              handleUpdateForm({
                timeWindow: { ...formValues?.timeWindow, start: startTimeWindow },
              });
            }}
          />
          <TimeWindow
            label={'Time to'}
            timeWindow={formValues.timeWindow.end}
            onChange={(endTimeWindow) => {
              handleUpdateForm({ timeWindow: { ...formValues.timeWindow, end: endTimeWindow } });
            }}
          />
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

interface TimeWindowProps {
  label: string;
  timeWindow: RuleAggregationTimeWindow;
  onChange: (newTimeWindow: RuleAggregationTimeWindow) => void;
}

const TimeWindow: React.FC<TimeWindowProps> = ({ timeWindow, label, onChange }) => {
  return (
    <Label label={label} required={{ value: true, showHint: true }}>
      <div className={s.timeWindowInputContainer}>
        <NumberInput
          min={0}
          value={timeWindow.units}
          onChange={(value) =>
            onChange({
              ...timeWindow,
              units: value ?? 0,
            })
          }
        />
        <Select<RuleAggregationTimeWindowGranularity>
          value={timeWindow.granularity}
          onChange={(value) =>
            onChange({
              ...timeWindow,
              granularity: value ?? 'day',
            })
          }
          mode="SINGLE"
          // TODO (V8): Support fiscal year
          options={RULE_AGGREGATION_TIME_WINDOW_GRANULARITYS.filter((v) => v !== 'fiscal_year').map(
            (granularity) => ({
              label: humanizeAuto(granularity),
              value: granularity,
            }),
          )}
        />
      </div>
      <Label
        label={
          <>
            Rolling basis{' '}
            <Tooltip
              title={
                <div style={{ whiteSpace: 'break-spaces' }}>
                  When rolling basis is disabled, system starts the time period at 00:00 for day,
                  week, month time granularities
                </div>
              }
            >
              <InformationLineIcon style={{ width: 12 }} />
            </Tooltip>
          </>
        }
        position="RIGHT"
        level={2}
      >
        <Checkbox
          value={timeWindow.rollingBasis ?? false}
          onChange={(value) =>
            onChange({
              ...timeWindow,
              rollingBasis: value ?? false,
            })
          }
        />
      </Label>
    </Label>
  );
};
