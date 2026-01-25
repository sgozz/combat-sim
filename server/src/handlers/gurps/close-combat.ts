import type { WebSocket } from "ws";
import type {
  MatchState,
  Player,
} from "../../../../shared/types";
import { isGurpsCharacter } from "../../../../shared/rulesets/characterSheet";
import type { CombatActionPayload } from "../../../../shared/rulesets/gurps/types";
import type { GurpsCharacterSheet } from "../../../../shared/rulesets/gurps/characterSheet";
import { advanceTurn } from "../../rulesetHelpers";
import { getServerAdapter } from "../../../../shared/rulesets/serverAdapter";
import { state } from "../../state";
import { updateMatchState } from "../../db";
import { 
  sendMessage, 
  sendToMatch, 
  getCombatantByPlayerId, 
  getCharacterById,
  calculateHexDistance,
  findFreeAdjacentHex,
} from "../../helpers";
import { scheduleBotTurn } from "../../bot";
import { formatRoll } from "../shared/damage";

export const handleEnterCloseCombat = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: CombatActionPayload & { type: "enter_close_combat" }
): Promise<void> => {
  if (!actorCombatant) return;
  
  if (match.rulesetId === 'pf2') {
    sendMessage(socket, { type: "error", message: "Close combat not available in PF2. Use Grapple action instead." });
    return;
  }
  
  const adapter = getServerAdapter(match.rulesetId);
  
  if (actorCombatant.inCloseCombatWith) {
    sendMessage(socket, { type: "error", message: "Already in close combat." });
    return;
  }
  
  const targetCombatant = match.combatants.find(c => c.playerId === payload.targetId);
  if (!targetCombatant) {
    sendMessage(socket, { type: "error", message: "Target not found." });
    return;
  }
  
  if (targetCombatant.inCloseCombatWith && targetCombatant.inCloseCombatWith !== player.id) {
    sendMessage(socket, { type: "error", message: "Target is already in close combat with someone else." });
    return;
  }
  
  const distance = calculateHexDistance(actorCombatant.position, targetCombatant.position);
  if (distance > 1) {
    sendMessage(socket, { type: "error", message: "Must be adjacent to enter close combat." });
    return;
  }
  
  const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  if (!attackerCharacter || !targetCharacter) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }
  
  if (!('attributes' in attackerCharacter) || !('attributes' in targetCharacter)) {
    sendMessage(socket, { type: "error", message: "Invalid character type." });
    return;
  }
  
  const attackerSkills = attackerCharacter.skills as Array<{ level?: number }>;
  const defenderSkills = targetCharacter.skills as Array<{ level?: number }>;
  const attackerSkill = attackerSkills[0]?.level ?? attackerCharacter.attributes.dexterity;
  const defenderSkill = defenderSkills[0]?.level ?? targetCharacter.attributes.dexterity;
  
  const contest = adapter.closeCombat!.quickContest(attackerSkill, defenderSkill);
  
  if (contest.attackerWins) {
    const updatedCombatants = match.combatants.map(c => {
      if (c.playerId === player.id) {
        return { ...c, inCloseCombatWith: payload.targetId, closeCombatPosition: 'front' as const, position: targetCombatant.position };
      }
      if (c.playerId === payload.targetId) {
        return { ...c, inCloseCombatWith: player.id, closeCombatPosition: 'front' as const };
      }
      return c;
    });
    
    const logEntry = `${attackerCharacter.name} enters close combat with ${targetCharacter.name}! ${formatRoll(contest.attacker, 'Skill')} vs ${formatRoll(contest.defender, 'Resist')}`;
    
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, logEntry],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    sendToMatch(matchId, { 
      type: "visual_effect", 
      matchId,
      effect: { type: "close_combat", attackerId: player.id, targetId: payload.targetId, position: targetCombatant.position } 
    });
    sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
  } else {
    const logEntry = `${attackerCharacter.name} fails to enter close combat with ${targetCharacter.name}. ${formatRoll(contest.attacker, 'Skill')} vs ${formatRoll(contest.defender, 'Resist')}`;
    
    const updated = advanceTurn({
      ...match,
      log: [...match.log, logEntry],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
  }
};

export const handleExitCloseCombat = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>
): Promise<void> => {
  if (!actorCombatant) return;
  
  if (match.rulesetId === 'pf2') {
    sendMessage(socket, { type: "error", message: "Close combat not available in PF2." });
    return;
  }
  
  if (!actorCombatant.inCloseCombatWith) {
    sendMessage(socket, { type: "error", message: "Not in close combat." });
    return;
  }
  
  const opponentId = actorCombatant.inCloseCombatWith;
  const opponent = match.combatants.find(c => c.playerId === opponentId);
  
  const exitHex = findFreeAdjacentHex(actorCombatant.position, match.combatants);
  if (!exitHex) {
    sendMessage(socket, { type: "error", message: "No free hex to exit to." });
    return;
  }
  
  if (!opponent || opponent.usedReaction) {
    const updatedCombatants = match.combatants.map(c => {
      if (c.playerId === player.id) {
        return { ...c, inCloseCombatWith: null, closeCombatPosition: null, position: exitHex };
      }
      if (c.playerId === opponentId) {
        return { ...c, inCloseCombatWith: null, closeCombatPosition: null };
      }
      return c;
    });
    
    const actorChar = getCharacterById(match, actorCombatant.characterId);
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${actorChar?.name} exits close combat.`],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
  } else {
    const opponentPlayer = match.players.find(p => p.id === opponentId);
    if (opponentPlayer?.isBot) {
      const updatedCombatants = match.combatants.map(c => {
        if (c.playerId === player.id) {
          return { ...c, inCloseCombatWith: null, closeCombatPosition: null, position: exitHex };
        }
        if (c.playerId === opponentId) {
          return { ...c, inCloseCombatWith: null, closeCombatPosition: null };
        }
        return c;
      });
      
      const actorChar = getCharacterById(match, actorCombatant.characterId);
      const opponentChar = getCharacterById(match, opponent.characterId);
      const updated = advanceTurn({
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, `${actorChar?.name} exits close combat. ${opponentChar?.name} lets them go.`],
      });
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
    } else {
      sendToMatch(matchId, { 
        type: "pending_action", 
        matchId,
        action: { type: 'exit_close_combat_request', exitingId: player.id, targetId: opponentId }
      });
    }
  }
};

export const handleGrapple = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: CombatActionPayload & { type: "grapple" }
): Promise<void> => {
  if (!actorCombatant) return;
  
  const adapter = getServerAdapter(match.rulesetId);
  
  const targetCombatant = match.combatants.find(c => c.playerId === payload.targetId);
  if (!targetCombatant) {
    sendMessage(socket, { type: "error", message: "Target not found." });
    return;
  }
  
  const distance = calculateHexDistance(actorCombatant.position, targetCombatant.position);
  if (distance > 1) {
    sendMessage(socket, { type: "error", message: "Must be adjacent to grapple." });
    return;
  }
  
  const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  if (!attackerCharacter || !targetCharacter) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }
  
  if (!isGurpsCharacter(attackerCharacter) || !isGurpsCharacter(targetCharacter)) {
    sendMessage(socket, { type: "error", message: "Grapple requires GURPS characters." });
    return;
  }
  
  if (payload.action === 'grab') {
    const wrestlingSkill = attackerCharacter.skills.find(s => s.name === 'Wrestling')?.level ?? attackerCharacter.attributes.dexterity;
    const grappleResult = adapter.closeCombat!.resolveGrappleAttempt(
      attackerCharacter.attributes.dexterity,
      wrestlingSkill,
      targetCharacter.attributes.dexterity,
      true
    );
    
    if (grappleResult.success) {
      const cp = grappleResult.controlPoints;
      const updatedCombatants = match.combatants.map(c => {
        if (c.playerId === player.id) {
          return { 
            ...c, 
            grapple: { grappledBy: c.grapple?.grappledBy ?? null, grappling: payload.targetId, cpSpent: cp, cpReceived: c.grapple?.cpReceived ?? 0 },
            inCloseCombatWith: payload.targetId,
            closeCombatPosition: 'front' as const,
            position: targetCombatant.position
          };
        }
        if (c.playerId === payload.targetId) {
          return { 
            ...c, 
            grapple: { grappledBy: player.id, grappling: c.grapple?.grappling ?? null, cpSpent: c.grapple?.cpSpent ?? 0, cpReceived: cp },
            inCloseCombatWith: player.id,
            closeCombatPosition: 'front' as const
          };
        }
        return c;
      });
      
      let logEntry = `${attackerCharacter.name} grapples ${targetCharacter.name}! (${cp} CP) ${formatRoll(grappleResult.attack, 'Wrestling')}`;
      if (grappleResult.defense) {
        logEntry += ` -> ${formatRoll(grappleResult.defense, 'Defend')}`;
      }
      
      const updated = advanceTurn({
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, logEntry],
      });
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { 
        type: "visual_effect", 
        matchId,
        effect: { type: "grapple", attackerId: player.id, targetId: payload.targetId, position: targetCombatant.position } 
      });
      sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
    } else {
      let logEntry = `${attackerCharacter.name} fails to grapple ${targetCharacter.name}. ${formatRoll(grappleResult.attack, 'Wrestling')}`;
      if (grappleResult.defense) {
        logEntry += ` -> ${formatRoll(grappleResult.defense, 'Defend')}`;
      }
      
      const updated = advanceTurn({
        ...match,
        log: [...match.log, logEntry],
      });
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
    }
   } else if (payload.action === 'throw' || payload.action === 'lock' || payload.action === 'choke' || payload.action === 'pin') {
     if (!actorCombatant.grapple?.grappling) {
       sendMessage(socket, { type: "error", message: "Must be grappling to use this technique." });
       return;
     }
     
     const techResult = adapter.closeCombat!.resolveGrappleTechnique(
       payload.action,
       attackerCharacter.skills.find(s => s.name === 'Wrestling')?.level ?? attackerCharacter.attributes.dexterity,
       attackerCharacter.attributes.strength,
       actorCombatant.grapple.cpSpent
     );
    
    if (techResult.success) {
      let updatedCombatants = match.combatants;
      let logEntry = `${attackerCharacter.name} uses ${payload.action} on ${targetCharacter.name}: ${techResult.effect}`;
      
      if (techResult.damage) {
        const dmg = techResult.damage.total;
        updatedCombatants = match.combatants.map(c => {
          if (c.playerId === payload.targetId) {
            return { ...c, currentHP: Math.max(0, c.currentHP - dmg) };
          }
          return c;
        });
        logEntry += ` (${dmg} damage)`;
      }
      
      if (payload.action === 'throw') {
        updatedCombatants = updatedCombatants.map(c => {
          if (c.playerId === payload.targetId) {
            return { 
              ...c, 
              posture: 'prone' as const,
              statusEffects: [...c.statusEffects, 'stunned'],
              grapple: { grappledBy: null, grappling: null, cpSpent: 0, cpReceived: 0 }
            };
          }
          if (c.playerId === player.id) {
            return {
              ...c,
              grapple: { grappledBy: null, grappling: null, cpSpent: 0, cpReceived: 0 },
              inCloseCombatWith: null,
              closeCombatPosition: null
            };
          }
          return c;
        });
      }
      
      const updated = advanceTurn({
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, logEntry],
      });
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
    } else {
      const updated = advanceTurn({
        ...match,
        log: [...match.log, `${attackerCharacter.name} fails ${payload.action} attempt.`],
      });
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
    }
  } else if (payload.action === 'release') {
    const updatedCombatants = match.combatants.map(c => {
      if (c.playerId === player.id || c.playerId === payload.targetId) {
        return { 
          ...c, 
          grapple: { grappledBy: null, grappling: null, cpSpent: 0, cpReceived: 0 },
          inCloseCombatWith: null,
          closeCombatPosition: null
        };
      }
      return c;
    });
    
    const updated: MatchState = {
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${attackerCharacter.name} releases ${targetCharacter.name}.`],
    };
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    sendToMatch(matchId, { type: "match_state", state: updated });
  }
};

