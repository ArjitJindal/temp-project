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
  let {
    role,
    tenantId,
    tenantName,
    region,
    consoleApiUrl,
    apiAudience,
    allowTenantDeletion,
    allowedRegions,
  } = app_metadata
  let auth0Domain = ''
  let mfaEnabled = false
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
          region = organization.metadata.region
          consoleApiUrl = organization.metadata.consoleApiUrl
          apiAudience = organization.metadata.apiAudience
          tenantId = organization.metadata.tenantId ?? tenantId
          auth0Domain = organization.metadata.auth0Domain
        }
      }

      mfaEnabled = organization.metadata.mfaEnabled === 'true'

      // https://auth0.com/docs/customize/actions/flows-and-triggers/login-flow/api-object
      if (!mfaEnabled) {
        api.multifactor.enable('none')
      } else {
        /**
         * --- AUTH0 ACTIONS TEMPLATE https://github.com/auth0/opensource-marketplace/blob/main/templates/require-mfa-once-per-session-POST_LOGIN ---
         */
        if (
          !event.authentication ||
          !Array.isArray(event.authentication.methods) ||
          !event.authentication.methods.find((method) => method.name === 'mfa')
        ) {
          api.multifactor.enable('any', { allowRememberBrowser: true }) // Make it to False to require MFA every time
        } else {
          api.multifactor.enable('none')
        }
      }

      const roles = event.authorization.roles
      if (roles.length === 1) {
        let role = event.authorization.roles[0]
        if (role.indexOf(':') > -1 && role.length - 1 > role.indexOf(':')) {
          role = role.split(':')[1]
        }
        api.user.setAppMetadata('role', role)
      } else if (roles.length > 1) {
        const userRoles = await management.getUserRoles({ id: user_id })
        const currentRole = userRoles.find((r) => {
          const roleNameSplit = r.name.split(':')
          if (roleNameSplit.length === 1) return r.name === role
          return role.split(':')[1] === role
        })
        await management.removeRolesFromUser(
          { id: user_id },
          { roles: userRoles.filter((r) => r.id !== currentRole?.id) }
        )
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
    api.accessToken.setCustomClaim(namespace + '/mfa', mfaEnabled)
    api.accessToken.setCustomClaim(namespace + '/tenantId', tenantId)
    api.accessToken.setCustomClaim(namespace + '/tenantName', tenantName)
    api.accessToken.setCustomClaim(namespace + '/region', region)
    api.accessToken.setCustomClaim(
      namespace + '/tenantConsoleApiUrl',
      consoleApiUrl
    )
    api.accessToken.setCustomClaim(
      namespace + '/tenantApiAudience',
      apiAudience
    )
    api.accessToken.setCustomClaim(namespace + '/demoMode', demoMode === true)
    api.accessToken.setCustomClaim(namespace + '/auth0Domain', auth0Domain)
    api.accessToken.setCustomClaim(
      namespace + '/allowTenantDeletion',
      allowTenantDeletion === true
    )
    if (allowedRegions) {
      api.accessToken.setCustomClaim(
        namespace + '/allowedRegions',
        allowedRegions
      )
    }
  }
}
