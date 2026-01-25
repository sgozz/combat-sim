import type { CharacterSheet, MatchState } from "../../../shared/types";
import type { CombatantState } from "../../../shared/rulesets/gurps/types";

export type CharacterFactory = (name: string) => CharacterSheet;

export type CombatantFactory = (
  character: CharacterSheet,
  playerId: string,
  position: { x: number; y: number; z: number },
  facing: number
) => CombatantState;

export type BotAttackExecutor = (
  matchId: string,
  match: MatchState,
  botCombatant: CombatantState,
  target: CombatantState,
  activePlayer: { id: string; name: string }
) => Promise<MatchState>;

export interface RulesetServerFactory {
  createDefaultCharacter: CharacterFactory;
  createCombatant: CombatantFactory;
  executeBotAttack: BotAttackExecutor;
}
