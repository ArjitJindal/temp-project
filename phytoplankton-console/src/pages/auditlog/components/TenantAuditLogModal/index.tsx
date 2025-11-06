import { useMemo } from 'react';
import AuditLogModal from '../AuditLogModal';
import { AuditLog } from '@/apis/models/AuditLog';
import { TenantSettings } from '@/apis/models/TenantSettings';
import { RiskLevelAlias } from '@/apis/models/RiskLevelAlias';
import { RiskLevel } from '@/apis/models/RiskLevel';
import { RISK_LEVELS } from '@/utils/risk-levels';

interface Props {
  data: AuditLog;
}

const TenantAuditLogModal = (props: Props) => {
  // This component wraps the base AuditLogModal and transforms riskLevelAlias data.
  // Each risk level gets one entry showing: alias (if exists), else level name, else "(level disabled)"

  const { data } = props;

  const transformedData = useMemo(() => {
    const formatRiskLevelValue = (
      levelData: RiskLevelAlias | undefined,
      level: RiskLevel,
    ): string => {
      if (!levelData) {
        return '';
      }

      if (levelData.isActive === false) {
        return '(level disabled)';
      }

      if (levelData.alias) {
        return levelData.alias;
      }

      return level;
    };

    const transformRiskLevelAlias = (settings: TenantSettings): TenantSettings => {
      if (!settings || !settings.riskLevelAlias) {
        return settings;
      }

      const transformed = { ...settings };

      // Create a map for easy lookup
      const levelMap = new Map<RiskLevel, RiskLevelAlias>();
      settings.riskLevelAlias.forEach((item) => levelMap.set(item.level, item));

      // Transform to object with level as key and formatted value
      const riskLevelAliasMap: Record<string, string> = {};

      RISK_LEVELS.forEach((level) => {
        const levelData = levelMap.get(level);
        const formattedValue = formatRiskLevelValue(levelData, level);
        if (formattedValue) {
          riskLevelAliasMap[level] = formattedValue;
        }
      });

      transformed.riskLevelAlias = riskLevelAliasMap as any;
      return transformed;
    };

    return {
      type: data.type,
      oldImage: transformRiskLevelAlias(data.oldImage as TenantSettings),
      newImage: transformRiskLevelAlias(data.newImage as TenantSettings),
      showNotChanged: true,
      showOldImage: true,
      metaData: data.logMetadata,
    };
  }, [data]);

  return <AuditLogModal data={transformedData} />;
};

export default TenantAuditLogModal;
