import React from 'react';
import s from './style.module.less';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';

interface Props {
  onNext: () => void;
  onPrevious: () => void;
  nextDisabled?: boolean;
  prevDisabled?: boolean;
}

export default function ButtonGroup(props: Props) {
  const { nextDisabled, prevDisabled, onNext, onPrevious } = props;
  return (
    <div className={s.root}>
      <button className={s.button} disabled={prevDisabled} onClick={onPrevious}>
        <ArrowLeftSLineIcon />
      </button>
      <button className={s.button} disabled={nextDisabled} onClick={onNext}>
        <ArrowRightSLineIcon />
      </button>
    </div>
  );
}
