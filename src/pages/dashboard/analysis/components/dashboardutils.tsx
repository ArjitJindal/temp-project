import style from '../style.module.less';

function header(input: string): React.ReactNode {
  return (
    <div>
      <span className={style.header}>{input}</span>
    </div>
  );
}

export default header;
