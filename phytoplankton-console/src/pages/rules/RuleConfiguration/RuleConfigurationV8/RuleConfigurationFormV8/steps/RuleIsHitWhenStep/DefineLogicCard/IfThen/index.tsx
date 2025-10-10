import cn from 'clsx';
import React from 'react';
import s from './style.module.less';
import GitMergeLineIcon from './git-merge-line.react.svg';

interface Props {
  renderIf: JSX.Element;
  renderThen: JSX.Element;
}

export default function IfThen(props: Props) {
  const { renderIf, renderThen } = props;
  return (
    <div className={s.root}>
      <div>
        <div className={cn(s.blockLabel, s.if)}>
          <GitMergeLineIcon />
          If
        </div>
      </div>
      <div className={cn(s.blockContent, s.if)}>{renderIf}</div>
      <div>
        <div className={cn(s.blockLabel, s.then)}>
          <GitMergeLineIcon />
          Then
        </div>
      </div>
      <div className={cn(s.blockContent, s.then)}>{renderThen}</div>
    </div>
  );
}
