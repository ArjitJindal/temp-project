import React from 'react';
import SegmentedControl from '@/components/library/SegmentedControl';

type ScopeSelectorValue = 'SUMMARY' | 'EMAILS' | 'TASKS' | 'NOTES' | 'TICKETS';

interface Count {
  emails: number;
  tasks?: number;
  notes?: number;
}
interface Props {
  selectedSection: string;
  setSelectedSection: (value: string) => void;
  count: Count;
}

export default function ScopeSelector(props: Props) {
  const { selectedSection, setSelectedSection, count } = props;
  const { emails, tasks, notes } = count;
  return (
    <SegmentedControl<ScopeSelectorValue>
      size="LARGE"
      active={selectedSection as ScopeSelectorValue}
      onChange={(newValue) => {
        setSelectedSection(newValue);
      }}
      items={[
        { value: 'SUMMARY', label: 'AI Summary' },
        { value: 'EMAILS', label: `Emails (${emails})` },
        { value: 'TASKS', label: `Tasks (${tasks})` },
        { value: 'NOTES', label: `Notes (${notes})` },
      ]}
    />
  );
}
