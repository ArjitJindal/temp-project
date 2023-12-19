import { config as devConfig } from "../config/config-dev";
import { config as sandboxConfig } from "../config/config-sandbox";
import { config as prodConfigAsia1 } from "../config/config-prod-asia-1";
import { config as prodConfigAsia2 } from "../config/config-prod-asia-2";
import { config as prodConfigEu1 } from "../config/config-prod-eu-1";
import { config as prodConfigEu2 } from "../config/config-prod-eu-2";
import { config as prodConfigUs1 } from "../config/config-prod-us-1";
import { config as prodConfigAu1 } from "../config/config-prod-au-1";
import { config as localConfig } from "../config/config-local";
import { FlagrightRegion, Stage } from "./deploy";

export const CONFIG_MAP = {
  test: {
    "eu-1": localConfig,
  },
  deploy: {},
  local: {
    "eu-1": localConfig,
  },
  dev: {
    "eu-1": devConfig,
  },
  sandbox: {
    "eu-1": sandboxConfig,
  },
  prod: {
    "asia-1": prodConfigAsia1,
    "asia-2": prodConfigAsia2,
    "eu-1": prodConfigEu1,
    "eu-2": prodConfigEu2,
    "us-1": prodConfigUs1,
    "au-1": prodConfigAu1,
  },
};

export function getTarponConfig(stage: string, region: string) {
  // Ignored as we already throw an exception when not valid, and the typing doesn't compute.
  // @ts-ignore
  const cfg = CONFIG_MAP[stage]?.[region];
  if (!cfg) {
    throw new Error(
      `No config found for stage: ${stage} and region: ${region}`,
    );
  }
  return cfg;
}
