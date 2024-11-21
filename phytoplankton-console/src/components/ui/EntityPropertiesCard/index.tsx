import s from './index.module.less';

interface Item {
  label: React.ReactNode;
  value?: React.ReactNode;
}

interface Props {
  title?: string;
  extraControls?: React.ReactNode;
  items?: Item[];
  columns?: number;
  children?: React.ReactNode;
  columnTemplate?: string;
}

export default function EntityPropertiesCard(props: Props) {
  const { title, extraControls, items, columns = 1, children, columnTemplate } = props;
  return (
    <div className={s.root}>
      <div className={s.header}>
        {title && <div className={s.title}>{title}</div>}
        {extraControls}
      </div>
      {
        <>
          {items && (
            <div
              className={s.items}
              style={{ gridTemplateColumns: columnTemplate || `repeat(${columns * 2}, auto)` }}
            >
              {items.map(({ label, value }) => (
                <>
                  <div className={s.itemLabel}>{label}</div>
                  <div className={s.itemValue}>{value ?? '-'}</div>
                </>
              ))}
            </div>
          )}
        </>
      }
      {children}
    </div>
  );
}
