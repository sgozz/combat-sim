import type { MatchState, HexCoord, TurnMovementState, ReachableHexInfo, RulesetId } from '../types';
import type { ManeuverType, Posture, Equipment, Attributes, DerivedStats } from './gurps/types';

export type MovementState = {
  position: HexCoord;
  facing: number;
  movePointsRemaining: number;
  freeRotationUsed: boolean;
  movedBackward: boolean;
};

export type PostureModifiers = {
  toHitMelee: number;
  toHitRanged: number;
  defenseVsMelee: number;
  defenseVsRanged: number;
  moveMultiplier: number;
};

export type EncumbranceInfo = {
  level: number;
  name: string;
  movePenalty: number;
  dodgePenalty: number;
  totalWeight: number;
  basicLift: number;
};

export type ServerRulesetAdapter = {
  id: RulesetId;
  advanceTurn: (state: MatchState) => MatchState;
  initializeTurnMovement: (
    position: HexCoord,
    facing: number,
    maneuver: ManeuverType | null,
    basicMove: number,
    posture: Posture
  ) => TurnMovementState;
  calculateReachableHexesInfo: (state: TurnMovementState, occupiedHexes: HexCoord[]) => ReachableHexInfo[];
  gridToHex: (pos: { x: number; z: number }) => HexCoord;
  hexToGrid: (hex: HexCoord) => { x: number; y: number; z: number };
  executeMove?: (state: MovementState, targetHex: HexCoord, occupiedHexes: HexCoord[]) => MovementState | null;
  executeRotation?: (state: MovementState, newFacing: number) => MovementState | null;
  calculateDerivedStats: (attributes: Attributes) => DerivedStats;
  getPostureModifiers?: (posture: Posture) => PostureModifiers;
  calculateEncumbrance?: (strength: number, equipment: Equipment[]) => EncumbranceInfo;
  canChangePostureFree?: (from: Posture, to: Posture) => boolean;
};

import {
  advanceTurn as gurpsAdvanceTurn,
  initializeTurnMovement as gurpsInitializeTurnMovement,
  calculateReachableHexesInfo as gurpsCalculateReachableHexesInfo,
  gridToHex as gurpsGridToHex,
  hexToGrid as gurpsHexToGrid,
  executeMove as gurpsExecuteMove,
  executeRotation as gurpsExecuteRotation,
  calculateDerivedStats as gurpsCalculateDerivedStats,
  getPostureModifiers as gurpsGetPostureModifiers,
  calculateEncumbrance as gurpsCalculateEncumbrance,
  canChangePostureFree as gurpsCanChangePostureFree,
} from './gurps/rules';

import {
  advanceTurn as pf2AdvanceTurn,
  initializeTurnMovement as pf2InitializeTurnMovement,
  calculateReachableHexesInfo as pf2CalculateReachableHexesInfo,
  gridToHex as pf2GridToHex,
  hexToGrid as pf2HexToGrid,
} from './pf2/rules';

const gurpsAdapter: ServerRulesetAdapter = {
  id: 'gurps',
  advanceTurn: gurpsAdvanceTurn,
  initializeTurnMovement: gurpsInitializeTurnMovement,
  calculateReachableHexesInfo: gurpsCalculateReachableHexesInfo,
  gridToHex: gurpsGridToHex,
  hexToGrid: gurpsHexToGrid,
  executeMove: gurpsExecuteMove,
  executeRotation: gurpsExecuteRotation,
  calculateDerivedStats: gurpsCalculateDerivedStats,
  getPostureModifiers: gurpsGetPostureModifiers,
  calculateEncumbrance: gurpsCalculateEncumbrance,
  canChangePostureFree: gurpsCanChangePostureFree,
};

const pf2Adapter: ServerRulesetAdapter = {
  id: 'pf2',
  advanceTurn: pf2AdvanceTurn,
  initializeTurnMovement: (position, facing, _maneuver, basicMove, _posture) => {
    return pf2InitializeTurnMovement(position, facing, basicMove);
  },
  calculateReachableHexesInfo: pf2CalculateReachableHexesInfo,
  gridToHex: pf2GridToHex,
  hexToGrid: pf2HexToGrid,
  executeMove: undefined,
  executeRotation: undefined,
  calculateDerivedStats: (attributes: Attributes): DerivedStats => {
    const st = attributes.strength;
    const dx = attributes.dexterity;
    const ht = attributes.health;
    const basicSpeed = (ht + dx) / 4;
    return {
      hitPoints: st,
      fatiguePoints: ht,
      basicSpeed,
      basicMove: Math.floor(basicSpeed),
      dodge: Math.floor(basicSpeed) + 3,
    };
  },
  getPostureModifiers: undefined,
  calculateEncumbrance: undefined,
  canChangePostureFree: undefined,
};

const adapters: Record<RulesetId, ServerRulesetAdapter> = {
  gurps: gurpsAdapter,
  pf2: pf2Adapter,
};

export const getServerAdapter = (rulesetId: RulesetId): ServerRulesetAdapter => {
  const adapter = adapters[rulesetId];
  if (!adapter) {
    console.warn(`Unknown ruleset: ${rulesetId}, falling back to GURPS`);
    return gurpsAdapter;
  }
  return adapter;
};

export const isGurpsMatch = (match: MatchState): boolean => {
  return match.rulesetId === 'gurps' || !match.rulesetId;
};

export const isPf2Match = (match: MatchState): boolean => {
  return match.rulesetId === 'pf2';
};
