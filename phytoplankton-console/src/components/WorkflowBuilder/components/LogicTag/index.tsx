import cn from 'clsx';
import s from './index.module.less';

interface Props {
  size?: 'SMALL' | 'MEDIUM';
  color: string;
  icon: React.ReactNode;
  children: string;
}

export default function LogicTag(props: Props) {
  const { size = 'MEDIUM', color, icon, children } = props;
  return (
    <div
      className={cn(s.root, s[`size-${size}`])}
      style={{ backgroundColor: color, maxWidth: 100 }}
    >
      <div className={s.icon}>{icon}</div>
      {children}
    </div>
  );
}
