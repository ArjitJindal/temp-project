import { Tag } from 'antd';

import style from './index.module.less';
import COLORS from '@/components/ui/colors';

interface Props {
  closingReasons: string[] | undefined;
  otherReason?: string;
}

export const ClosingReasonTag: React.FC<Props> = ({ closingReasons, otherReason }) => {
  if (!closingReasons) {
    return <></>;
  }
  return (
    <>
      {closingReasons.map((closingReason, index) => (
        <span className={style.tag} key={index}>
          <Tag color={COLORS.brandBlue.tint}>{closingReason}</Tag>
        </span>
      ))}
      {otherReason && (
        <div>
          <span className={style.otherLabel}>Other Reasons: </span>
          {otherReason}
        </div>
      )}
    </>
  );
};
