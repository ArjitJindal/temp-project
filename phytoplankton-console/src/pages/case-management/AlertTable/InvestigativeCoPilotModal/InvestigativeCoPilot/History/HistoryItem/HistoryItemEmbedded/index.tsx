import React from 'react';
import { QuestionResponseEmbedded } from '../../../types';
import * as Card from '@/components/ui/Card';
import Linking from '@/pages/users-item/UserDetails/Linking';

interface Props {
  item: QuestionResponseEmbedded;
}

export default function HistoryItemEmbedded({ item }: Props) {
  const userId = item.variables?.find((v) => v.name === 'userId')?.value as string;
  return (
    <Card.Section key={JSON.stringify(item.variables)}>
      {item.questionId === 'Entity linking' && (
        <div style={{ height: '400px' }}>
          <Linking userId={userId} />
        </div>
      )}
      {item.questionId === 'Recommendation' && (
        <>
          <h3>Significant observations</h3>
          <ul>
            <li>User has been flagged by high velocity rule 8 times in the last 3 months.</li>
            <li>User has had SARs filed on them twice in the last 6 months.</li>
            <li>
              30% of users transaction amounts end in round numbers. This is higher than average.
            </li>
            <li>
              User’s average transaction risk score is 72.8, which is classified as High Risk.
            </li>
            <li>User’s transaction volume is 164% higher than average.</li>
          </ul>
          <h3>Action items</h3>
          <ul>
            <li>View past communications with the user in CRM.</li>
            <li>Investigate linked transactions.</li>
          </ul>
        </>
      )}
    </Card.Section>
  );
}
