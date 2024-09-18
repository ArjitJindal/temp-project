import React from 'react';
import PersonDetails from './PersonDetails';
import s from './index.module.less';
import { Person } from '@/apis';

interface Props {
  persons?: Person[];
}

export default function Persons(props: Props) {
  const { persons } = props;

  return (
    <div className={s.root}>
      {persons?.map((person, i) => (
        <PersonDetails key={i} person={person} />
      ))}
    </div>
  );
}
