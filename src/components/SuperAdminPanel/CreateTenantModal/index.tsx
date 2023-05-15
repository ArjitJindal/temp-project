import { Fragment, useCallback, useMemo, useState } from 'react';
import { Typography } from 'antd';
import Modal from '@/components/ui/Modal';
import { JsonSchemaForm } from '@/components/JsonSchemaForm';
import { getFixedSchemaJsonForm } from '@/utils/json';
import { useApi } from '@/api';
import { TenantCreationResponse } from '@/apis';
import { getErrorMessage } from '@/utils/lang';
import COLORS from '@/components/ui/colors';
import { Feature } from '@/apis/models/Feature';
import { useAuth0User } from '@/utils/user-utils';
import { FEATURES } from '@/apis/models-custom/Feature';
import { message } from '@/components/library/Message';

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
  featureFlags: string[];
  demoMode: boolean;
}

const currentEnv = process.env.ENV_NAME;
let envToDisplay: string;

switch (currentEnv) {
  case 'local':
  case 'dev':
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
  const UPDATED_FEATURES = useMemo(() => FEATURES.filter((feature) => feature !== 'DEMO_MODE'), []);
  const [formDetails, setFormDetails] = useState<FormDetails>({
    tenantName: '',
    tenantWebsite: '',
    emailsOfAdmins: [],
    featureFlags: [],
    demoMode: false,
    auth0DisplayName: '',
    auth0Domain: '',
  });

  const api = useApi();
  const auth0User = useAuth0User();
  const [response, setResponse] = useState<TenantCreationResponse | null>(null);

  const handleFormDetailsChange = useCallback((newFormDetails) => {
    setFormDetails(newFormDetails.formData);
  }, []);

  const handleCreateTenant = useCallback(async () => {
    const {
      tenantName,
      tenantWebsite,
      tenantId,
      auth0DisplayName,
      auth0Domain,
      emailsOfAdmins,
      featureFlags,
      demoMode,
    } = formDetails;

    if (
      !tenantName ||
      !tenantWebsite ||
      !auth0DisplayName ||
      !auth0Domain ||
      !emailsOfAdmins?.length
    ) {
      message.error('Please fill in all the required fields');
      return;
    }

    if (
      tenantName.includes(' ') ||
      tenantWebsite.includes(' ') ||
      auth0Domain.includes(' ') ||
      auth0DisplayName.includes(' ') ||
      tenantId?.includes(' ') ||
      emailsOfAdmins.some((email) => email.includes(' '))
    ) {
      message.error('Please remove all spaces from the fields');
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
          features: demoMode
            ? [...(featureFlags as Feature[]), 'DEMO_MODE' as Feature]
            : (featureFlags as Feature[]),
        },
      });

      setResponse(response);
      message.success('Tenant created successfully');
    } catch (error) {
      message.fatal(`Error creating tenant ${getErrorMessage(error)}`, error);
    }
  }, [formDetails, api]);

  const schema = useMemo(
    () => ({
      type: 'object',
      properties: {
        tenantName: {
          type: 'string',
          title: 'Tenant Name',
        },
        tenantWebsite: {
          type: 'string',
          title: 'Tenant Website',
        },
        tenantId: {
          type: 'string',
          title: 'Tenant ID',
        },
        auth0DisplayName: {
          type: 'string',
          title: 'Auth0 Display Name',
        },
        auth0Domain: {
          type: 'string',
          title: 'Auth0 Domain',
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
        featureFlags: {
          type: 'array',
          title: 'Feature Flags',

          uniqueItems: true,
          items: {
            type: 'string',
            enum: UPDATED_FEATURES,
          },
        },
        ...(currentEnv !== 'prod' && {
          demoMode: {
            type: 'boolean',
            title: 'Demo Mode',
          },
        }),
      },
      required: [
        'tenantName',
        'auth0DisplayName',
        'tenantWebsite',
        'featureFlags',
        'emailsOfAdmins',
        'auth0Domain',
      ],
    }),
    [UPDATED_FEATURES],
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
      auth0Domain: {
        'ui:help':
          'If the tenant does not belong to our white-label customer, please add "http://sandbox-flagright.eu.auth0.com/" as the Auth0 Domain. However, if the tenant belongs to our white-label customer, please add the Auth0 domain for their specific bureau, for example, "bureau-flagright.eu.auth0.com".',
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
    }),
    [],
  );

  return (
    <Modal
      title={`Create Tenant (${envToDisplay}: ${
        auth0User?.tenantConsoleApiUrl.split('://')[1]?.split('.')[0] ?? 'Unknown'
      })`}
      style={{ top: 20 }}
      width="80%"
      isOpen={visible}
      onCancel={onClose}
      okText="Create"
      onOk={handleCreateTenant}
      okProps={{ danger: true }}
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
          <Typography.Title
            level={3}
            style={{ marginBottom: '0.5rem', color: COLORS.brandBlue.base }}
          >
            Tenant Details
          </Typography.Title>
          <Typography.Paragraph>
            <Typography.Text strong>Tenant Name: </Typography.Text>
            {formDetails.tenantName}
          </Typography.Paragraph>
          <Typography.Paragraph>
            <Typography.Text strong>Tenant Website: </Typography.Text>
            {formDetails.tenantWebsite}
          </Typography.Paragraph>
          <Typography.Paragraph>
            <Typography.Text strong>Tenant ID: </Typography.Text>
            {response.tenantId}
          </Typography.Paragraph>
          <Typography.Paragraph>
            <Typography.Text strong>Auth0 Org ID: </Typography.Text>
            {response.auth0OrganizationId}
          </Typography.Paragraph>
          <Typography.Paragraph>
            <Typography.Text strong>Auth0 Org Name: </Typography.Text>
            {formDetails.auth0DisplayName}
          </Typography.Paragraph>
          <Typography.Paragraph>
            <Typography.Text strong>Api Key: </Typography.Text>
            {response.apiKey}
          </Typography.Paragraph>
          <Typography.Paragraph>
            <Typography.Text strong>Usage Plan ID: </Typography.Text>
            {response.usagePlanId}
          </Typography.Paragraph>
        </>
      )}
    </Modal>
  );
};
