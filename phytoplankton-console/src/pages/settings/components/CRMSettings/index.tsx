import Nango from '@nangohq/frontend';
import { startCase } from 'lodash';
import s from './styles.module.less';
import FreshdeskIcon from './freshdesk_logo.png';
import SettingsCard from '@/components/library/SettingsCard';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Button from '@/components/library/Button';
import DeleteLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import { NANGO_CONNECTIONS } from '@/utils/queries/keys';

export const CRMSettings = () => {
  const api = useApi();
  const queryResults = useQuery(NANGO_CONNECTIONS(), () => api.getTenantsNangoConnections());
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
    <SettingsCard title="CRM Settings" description="Create and manage your CRM connections">
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
                    requiredPermissions={['settings:add-ons:write']}
                    onClick={async () => {
                      await api.deleteTenantsNangoConnections({
                        NangoPostConnect: {
                          providerConfigKey: integration.providerConfigKey,
                          connectionId: integration.connectionId,
                        },
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
                requiredPermissions={['settings:add-ons:write']}
                onClick={() => {
                  nango.openConnectUI({
                    sessionToken: data.token,

                    onEvent: async (event) => {
                      if (event.type === 'connect') {
                        await api.postTenantsNangoConnections({
                          NangoPostConnect: {
                            connectionId: event.payload.connectionId,
                            providerConfigKey: event.payload.providerConfigKey,
                          },
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
