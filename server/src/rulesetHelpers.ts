import type { MatchState } from "../../shared/types";
import { getServerAdapter } from "../../shared/rulesets";

export const advanceTurn = (matchState: MatchState): MatchState => {
  const adapter = getServerAdapter(matchState.rulesetId ?? 'gurps');
  return adapter.advanceTurn(matchState);
};
