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
    lastNEntities ? (
      <>
        for last <b> {lastNEntities} transactions</b>
      </>
    ) : (
      <>
        from <b>{formatTimeWindow(timeWindow.end)}</b> to{' '}
        <b>{formatTimeWindow(timeWindow.start)}</b>
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
