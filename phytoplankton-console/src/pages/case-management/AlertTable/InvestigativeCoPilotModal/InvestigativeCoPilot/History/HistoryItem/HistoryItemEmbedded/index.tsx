import React from 'react';
import { QuestionResponseEmbedded } from '../../../types';
import { Recommendation } from './Recommendation';
import * as Card from '@/components/ui/Card';
import Linking from '@/pages/users-item/UserDetails/Linking';

interface Props {
  item: QuestionResponseEmbedded;
}

export default function HistoryItemEmbedded({ item }: Props) {
  const userId = item.variables?.find((v) => v.name === 'userId')?.value as string;
  const alertId = item.variables?.find((v) => v.name === 'alertId')?.value as string;

  return (
    <Card.Section key={JSON.stringify(item.variables)}>
      {item.questionId === 'Entity linking' && (
        <div style={{ height: '400px' }}>
          <Linking userId={userId} />
        </div>
      )}
      {item.questionId === 'Recommendation' && <Recommendation alertId={alertId} />}
    </Card.Section>
  );
}
