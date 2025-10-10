import s from './index.module.less';

interface Props {
  onClick?: () => void;
  children: React.ReactNode;
}

export default function VariableInfoPopover(props: Props) {
  if (!props.onClick) {
    return <>{props.children}</>;
  }
  return (
    <div className={s.root} onClick={props.onClick}>
      {props.children}
    </div>
  );
}
