import React from 'react';
import { SegmentContextProvider } from '@/utils/segment/context';

export default function (props: { writeKey: string; children: React.ReactNode }) {
  return (
    <SegmentContextProvider writeKey={props.writeKey}>{props.children}</SegmentContextProvider>
  );
}
