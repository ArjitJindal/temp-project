import { Fragment, useCallback, useMemo, useState } from 'react';
import { isValidEmail } from '@flagright/lib/utils';
import { featureDescriptions } from '../../../Footer/SuperAdminPanel/index';
import { tenantAuth0Domain } from '../../../../../../utils/auth0Domain';
import s from './index.module.less';
import Modal from '@/components/library/Modal';
import { JsonSchemaForm } from '@/components/JsonSchemaForm';
import { getFixedSchemaJsonForm } from '@/utils/json';
import { useApi } from '@/api';
import { TenantCreationResponse } from '@/apis';
import { getErrorMessage } from '@/utils/lang';
import { Feature } from '@/apis/models/Feature';
import { useAuth0User } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import { useSARReportCountries } from '@/hooks/api';
import { H3, P } from '@/components/ui/Typography';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface FormDetails {
  tenantName: string;
  tenantWebsite: string;
  tenantId?: string;
  auth0DisplayName: string;
  auth0Domain: string;
  emailsOfAdmins: string[];
  featureFlags: Feature[];
  demoMode: boolean;
  siloDataMode: boolean;
}

const currentEnv = process.env.ENV_NAME;
let envToDisplay: string;

switch (currentEnv) {
  case 'local':
  case 'dev':
  case 'dev:user':
    envToDisplay = 'Development';
    break;
  case 'sandbox':
    envToDisplay = 'Sandbox';
    break;
  case 'prod':
    envToDisplay = 'Production';
    break;
  default:
    envToDisplay = 'Unknown';
}

