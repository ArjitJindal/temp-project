import crypto from 'crypto'
import { Construct } from 'constructs'
import { Resource } from 'aws-cdk-lib'
import { Effect, IRole, Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { Config } from '@flagright/lib/config/config'
import { SecretName } from '@flagright/lib/secrets/secrets'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'

export function secretArn(context: Construct, secretName: SecretName): string {
  return Secret.fromSecretNameV2(context, secretName, secretName)
    .secretFullArn as string
}

export function grantMongoDbAccess(
  context: Construct & { config: Config },
  id: string,
  role: IRole
) {
  role?.attachInlinePolicy(
    new Policy(context, id, {
      policyName: `${role.roleName}-MongoDbPolicy`,
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['secretsmanager:GetSecretValue'],
          resources: [secretArn(context, 'mongoAtlasCreds')],
        }),
      ],
    })
  )
}

export function grantSecretsManagerAccessByPrefix(
  context: Construct,
  resource: Resource & { role?: IRole },
  prefix: string,
  mode: 'READ' | 'WRITE' | 'READ_WRITE'
) {
  grantSecretsManagerAccess(
    context,
    resource,
    [`arn:aws:secretsmanager:*:*:secret:*/${prefix}/*`],
    mode
  )
}

export function grantSecretsManagerAccessByPattern(
  context: Construct,
  resource: Resource & { role?: IRole },
  pattern: string,
  mode: 'READ' | 'WRITE' | 'READ_WRITE'
) {
  grantSecretsManagerAccess(
    context,
    resource,
    [`arn:aws:secretsmanager:*:*:secret:*${pattern}*`],
    mode
  )
}

export function grantSecretsManagerAccess(
  context: Construct,
  resource: Resource & { role?: IRole },
  resources: string[],
  mode: 'READ' | 'WRITE' | 'READ_WRITE'
) {
  const aliasIdentifier = resource.node.id.replace(/:/g, '-')
  const actions: string[] = []
  if (mode === 'READ' || mode === 'READ_WRITE') {
    actions.push('secretsmanager:GetSecretValue')
  }
  if (mode === 'WRITE' || mode === 'READ_WRITE') {
    actions.push('secretsmanager:CreateSecret')
    actions.push('secretsmanager:DeleteSecret')
  }

  const hash = crypto
    .createHash('md5')
    .update([aliasIdentifier, ...resources].join())
    .digest()
    .toString()
    .replace(/\W/g, '')
    .slice(0, 10)
  resource.role?.attachInlinePolicy(
    new Policy(context, `SecretsManagerPolicy-${hash}`, {
      policyName: `${aliasIdentifier}${hash}-SecretsManagerPolicy`,
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: actions,
          resources,
        }),
      ],
    })
  )
}
