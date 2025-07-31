import { RiskEntityType, RiskFactor, RiskLevel, RiskParameterLevelKeyValue } from '@/apis';

export type ScopeSelectorValue = 'consumer' | 'business' | 'transaction';

export type RiskFactorsMode = 'simulation' | 'normal' | 'version-history';

export const scopeToRiskEntityType = (scope: ScopeSelectorValue): RiskEntityType => {
  switch (scope) {
    case 'consumer':
      return 'CONSUMER_USER';
    case 'business':
      return 'BUSINESS';
    case 'transaction':
      return 'TRANSACTION';
  }
};

export interface RiskFactorsTypeMap {
  CONSUMER_USER: RiskFactor[];
  BUSINESS: RiskFactor[];
  TRANSACTION: RiskFactor[];
}

export const DEFAULT_RISK_FACTORS_MAP: RiskFactorsTypeMap = {
  CONSUMER_USER: [],
  BUSINESS: [],
  TRANSACTION: [],
};

export type SaveRiskFactorParams = {
  values: RiskParameterLevelKeyValue[];
  defaultRiskLevel: RiskLevel;
  defaultWeight: number;
  defaultRiskScore: number;
  riskFactorId: string;
};
