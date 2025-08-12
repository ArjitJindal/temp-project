import s from './index.module.less';
import { RiskFactor, RiskFactorApproval } from '@/apis';
import { isEqual } from '@/utils/lang';
import Alert from '@/components/library/Alert';
import Tag from '@/components/library/Tag';

type Props = {
  pendingProposal: RiskFactorApproval;
  riskItem: RiskFactor;
};

const keysToCheck: (keyof RiskFactor)[] = ['status' as const];

export default function SpecialAttributesChanges(props: Props) {
  const { pendingProposal, riskItem } = props;
  const changedKeys = keysToCheck.filter((key) => {
    return (
      pendingProposal.riskFactor[key] && !isEqual(pendingProposal.riskFactor[key], riskItem[key])
    );
  });

  if (changedKeys.length === 0) {
    return <></>;
  }

  return (
    <Alert type={'INFO'}>
      <div className={s.root}>
        {changedKeys.map((key) => (
          <div key={key}>
            <Tag>{key}</Tag> changed: <Tag>{riskItem[key]}</Tag> to{' '}
            <Tag>{pendingProposal.riskFactor[key]}</Tag>
          </div>
        ))}
      </div>
    </Alert>
  );
}
