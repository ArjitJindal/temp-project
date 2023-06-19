import style from '../style.module.less';

export function header(input: string): React.ReactNode {
  return (
    <div>
      <span className={style.header}>{input}</span>
    </div>
  );
}

export function smallHeader(input: string): React.ReactNode {
  return (
    <div>
      <span className={style.smallheader}>{input}</span>
    </div>
  );
}
