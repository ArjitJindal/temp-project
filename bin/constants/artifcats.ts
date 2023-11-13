import { aws_codepipeline as codepipline } from "aws-cdk-lib";

export const sourceOutput = new codepipline.Artifact("SourceOutput");
export const tarponBuildOutput = new codepipline.Artifact("TarponBuildOutput");
