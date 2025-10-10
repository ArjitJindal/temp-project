import { aws_codepipeline as codepipline } from 'aws-cdk-lib'

export const SOURCE_ARTIFACT = new codepipline.Artifact('source')
export const TARPON_BUILD_ARTIFACT = new codepipline.Artifact('tarpon')
export const E2E_ARTIFACT = new codepipline.Artifact('e2e')
