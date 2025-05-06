import { TARPON_BUILD_ARTIFACT } from './artifcats'

const GENERATED_DIRS = [
  'dist',
  'node_modules',
  'src/@types/openapi-internal',
  'src/@types/openapi-internal-custom',
  'src/@types/openapi-public',
  'src/@types/openapi-public-custom',
  'src/@types/openapi-public-management',
  'src/@types/openapi-public-management-custom',
  '.gen',
  'torpedo/dist',
]

const commandMoveGeneratedDirs = () =>
  GENERATED_DIRS.map(
    (dir) =>
      `mv "$CODEBUILD_SRC_DIR_${TARPON_BUILD_ARTIFACT.artifactName}"/${dir} ${dir}`
  )

export { GENERATED_DIRS, commandMoveGeneratedDirs }
