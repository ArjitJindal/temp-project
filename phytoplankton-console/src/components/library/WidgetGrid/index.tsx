import cn from 'clsx';
import Widget, { Props as WidgetProps } from '../Widget';
import s from './index.module.less';

export type Item = WidgetProps;

interface Props {
  groups: {
    groupTitle: string;
    items: Item[];
  }[];
}

export default function WidgetGrid(props: Props) {
  const { groups } = props;
  return (
    <div className={cn(s.root)}>
      {groups.map(({ groupTitle, items }) => (
        <div key={groupTitle} className={cn(s.group)}>
          <div className={s.groupTitle}>{groupTitle}</div>
          <div className={s.items}>
            {items.map((item) => (
              <Widget key={item.id} {...item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
