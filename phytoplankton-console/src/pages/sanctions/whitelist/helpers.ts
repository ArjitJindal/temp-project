import { Adapter } from '@/utils/routing';
import { AllParams } from '@/components/library/Table/types';
import { defaultQueryAdapter } from '@/components/library/Table/queryAdapter';
import { isValidSanctionsScreeningEntity } from '@/apis/models-custom/SanctionsScreeningEntity';
import { isValidSanctionsDetailsEntityType } from '@/apis/models-custom/SanctionsDetailsEntityType';
import { SanctionsWhitelistTableParams } from '@/components/SanctionsWhitelistTable/helpers';

export const queryAdapter: Adapter<AllParams<SanctionsWhitelistTableParams>> = {
  serializer: (params: AllParams<SanctionsWhitelistTableParams>) => {
    return {
      ...defaultQueryAdapter.serializer(params),
      userId: params.userId,
      entity: params.entity,
      entityType: params.entityType,
    };
  },
  deserializer: (raw): AllParams<SanctionsWhitelistTableParams> => {
    return {
      ...defaultQueryAdapter.deserializer(raw),
      userId: raw.userId,
      entity: isValidSanctionsScreeningEntity(raw.entity) ? raw.entity : undefined,
      entityType: isValidSanctionsDetailsEntityType(raw.entityType) ? raw.entityType : undefined,
    };
  },
};