export const CreateTenantModal = (props: Props) => {
  const { visible, onClose } = props;

  const UPDATED_FEATURES: Record<Feature, { title: string; description: string }> = useMemo(() => {
    return Object.keys(featureDescriptions)
      .filter((key) => key !== 'DEMO_MODE')
      .sort((a, b) => {
        const valueA = featureDescriptions[a as Feature].title.toLowerCase();
        const valueB = featureDescriptions[b as Feature].title.toLowerCase();
        return valueA.localeCompare(valueB);
      })
      .reduce((acc, key) => {
        acc[key as Feature] = featureDescriptions[key as Feature];
        return acc;
      }, {} as Record<Feature, { title: string; description: string }>);
  }, []);
  const [formDetails, setFormDetails] = useState<FormDetails>({
    tenantName: '',
    tenantWebsite: '',
    emailsOfAdmins: [],
    featureFlags: [],
    demoMode: false,
    auth0DisplayName: '',
    auth0Domain: tenantAuth0Domain(),
    siloDataMode: false,
  });

  const api = useApi();
  const auth0User = useAuth0User();
  const [response, setResponse] = useState<TenantCreationResponse | null>(null);

  const handleFormDetailsChange = useCallback((newFormDetails) => {
    setFormDetails(newFormDetails.formData);
  }, []);

  const handleCreateTenant = useCallback(async () => {
    const tenantName = formDetails.tenantName.replaceAll(' ', '');
    const tenantWebsite = formDetails.tenantWebsite.replaceAll(' ', '');
    const tenantId = formDetails.tenantId?.replaceAll(' ', '');
    const auth0DisplayName = formDetails.auth0DisplayName.replaceAll(' ', '');
    const auth0Domain = formDetails.auth0Domain.replaceAll(' ', '');
    const emailsOfAdmins = formDetails.emailsOfAdmins.map((email) => email.replaceAll(' ', ''));
    const { featureFlags, demoMode, siloDataMode } = formDetails;

    if (tenantId && tenantId.endsWith('-test')) {
      message.error('Tenant id should not end with -test');
      return;
    }

    if (
      !(tenantName && tenantWebsite && auth0DisplayName && auth0Domain && emailsOfAdmins?.length)
    ) {
      message.error('Please fill all the required fields');
      return;
    }

    const invalidEmails = emailsOfAdmins?.filter((email) => !isValidEmail(email));

    if (invalidEmails.length) {
      message.error(`Invalid email(s): ${invalidEmails.join(', ')}`);
      return;
    }

    try {
      const response = await api.postCreateTenant({
        TenantCreationRequest: {
          tenantName,
          tenantWebsite,
          ...(tenantId && { tenantId }),
          auth0DisplayName,
          auth0Domain,
          adminEmails: emailsOfAdmins,
          features: demoMode ? [...featureFlags, 'DEMO_MODE'] : featureFlags,
          siloDataMode,
        },
      });

      setResponse(response);
      message.success('Tenant created successfully');
    } catch (error) {
      message.fatal(`Error creating tenant ${getErrorMessage(error)}`, error);
    }
  }, [formDetails, api]);
  const isSanctionsEnabled = formDetails.featureFlags.includes('SANCTIONS');
  const isSAREnabled = formDetails.featureFlags.includes('SAR');
  const SARCountries = useSARReportCountries(true);

  const schema = useMemo(
    () => ({
      type: 'object',
      properties: {
        tenantName: {
          type: 'string',
          title: 'Tenant Name',
        },
        auth0DisplayName: {
          type: 'string',
          title: 'Auth0 Display Name',
        },
        tenantWebsite: {
          type: 'string',
          title: 'Tenant Website',
        },
        auth0Domain: {
          type: 'string',
          title: 'Auth0 Domain',
          readOnly: true,
        },
        emailsOfAdmins: {
          type: 'array',
          title: 'Emails of Admins',
          uniqueItems: true,
          items: {
            type: 'string',
            description: 'The email of the admin will assign the role of "admin" in Auth0',
          },
        },
        tenantId: {
          type: 'string',
          title: 'Tenant ID',
        },
        featureFlags: {
          type: 'array',
          title: 'Feature Flags',
          uniqueItems: true,
          items: {
            type: 'string',
            enum: Object.keys(UPDATED_FEATURES),
            enumNames: Object.keys(UPDATED_FEATURES).map(
              (key) =>
                featureDescriptions[key].title +
                (featureDescriptions[key].tag ? ` (${featureDescriptions[key].tag})` : ''),
            ),
          },
        },
        ...(isSAREnabled && {
          sarJurisdiction: {
            type: 'array',
            title: 'SAR Jurisdiction',
            uniqueItems: true,
            items: {
              type: 'string',
              enum: SARCountries.map((country) => country.countryCode),
              enumNames: SARCountries.map((country) => country.country),
            },
          },
        }),
        ...(currentEnv !== 'prod' && {
          demoMode: {
            type: 'boolean',
            title: 'Demo Mode',
          },
        }),
        siloDataMode: {
          type: 'boolean',
          title: 'Silo Data Mode',
        },
      },
      required: [
        'tenantName',
        'auth0DisplayName',
        'tenantWebsite',
        'featureFlags',
        'emailsOfAdmins',
        'auth0Domain',
        'sarJurisdiction',
      ].concat(isSanctionsEnabled ? ['sanctionsMarketType'] : []),
    }),
    [UPDATED_FEATURES, isSanctionsEnabled, isSAREnabled, SARCountries],
  );

  const uiSchema = useMemo(
    () => ({
      tenantName: {
        'ui:help': 'Tenant name (lowercase, no space)',
      },
      tenantWebsite: {
        'ui:help': 'The website of the tenant',
      },
      tenantId: {
        'ui:help':
          'The ID of the tenant (Optional) If not provided, will be generated automatically',
      },
      auth0DisplayName: {
        'ui:help': 'The display name of the tenant in Auth0',
      },
      emailsOfAdmins: {
        'ui:help': 'The emails of the admins of the tenant',
      },
      featureFlags: {
        'ui:help': 'The feature flags of the tenant',
      },
      demoMode: {
        'ui:help': 'Whether to enable demo mode for the tenant',
      },
      siloDataMode: {
        'ui:help':
          'Whether to enable silo data mode for the tenant (This will create a new tables of DynamoDB for the tenant)',
      },
    }),
    [],
  );

  return (
    <Modal
      width="L"
      title={`Create Tenant (${envToDisplay}: ${
        auth0User?.tenantConsoleApiUrl.split('://')[1]?.split('.')[0] ?? 'Unknown'
      })`}
      isOpen={visible}
      onCancel={onClose}
      okText="Create"
      onOk={handleCreateTenant}
      okProps={{ type: 'DANGER' }}
      destroyOnClose
    >
      <JsonSchemaForm
        schema={getFixedSchemaJsonForm(schema)}
        uiSchema={uiSchema}
        onChange={handleFormDetailsChange}
        formData={formDetails}
        liveValidate
      >
        {/* Add dummy children to prevent the form from rendering the submit button */}
        <Fragment />
      </JsonSchemaForm>

      {response && (
        <>
          <H3 className={s.tenantDetailsTitle}>Tenant Details</H3>
          <P>
            <span className={s.boldText}>Tenant Name: </span>
            {formDetails.tenantName}
          </P>
          <P>
            <span className={s.boldText}>Tenant Website: </span>
            {formDetails.tenantWebsite}
          </P>
          <P>
            <span className={s.boldText}>Tenant ID: </span>
            {response.tenantId}
          </P>
          <P>
            <span className={s.boldText}>Auth0 Org ID: </span>
            {response.auth0OrganizationId}
          </P>
          <P>
            <span className={s.boldText}>Auth0 Org Name: </span>
            {formDetails.auth0DisplayName}
          </P>
          <P>
            <span className={s.boldText}>Usage Plan ID: </span>
            {response.usagePlanId}
          </P>
        </>
      )}
    </Modal>
  );
};