export const handleBreakFree = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>
): Promise<void> => {
  if (!actorCombatant) return;
  
  const adapter = getServerAdapter(match.rulesetId);
  
  if (!actorCombatant.grapple?.grappledBy) {
    sendMessage(socket, { type: "error", message: "Not being grappled." });
    return;
  }
  
  const grappledById = actorCombatant.grapple.grappledBy;
  const cpPenalty = actorCombatant.grapple.cpReceived ?? 0;
  
  const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
  const grapplerCombatant = match.combatants.find(c => c.playerId === grappledById);
  const grapplerCharacter = grapplerCombatant ? getCharacterById(match, grapplerCombatant.characterId) : null;
  
  if (!attackerCharacter) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }
  
  if (!isGurpsCharacter(attackerCharacter)) {
    sendMessage(socket, { type: "error", message: "Break free requires GURPS character." });
    return;
  }
  
  const wrestlingSkill = attackerCharacter.skills.find(s => s.name === 'Wrestling')?.level ?? attackerCharacter.attributes.strength;
  const breakResult = adapter.closeCombat!.resolveBreakFree(
    attackerCharacter.attributes.strength,
    wrestlingSkill,
    cpPenalty
  );
  
  if (breakResult.success) {
    const updatedCombatants = match.combatants.map(c => {
      if (c.playerId === player.id || c.playerId === grappledById) {
        return { 
          ...c, 
          grapple: { grappledBy: null, grappling: null, cpSpent: 0, cpReceived: 0 },
          inCloseCombatWith: null,
          closeCombatPosition: null
        };
      }
      return c;
    });
    
    const logEntry = `${attackerCharacter.name} breaks free from ${grapplerCharacter?.name ?? 'grapple'}! ${formatRoll(breakResult.roll, `ST/Skill-${cpPenalty}CP`)}`;
    
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, logEntry],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
  } else {
    const logEntry = `${attackerCharacter.name} fails to break free. ${formatRoll(breakResult.roll, `ST/Skill-${cpPenalty}CP`)}`;
    
    const updated = advanceTurn({
      ...match,
      log: [...match.log, logEntry],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
  }
};
