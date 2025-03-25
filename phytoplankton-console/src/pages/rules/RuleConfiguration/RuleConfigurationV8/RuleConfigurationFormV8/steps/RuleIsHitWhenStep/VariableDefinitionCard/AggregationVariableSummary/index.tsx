import React from 'react';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import pluralize from 'pluralize';
import { lowerCase } from 'lodash';
import {
  formatTimeWindow,
  FormRuleAggregationVariable,
  varLabelWithoutDirection,
  varLabelWithoutNamespace,
} from '../helpers';
import { LogicEntityVariable, RuleType } from '@/apis';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  ruleType: RuleType;
  variableFormValues: FormRuleAggregationVariable;
  entityVariables: LogicEntityVariable[];
}

export default function AggregationVariableSummary({
  ruleType,
  variableFormValues,
  entityVariables,
}: Props) {
  const settings = useSettings();
  const {
    type,
    userDirection,
    transactionDirection,
    aggregationFieldKey,
    aggregationGroupByFieldKey,
    aggregationFunc,
    timeWindow,
    filtersLogic,
    lastNEntities,
  } = variableFormValues;

  if (
    !type ||
    !userDirection ||
    !transactionDirection ||
    !aggregationFieldKey ||
    !aggregationFunc ||
    !timeWindow
  ) {
    return <div>N/A</div>;
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
  const userLabel = type === 'USER_TRANSACTIONS' ? settings.userAlias : 'payment ID';
  const filtersCount = filtersLogic?.and?.length ?? filtersLogic?.or?.length ?? 0;

  const textComponents = [
    <b key="agg-func-label">{aggFuncLabel}</b>,
    'of',
    aggFieldLabel ? <b key="agg-field-label">{aggFieldLabel}</b> : undefined,
    aggFieldLabel ? 'in' : undefined,
    <b key="text-direction-label">{txDirectionLabel} transactions</b>,
    aggGroupByFieldLabel ? (
      <span key="agg-group-by-field-label">
        (with the same <b>{aggGroupByFieldLabel}</b>)
      </span>
    ) : undefined,
    'by a',
    <b key="user-direction-label">
      {userDirectionLabel}
      {userLabel}
    </b>,
    lastNEntities ? (
      <>
        for last <b key="last-n-entities"> {lastNEntities} transactions</b>
      </>
    ) : (
      <>
        from <b key="time-window-start">{formatTimeWindow(timeWindow.end)}</b> to{' '}
        <b key="time-window-end">{formatTimeWindow(timeWindow.start)}</b>
      </>
    ),
    filtersLogic
      ? `(with ${filtersCount} ${pluralize('filter', filtersCount)} applied)`
      : undefined,
  ].filter(Boolean);

  return (
    <div>
      {textComponents.map((v, i) => (
        <span key={i}>{v} </span>
      ))}
    </div>
  );
}
