import { Tag } from 'antd';
import { ArrowDownOutlined, ArrowsAltOutlined, SwapOutlined } from '@ant-design/icons';
import { neverReturn } from '@/utils/lang';
import { CaseType } from '@/apis';

interface Props {
  caseType: CaseType | undefined;
}

export default function CaseTypeTag(props: Props) {
  const { caseType } = props;
  if (!caseType) {
    return <>-</>;
  }
  let transactionTypeDisplay: string;
  let transactionTypeIcon = <SwapOutlined />;
  let tagColor = 'geekblue';

  if (caseType === 'USER') {
    transactionTypeDisplay = 'User';
    tagColor = 'blue';
    transactionTypeIcon = <ArrowDownOutlined />;
  } else if (caseType === 'TRANSACTION') {
    transactionTypeDisplay = 'Transaction';
    tagColor = 'orange';
    transactionTypeIcon = <ArrowsAltOutlined />;
  } else {
    transactionTypeDisplay = neverReturn(caseType, caseType);
  }

  return (
    <Tag color={tagColor}>
      {transactionTypeIcon} {transactionTypeDisplay}
    </Tag>
  );
}
