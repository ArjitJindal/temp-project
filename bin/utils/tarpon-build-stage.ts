import { aws_codebuild as codebuild, aws_iam as iam } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { installTerraform } from '../constants/terraform-commands'
import { getSentryReleaseSpec } from './sentry-release-spec'
import { GENERATED_DIRS } from '../constants/generatedDirs'

export const buildTarpon = (scope: Construct, role: iam.IRole) => {
  return new codebuild.PipelineProject(scope, 'BuildTarpon', {
    buildSpec: codebuild.BuildSpec.fromObject({
      version: '0.2',
      phases: {
        install: {
          'runtime-versions': {
            nodejs: 18,
          },
          commands: [
            'corepack enable',
            'yarn set version 4.0.2',
            'yarn install --immutable',
            'cd lib',
            'yarn install --immutable',
            'cd ../tarpon',
            'yarn install --immutable',
          ],
        },
        build: {
          commands: [
            ...installTerraform,
            'yarn build',
            ...getSentryReleaseSpec(false).commands,
          ],
        },
      },
      cache: {
        paths: ['node_modules/**/*'],
      },
      artifacts: {
        'base-directory': 'tarpon',
        files: GENERATED_DIRS.map((dir) => `${dir}/**/*`),
      },
      env: getSentryReleaseSpec(false).env,
    }),
    environment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      computeType: codebuild.ComputeType.LARGE,
    },
    role,
  })
}
