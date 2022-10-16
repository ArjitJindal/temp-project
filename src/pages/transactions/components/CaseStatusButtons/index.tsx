import React from 'react';
import cn from 'clsx';
import _ from 'lodash';
import s from './style.module.less';
import BookOpenLineIcon from '@/components/ui/icons/Remix/document/book-open-line.react.svg';

interface Props {
  status: 'OPEN' | 'CLOSED';
  onChange: (newStatus: 'OPEN' | 'CLOSED') => void;
}

const STATUSES = ['OPEN', 'CLOSED'] as const;

const ICONS = {
  OPEN: <BookOpenLineIcon className={s.buttonIcon} />,
  CLOSED: <BookOpenLineIcon className={s.buttonIcon} />,
} as const;

export default function CaseStatusButtons(props: Props) {
  const { status, onChange } = props;

  return (
    <div className={s.root}>
      {STATUSES.map((buttonStatus) => (
        <button
          className={cn(s.button, status === buttonStatus && s.isActive)}
          onClick={() => {
            onChange(buttonStatus);
          }}
        >
          {ICONS[buttonStatus]}
          {_.capitalize(buttonStatus)}
        </button>
      ))}
    </div>
  );
}
