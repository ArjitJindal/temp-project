import { useState } from 'react';
import s from './styles.module.less';
import Button from '@/components/library/Button';
import ArrowUpIcon from '@/components/ui/icons/Remix/system/arrow-up-s-line.react.svg';
import ArrowDownIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';

type Props = {
  defaultExpanded?: boolean;
  children: React.ReactNode;
  suffixText: string;
};

export const ExpandContentButton = (props: Props) => {
  const [expanded, setExpanded] = useState(props.defaultExpanded ?? false);

  return (
    <>
      <div className={s.expandContentButton}>
        <hr className={s.hr} />
        <Button
          type={'TETRIARY'}
          iconRight={expanded ? <ArrowUpIcon /> : <ArrowDownIcon />}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Hide' : 'Show'} {props.suffixText}
        </Button>
      </div>
      {expanded && props.children}
      {expanded && <hr className={s.hrBottom} />}
    </>
  );
};
