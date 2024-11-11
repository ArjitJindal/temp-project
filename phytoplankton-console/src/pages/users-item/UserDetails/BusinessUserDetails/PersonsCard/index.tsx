import React from 'react';
import PersonDetails from './PersonDetails';
import s from './index.module.less';
import { Person } from '@/apis';

interface Props {
  userId: string;
  persons?: Person[];
  isShareHolder: boolean;
}

export default function Persons(props: Props) {
  const { persons, userId, isShareHolder } = props;

  return (
    <div className={s.root}>
      {persons?.map((person, i) => (
        <PersonDetails key={i} person={person} userId={userId} isShareHolder={isShareHolder} />
      ))}
    </div>
  );
}
