import cn from 'clsx';
import s from './style.module.less';
import ArrowRightSLine from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';

interface Props {
  isExpanded: boolean;
  color?: 'BLUE' | 'BLACK';
  size?: 'SMALL' | 'BIG';
  isInvalid?: boolean;
  onClick?: () => void;
}

export default function ExpandIcon(props: Props) {
  const { isExpanded, color = 'BLUE', size = 'SMALL', onClick, isInvalid = false } = props;

  return (
    <button
      className={cn(
        s.root,
        s[`color-${color}`],
        s[`size-${size}`],
        isExpanded && s.isExpanded,
        isInvalid && s.isInvalid,
      )}
      onClick={onClick}
      data-cy="expand-icon"
      type="button"
    >
      <ArrowRightSLine />
    </button>
  );
}
