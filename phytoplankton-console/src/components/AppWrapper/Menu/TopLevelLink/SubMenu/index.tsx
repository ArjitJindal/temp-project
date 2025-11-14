import cn from 'clsx';
import s from './index.module.less';
import Link from '@/components/ui/Link';

export interface SubMenuItem {
  to: string;
  title: string;
}

interface Props {
  items: SubMenuItem[];
}

export default function SubMenu(props: Props) {
  const { items } = props;

  return (
    <div className={cn(s.root)}>
      {items.map((x) => (
        <Link to={x.to} key={x.title} className={s.item}>
          {x.title}
        </Link>
      ))}
    </div>
  );
}
