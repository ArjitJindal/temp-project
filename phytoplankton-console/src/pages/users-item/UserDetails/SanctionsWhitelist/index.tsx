import React, { useState } from 'react';
import * as Card from '@/components/ui/Card';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import SanctionsWhitelistTable from '@/components/SanctionsWhitelistTable';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { SanctionsWhitelistTableParams } from '@/components/SanctionsWhitelistTable/helpers';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
}

export default function SanctionsWhitelist(props: Props) {
  const { user } = props;

  const [params, setParams] =
    useState<AllParams<SanctionsWhitelistTableParams>>(DEFAULT_PARAMS_STATE);

  return (
    <Card.Root>
      <Card.Section>
        <SanctionsWhitelistTable
          singleUserMode={true}
          params={{
            ...params,
            userId: user.userId,
          }}
          onChangeParams={setParams}
        />
      </Card.Section>
    </Card.Root>
  );
}
