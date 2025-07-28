import s from './index.module.less';

export default function HeaderLayout(props: {
  left?: React.ReactNode;
  subheader?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className={s.root}>
        <div className={s.headerLeft}>{props.left}</div>
        <div className={s.headerRight}>{props.children}</div>
      </div>
      {props.subheader && <div className={s.subheader}>{props.subheader}</div>}
    </>
  );
}
