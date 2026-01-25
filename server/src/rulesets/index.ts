import type { RulesetId } from "../../../shared/types";
import type { RulesetServerFactory } from "./types";
import { gurpsServerFactory } from "./gurps";
import { pf2ServerFactory } from "./pf2";

const factories: Record<RulesetId, RulesetServerFactory> = {
  gurps: gurpsServerFactory,
  pf2: pf2ServerFactory,
};

export const getRulesetServerFactory = (rulesetId: RulesetId): RulesetServerFactory => {
  return factories[rulesetId] ?? factories.gurps;
};

export type { RulesetServerFactory } from "./types";
