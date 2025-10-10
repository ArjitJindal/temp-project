import React from 'react';
import { humanizeSnakeCase } from '@flagright/lib/utils/humanize';
import { AlertStatus, CaseStatus } from '@/apis';
import CaseIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import ListQuickFilter from '@/components/library/QuickFilter/subtypes/ListQuickFilter';

interface Status {
  OPEN: CaseStatus[] | AlertStatus[];
  CLOSED: CaseStatus[] | AlertStatus[];
  ESCALATED: CaseStatus[] | AlertStatus[];
  IN_REVIEW: CaseStatus[] | AlertStatus[];
  IN_PROGRESS: CaseStatus[] | AlertStatus[];
  ON_HOLD: CaseStatus[] | AlertStatus[];
}

const STATUS: Status = {
  OPEN: ['OPEN', 'REOPENED'],
  CLOSED: ['CLOSED'],
  ESCALATED: ['ESCALATED'],
  IN_REVIEW: ['IN_REVIEW_CLOSED', 'IN_REVIEW_ESCALATED', 'IN_REVIEW_OPEN', 'IN_REVIEW_REOPENED'],
  IN_PROGRESS: ['OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS'],
  ON_HOLD: ['OPEN_ON_HOLD', 'ESCALATED_ON_HOLD'],
};

interface Props {
  initialState: CaseStatus[] | AlertStatus[];
  onConfirm: (newState: CaseStatus[] | AlertStatus[] | undefined) => void;
  title: string;
}

export default function StatusFilterButton(props: Props) {
  const { initialState, onConfirm, title } = props;
  const options = Object.entries(STATUS).map(([key, value]) => ({
    value: value,
    label: humanizeSnakeCase(key),
  }));
  return (
    <ListQuickFilter
      title={title}
      key={'id-search'}
      icon={<CaseIcon />}
      value={initialState}
      onChange={onConfirm}
      options={options}
      mode={'MULTIPLE'}
    />
  );
}
