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
    </Card.Section>
  );
}
