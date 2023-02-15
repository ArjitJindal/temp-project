exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://flagright.com'
  const {
    app_metadata,
    user_metadata,
    user_id,
    email,
    name,
    picture,
    email_verified,
  } = event.user
  let { demoMode } = user_metadata
  let { role, tenantId, tenantName, consoleApiUrl, apiAudience } = app_metadata

  if (event.authorization) {
    try {
      const ManagementClient = require('auth0').ManagementClient
      const management = new ManagementClient({
        domain: event.secrets.domain,
        clientId: event.secrets.clientId,
        clientSecret: event.secrets.clientSecret,
      })
      const [organization] = await management.users.getUserOrganizations({
        id: user_id,
      })
      if (organization != null) {
        tenantId = organization.name
        tenantName = organization.display_name ?? tenantName
        if (organization.metadata != null) {
          consoleApiUrl = organization.metadata.consoleApiUrl
          apiAudience = organization.metadata.apiAudience
          tenantId = organization.metadata.tenantId ?? tenantId
        }
      }
    } catch (e) {
      console.error(e)
    }

    api.accessToken.setCustomClaim(namespace + '/name', name)
    api.accessToken.setCustomClaim(namespace + '/picture', picture)
    api.accessToken.setCustomClaim(namespace + '/role', role)
    api.accessToken.setCustomClaim(namespace + '/userId', user_id)
    api.accessToken.setCustomClaim(
      namespace + '/verifiedEmail',
      email_verified ? email : undefined
    )
    api.accessToken.setCustomClaim(namespace + '/tenantId', tenantId)
    api.accessToken.setCustomClaim(namespace + '/tenantName', tenantName)
    api.accessToken.setCustomClaim(
      namespace + '/tenantConsoleApiUrl',
      consoleApiUrl
    )
    api.accessToken.setCustomClaim(
      namespace + '/tenantApiAudience',
      apiAudience
    )
    api.accessToken.setCustomClaim(namespace + '/demoMode', demoMode === true)
    api.idToken.setCustomClaim(namespace + '/name', name)
    api.idToken.setCustomClaim(namespace + '/picture', picture)
    api.idToken.setCustomClaim(namespace + '/role', role)
    api.idToken.setCustomClaim(namespace + '/userId', user_id)
    api.idToken.setCustomClaim(
      namespace + '/verifiedEmail',
      email_verified ? email : undefined
    )
    api.idToken.setCustomClaim(namespace + '/tenantId', tenantId)
    api.idToken.setCustomClaim(namespace + '/tenantName', tenantName)
    api.idToken.setCustomClaim(
      namespace + '/tenantConsoleApiUrl',
      consoleApiUrl
    )
    api.idToken.setCustomClaim(namespace + '/tenantApiAudience', apiAudience)

    if (event.authorization.roles.length > 0) {
      let role = event.authorization.roles[0]
      if (role.indexOf(':') > -1 && role.length - 1 > role.indexOf(':')) {
        role = role.split(':')[1]
      }
      api.user.setAppMetadata('role', role)
      api.idToken.setCustomClaim(namespace + '/role', role)
    }
  }
}
