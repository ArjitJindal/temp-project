import s from './index.module.less';

interface Item {
  label: string;
  value?: React.ReactNode;
}

interface Props {
  title: string;
  extraControls?: React.ReactNode;
  items?: Item[];
  children?: React.ReactNode;
}

export default function EntityPropertiesCard(props: Props) {
  const { title, extraControls, items, children } = props;
  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.title}>{title}</div>
        {extraControls}
      </div>
      {items && (
        <div className={s.items}>
          {items.map(({ label, value }) => (
            <>
              <div className={s.itemLabel}>{label}</div>
              <div className={s.itemValue}>{value ?? '-'}</div>
            </>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
