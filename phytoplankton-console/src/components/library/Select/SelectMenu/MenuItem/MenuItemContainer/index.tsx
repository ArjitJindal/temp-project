import cn from 'clsx';
import s from './index.module.less';

type Props = {
  isDisabled?: boolean;
  isInteractive?: boolean;
  isNested?: boolean;
  isSelected?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
};

export default function MenuItemContainer(props: Props) {
  const { isDisabled, isInteractive, isNested, isSelected, children, onClick } = props;
  return (
    <div
      className={cn(s.root, {
        [s.isSelected]: isSelected,
        [s.isInteractive]: isInteractive && !isDisabled,
        [s.isDisabled]: isDisabled,
        [s.isNested]: isNested,
      })}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
