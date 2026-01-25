import type { MatchState } from "../../shared/types";
import { getServerAdapter } from "../../shared/rulesets";
import { assertRulesetId } from "../../shared/rulesets/defaults";

export const advanceTurn = (matchState: MatchState): MatchState => {
  const adapter = getServerAdapter(assertRulesetId(matchState.rulesetId));
  return adapter.advanceTurn(matchState);
};
