import { Tag } from 'antd';
import s from './index.module.less';
import { neverReturn } from '@/utils/lang';
import { CaseType } from '@/apis';
import COLORS from '@/components/ui/colors';

interface Props {
  caseType: CaseType | undefined;
}

export default function CaseTypeTag(props: Props) {
  const { caseType } = props;
  if (!caseType) {
    return <>-</>;
  }
  let transactionTypeDisplay: string;
  let bgColor;
  let borderColor;

  if (caseType === 'USER') {
    transactionTypeDisplay = 'User';
    bgColor = COLORS.turquoise.tint;
    borderColor = COLORS.turquoise.base;
  } else if (caseType === 'TRANSACTION') {
    transactionTypeDisplay = 'Transaction';
    bgColor = COLORS.orange.tint;
    borderColor = COLORS.orange.base;
  } else {
    transactionTypeDisplay = neverReturn(caseType, caseType);
  }

  return (
    <Tag
      className={s.root}
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
      }}
    >
      {transactionTypeDisplay}
    </Tag>
  );
}
