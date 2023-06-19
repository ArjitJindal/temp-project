import Property from '../Property';
import { PropertyItems } from '../types';
import s from './style.module.less';
import { Props as LabelProps } from '@/components/library/Label';

interface Props {
  items: PropertyItems;
  labelProps?: Partial<LabelProps>;
}

export default function PropertyList(props: Props): JSX.Element {
  const { items, labelProps } = props;
  return (
    <PropertyListLayout>
      {items.map((item) => (
        <Property key={item.name} item={item} labelProps={labelProps} />
      ))}
    </PropertyListLayout>
  );
}

export function PropertyListLayout(props: { children: React.ReactNode }) {
  return <div className={s.root}>{props.children}</div>;
}
