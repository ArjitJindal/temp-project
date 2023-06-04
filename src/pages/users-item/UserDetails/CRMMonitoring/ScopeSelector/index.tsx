import React from 'react';
import SegmentedControl from '@/components/library/SegmentedControl';

type ScopeSelectorValue = 'SUMMARY' | 'EMAILS' | 'COMMENTS' | 'NOTES';

interface Count {
  email: number;
  comments: number;
  notes: number;
}
interface Props {
  selectedSection: string;
  setSelectedSection: (value: string) => void;
  count: Count;
}

export default function ScopeSelector(props: Props) {
  const { selectedSection, setSelectedSection, count } = props;
  const { email, comments, notes } = count;
  return (
    <SegmentedControl<ScopeSelectorValue>
      size="LARGE"
      active={selectedSection as ScopeSelectorValue}
      onChange={(newValue) => {
        setSelectedSection(newValue);
      }}
      items={[
        { value: 'SUMMARY', label: 'AI Summary' },
        { value: 'EMAILS', label: `Emails (${email})` },
        { value: 'COMMENTS', label: `Comments (${comments})` },
        { value: 'NOTES', label: `Notes & Attachments (${notes})` },
      ]}
    />
  );
}
