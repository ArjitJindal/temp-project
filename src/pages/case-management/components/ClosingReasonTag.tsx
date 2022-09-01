import { Tag } from 'antd';

import style from './index.module.less';

interface Props {
  closingReasons: string[] | undefined;
}

export const ClosingReasonTag: React.FC<Props> = ({ closingReasons }) => {
  if (!closingReasons) {
    return <></>;
  }
  const tagColor = '#ebf2ff';

  return (
    <>
      {closingReasons.map((closingReason, index) => (
        <span className={style.tag} key={index}>
          <Tag color={tagColor}>{closingReason}</Tag>
        </span>
      ))}
    </>
  );
};
