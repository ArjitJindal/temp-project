import s from './styles.module.less';

export interface BarChartData {
  label: string;
  value: number;
  info?: React.ReactNode;
  valueLabel?: React.ReactNode;
}

interface Props {
  data: BarChartData[];
}

export const BarChart = (props: Props) => {
  const { data } = props;
  return (
    <div className={s.container}>
      {data.map((item, index) => (
        <div className={s.row} key={index}>
          <div className={s.bar}>
            <div className={s.label}>{item.label}</div>
            <div
              className={s.columnContainer}
              style={{
                gridTemplateColumns: `${item.value}fr 60px ${100 - item.value}fr`,
              }}
            >
              <div className={s.column}></div>
              <div className={s.columnValue}>{item.valueLabel ?? item.value}</div>
              <div></div>
            </div>
          </div>
          <div className={s.info}>{item.info}</div>
        </div>
      ))}
    </div>
  );
};
