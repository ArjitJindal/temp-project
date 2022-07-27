import { Tag } from 'antd';
import { getLabel } from '../RiskLevelSwitch/index';
import s from '../RiskLevelSwitch/styles.module.less';
import { RISK_LEVEL_COLORS, RiskLevel } from '@/utils/risk-levels';

interface Props {
  current: RiskLevel | null;
}

export default function RiskSwitch(props: Props): JSX.Element {
  const { current } = props;
  return (
    <>
      {current ? (
        <Tag
          key={current}
          className={s.button}
          style={{
            borderWidth: 1,
            background: RISK_LEVEL_COLORS[current].light,
            color: RISK_LEVEL_COLORS[current].primary,
            borderColor: RISK_LEVEL_COLORS[current].primary,
          }}
        >
          {getLabel(current)}
        </Tag>
      ) : (
        <>-</>
      )}
    </>
  );
}
