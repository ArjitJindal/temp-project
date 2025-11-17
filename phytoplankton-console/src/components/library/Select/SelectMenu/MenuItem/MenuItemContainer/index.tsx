import cn from 'clsx';
import s from './index.module.less';

type Props = {
  id: string;
  isDisabled?: boolean;
  isInteractive?: boolean;
  isNested?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
  onClick?: () => void;
};

export default function MenuItemContainer(props: Props) {
  const {
    id,
    isDisabled,
    isInteractive,
    isNested,
    isSelected,
    isHighlighted,
    children,
    onMouseEnter,
    onMouseLeave,
    onClick,
  } = props;
  return (
    <div
      data-cy={id}
      className={cn(s.root, {
        [s.isHighlighted]: isHighlighted,
        [s.isSelected]: isSelected,
        [s.isInteractive]: isInteractive && !isDisabled,
        [s.isDisabled]: isDisabled,
        [s.isNested]: isNested,
      })}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}
