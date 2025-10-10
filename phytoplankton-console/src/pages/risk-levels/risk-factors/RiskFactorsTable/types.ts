import { RiskFactor, RiskFactorApproval } from '@/apis';

export type RiskFactorRow = RiskFactor & {
  proposal?: RiskFactorApproval;
};
