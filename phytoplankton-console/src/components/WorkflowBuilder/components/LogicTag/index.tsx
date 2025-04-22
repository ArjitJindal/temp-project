import s from './index.module.less';

interface Props {
  color: string;
  icon: React.ReactNode;
  children: string;
}

export default function LogicTag(props: Props) {
  const { color, icon, children } = props;
  return (
    <div className={s.root} style={{ backgroundColor: color, maxWidth: 100 }}>
      <div className={s.icon}>{icon}</div>
      {children}
    </div>
  );
}
