import Nango from '@nangohq/frontend';
import { startCase } from 'lodash';
import s from './styles.module.less';
import FreshdeskIcon from './freshdesk_logo.png';
import SettingsCard from '@/components/library/SettingsCard';
import {
  useDeleteNangoConnection,
  useNangoConnections,
  useCreateNangoConnection,
} from '@/hooks/api/settings';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Button from '@/components/library/Button';
import DeleteLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';

export const CRMSettings = () => {
  const queryResults = useNangoConnections();
  const deleteConnection = useDeleteNangoConnection();
  const createConnection = useCreateNangoConnection();
  const nango = new Nango({});

  const getIcon = (integration: string) => {
    switch (integration) {
      case 'freshdesk':
        return FreshdeskIcon;
      default:
        return null;
    }
  };

  return (
    <SettingsCard
      title="CRM Settings"
      description="Create and manage your CRM connections"
      minRequiredResources={['read:::settings/add-ons/crm-integrations/*']}
    >
      <AsyncResourceRenderer resource={queryResults.data}>
        {(data) => {
          return (
            <div className={s.crmSettings}>
              {data.currentIntegrations.map((integration) => (
                <div key={integration.providerConfigKey} className={s.crmSettingsItem}>
                  <img
                    src={getIcon(integration.providerConfigKey)}
                    alt={integration.providerConfigKey}
                    className={s.crmSettingsItemIcon}
                  />
                  <div className={s.crmSettingsItemName}>
                    {startCase(integration.providerConfigKey)}
                  </div>
                  <Button
                    type="TEXT"
                    icon={<DeleteLineIcon />}
                    size="SMALL"
                    requiredResources={['write:::settings/add-ons/crm-integrations/*']}
                    onClick={async () => {
                      await deleteConnection.mutateAsync({
                        providerConfigKey: integration.providerConfigKey,
                        connectionId: integration.connectionId,
                      });
                      queryResults.refetch();
                    }}
                  />
                </div>
              ))}
              <Button
                className={s.crmSettingsButton}
                type="TETRIARY"
                size="LARGE"
                requiredResources={['write:::settings/add-ons/*']}
                onClick={() => {
                  nango.openConnectUI({
                    sessionToken: data.token,

                    onEvent: async (event) => {
                      if (event.type === 'connect') {
                        await createConnection.mutateAsync({
                          connectionId: event.payload.connectionId,
                          providerConfigKey: event.payload.providerConfigKey,
                        });
                        queryResults.refetch();
                      }
                    },
                  });
                }}
              >
                + Connect
              </Button>
            </div>
          );
        }}
      </AsyncResourceRenderer>
    </SettingsCard>
  );
};
