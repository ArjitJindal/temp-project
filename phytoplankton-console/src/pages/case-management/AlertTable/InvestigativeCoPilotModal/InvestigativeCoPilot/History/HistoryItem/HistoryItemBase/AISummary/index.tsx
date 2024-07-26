import React from 'react';
import s from './index.module.less';
import BrainIcon from '@/components/ui/icons/brain-icon-colored.react.svg';
import Checkbox from '@/components/library/Checkbox';
import Label from '@/components/library/Label';

interface Props {
  addToNarrative?: boolean | undefined;
  onChangeAddToNarrative?: (value: boolean | undefined) => void;
  text: string;
}

export default function AISummary(props: Props) {
  const { addToNarrative, onChangeAddToNarrative, text } = props;
  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.title}>
          <BrainIcon className={s.brainIcon} />
          AI Summary
        </div>
        {(addToNarrative != null || onChangeAddToNarrative != null) && (
          <div>
            <Label label="Add to narrative" position="RIGHT">
              <Checkbox value={addToNarrative} onChange={onChangeAddToNarrative} />
            </Label>
          </div>
        )}
      </div>

      <div>{text}</div>
    </div>
  );
}
