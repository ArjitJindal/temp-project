import React from 'react';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import { RiskLevel } from '@/utils/risk-levels';

export default function AIRiskDisplay() {
  const data = [
    {
      drsScore: 21,
      derivedRiskLevel: 'VERY_LOW' as RiskLevel,
      createdAt: 1680010421000,
      components: [],
    },
    {
      drsScore: 43,
      derivedRiskLevel: 'LOW' as RiskLevel,
      createdAt: 1680020021000,
      components: [],
    },
    {
      drsScore: 53,
      derivedRiskLevel: 'LOW' as RiskLevel,
      createdAt: 1680020400000,
      components: [],
    },
    {
      drsScore: 73,
      derivedRiskLevel: 'HIGH' as RiskLevel,
      createdAt: 1680020420000,
      components: [],
    },
    {
      drsScore: 65,
      derivedRiskLevel: 'MEDIUM' as RiskLevel,
      createdAt: 1680020421000,
      components: [],
    },
  ];
  return (
    <RiskScoreDisplay
      values={data.map((x) => ({
        value: x.drsScore,
        riskLevel: x?.derivedRiskLevel,
        createdAt: x.createdAt,
        components: x.components,
      }))}
      icon={<User3LineIcon />}
      title="AI risk score"
    />
  );
}
