import type { WebSocket } from "ws";
import type { MatchState, Player } from "../../../../shared/types";
import { isPF2Character } from "../../../../shared/types";
import type { CombatantState } from "../../../../shared/rulesets";
import { isPF2Combatant } from "../../../../shared/rulesets";
import type { PF2CharacterSheet } from "../../../../shared/rulesets/pf2/characterSheet";
import { state } from "../../state";
import { updateMatchState } from "../../db";
import { sendMessage, sendToMatch, getCharacterById } from "../../helpers";
import { rollCheck, getAbilityModifier, getProficiencyBonus } from "../../../../shared/rulesets/pf2/rules";

const updateCombatantActions = (
  combatant: CombatantState,
  actionsUsed: number,
  mapIncrease: number = 0
): CombatantState => {
  if (!isPF2Combatant(combatant)) return combatant;
  
  const currentActions = combatant.actionsRemaining;
  const newActionsRemaining = currentActions - actionsUsed;
  const newMapPenalty = combatant.mapPenalty + mapIncrease;
  
  return {
    ...combatant,
    actionsRemaining: newActionsRemaining,
    mapPenalty: newMapPenalty,
  };
};

const getSkillBonus = (
  character: PF2CharacterSheet,
  skillName: string
): number => {
  const skill = character.skills.find(s => s.name.toLowerCase() === skillName.toLowerCase());
  if (!skill) return 0;
  
  const abilityMod = getAbilityModifier(character.abilities[skill.ability]);
  const profBonus = getProficiencyBonus(skill.proficiency, character.level);
  return abilityMod + profBonus;
};

export const handlePF2Grapple = async (
   socket: WebSocket,
   matchId: string,
   match: MatchState,
   player: Player,
   actorCombatant: CombatantState,
   payload: { targetId: string }
): Promise<void> => {
   if (!isPF2Combatant(actorCombatant)) return;

   const actionsRemaining = actorCombatant.actionsRemaining;
   if (actionsRemaining < 1) {
     sendMessage(socket, { type: "error", message: "No actions remaining." });
     return;
   }

   const targetCombatant = match.combatants.find(c => c.playerId === payload.targetId);
   if (!targetCombatant || !isPF2Combatant(targetCombatant)) {
     sendMessage(socket, { type: "error", message: "Invalid target." });
     return;
   }

   const actorCharacter = getCharacterById(match, actorCombatant.characterId);
   const targetCharacter = getCharacterById(match, targetCombatant.characterId);
   
   if (!actorCharacter || !isPF2Character(actorCharacter) || !targetCharacter || !isPF2Character(targetCharacter)) {
     sendMessage(socket, { type: "error", message: "Character not found." });
     return;
   }

   const athleticsBonus = getSkillBonus(actorCharacter, 'Athletics') + actorCombatant.mapPenalty;

   const fortitudeDC = 10 + targetCharacter.derived.fortitudeSave;

   const result = rollCheck(athleticsBonus, fortitudeDC);

   let logMessage = `${player.name} attempts to Grapple: [${result.roll}+${result.modifier}=${result.total} vs DC ${result.dc}] ${result.degree}`;
   
   const updatedCombatants = match.combatants.map((c) => {
     if (c.playerId === player.id && isPF2Combatant(c)) {
       if (result.degree === 'critical_failure') {
         logMessage += ` - Grapple attempt fails!`;
         return updateCombatantActions(c, 1, -5);
       }
       return updateCombatantActions(c, 1, -5);
     }
     
     if (c.playerId === payload.targetId && isPF2Combatant(c)) {
       if (result.degree === 'critical_success') {
         logMessage += ` - Target is grabbed and restrained!`;
         return {
           ...c,
           conditions: [...c.conditions, { condition: 'grabbed' as const }, { condition: 'restrained' as const }],
         };
       } else if (result.degree === 'success') {
         logMessage += ` - Target is grabbed!`;
         return {
           ...c,
           conditions: [...c.conditions, { condition: 'grabbed' as const }],
         };
       }
     }
     
     return c;
   });

   const updated: MatchState = {
     ...match,
     combatants: updatedCombatants,
     log: [...match.log, logMessage],
   };
   
   state.matches.set(matchId, updated);
   await updateMatchState(matchId, updated);
   await sendToMatch(matchId, { type: "match_state", state: updated });
};

export const handlePF2Trip = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: CombatantState,
  payload: { targetId: string }
): Promise<void> => {
  if (!isPF2Combatant(actorCombatant)) return;

  const actionsRemaining = actorCombatant.actionsRemaining;
  if (actionsRemaining < 1) {
    sendMessage(socket, { type: "error", message: "No actions remaining." });
    return;
  }

  const targetCombatant = match.combatants.find(c => c.playerId === payload.targetId);
  if (!targetCombatant || !isPF2Combatant(targetCombatant)) {
    sendMessage(socket, { type: "error", message: "Invalid target." });
    return;
  }

  const actorCharacter = getCharacterById(match, actorCombatant.characterId);
  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  
  if (!actorCharacter || !isPF2Character(actorCharacter) || !targetCharacter || !isPF2Character(targetCharacter)) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }

  const athleticsBonus = getSkillBonus(actorCharacter, 'Athletics') + actorCombatant.mapPenalty;

  const reflexDC = 10 + targetCharacter.derived.reflexSave;

  const result = rollCheck(athleticsBonus, reflexDC);

  let logMessage = `${player.name} attempts to Trip: [${result.roll}+${result.modifier}=${result.total} vs DC ${result.dc}] ${result.degree}`;
  
  const updatedCombatants = match.combatants.map((c) => {
    if (c.playerId === player.id && isPF2Combatant(c)) {
      if (result.degree === 'critical_failure') {
        logMessage += ` - ${player.name} falls prone!`;
        return {
          ...updateCombatantActions(c, 1, -5),
          conditions: [...c.conditions, { condition: 'prone' as const }],
        };
      }
      return updateCombatantActions(c, 1, -5);
    }
    
    if (c.playerId === payload.targetId && isPF2Combatant(c)) {
      if (result.degree === 'success' || result.degree === 'critical_success') {
        logMessage += ` - Target falls prone and is flat-footed!`;
        return {
          ...c,
          conditions: [...c.conditions, { condition: 'prone' as const }, { condition: 'flat_footed' as const }],
        };
      }
    }
    
    return c;
  });

  const updated: MatchState = {
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, logMessage],
  };
  
  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  await sendToMatch(matchId, { type: "match_state", state: updated });
};

export const handlePF2Disarm = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: CombatantState,
  payload: { targetId: string }
): Promise<void> => {
  if (!isPF2Combatant(actorCombatant)) return;

  const actionsRemaining = actorCombatant.actionsRemaining;
  if (actionsRemaining < 1) {
    sendMessage(socket, { type: "error", message: "No actions remaining." });
    return;
  }

  const targetCombatant = match.combatants.find(c => c.playerId === payload.targetId);
  if (!targetCombatant || !isPF2Combatant(targetCombatant)) {
    sendMessage(socket, { type: "error", message: "Invalid target." });
    return;
  }

  const actorCharacter = getCharacterById(match, actorCombatant.characterId);
  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  
  if (!actorCharacter || !isPF2Character(actorCharacter) || !targetCharacter || !isPF2Character(targetCharacter)) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }

  const athleticsBonus = getSkillBonus(actorCharacter, 'Athletics') + actorCombatant.mapPenalty;

  const reflexDC = 10 + targetCharacter.derived.reflexSave;

  const result = rollCheck(athleticsBonus, reflexDC);

  let logMessage = `${player.name} attempts to Disarm: [${result.roll}+${result.modifier}=${result.total} vs DC ${result.dc}] ${result.degree}`;
  
  const updatedCombatants = match.combatants.map((c) => {
    if (c.playerId === player.id && isPF2Combatant(c)) {
      if (result.degree === 'critical_failure') {
        logMessage += ` - ${player.name} drops their weapon!`;
      }
      return updateCombatantActions(c, 1, -5);
    }
    
    if (c.playerId === payload.targetId && isPF2Combatant(c)) {
      if (result.degree === 'critical_success') {
        logMessage += ` - Target drops their weapon!`;
      } else if (result.degree === 'success') {
        logMessage += ` - Target takes -2 to attacks with weapon!`;
      }
    }
    
    return c;
  });

  const updated: MatchState = {
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, logMessage],
  };
  
  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  await sendToMatch(matchId, { type: "match_state", state: updated });
};

export const handlePF2Feint = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: CombatantState,
  payload: { targetId: string }
): Promise<void> => {
  if (!isPF2Combatant(actorCombatant)) return;

  const actionsRemaining = actorCombatant.actionsRemaining;
  if (actionsRemaining < 1) {
    sendMessage(socket, { type: "error", message: "No actions remaining." });
    return;
  }

  const targetCombatant = match.combatants.find(c => c.playerId === payload.targetId);
  if (!targetCombatant || !isPF2Combatant(targetCombatant)) {
    sendMessage(socket, { type: "error", message: "Invalid target." });
    return;
  }

  const actorCharacter = getCharacterById(match, actorCombatant.characterId);
  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  
  if (!actorCharacter || !isPF2Character(actorCharacter) || !targetCharacter || !isPF2Character(targetCharacter)) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }

  const deceptionBonus = getSkillBonus(actorCharacter, 'Deception');

  const perceptionDC = 10 + targetCharacter.derived.perception;

  const result = rollCheck(deceptionBonus, perceptionDC);

  let logMessage = `${player.name} attempts to Feint: [${result.roll}+${result.modifier}=${result.total} vs DC ${result.dc}] ${result.degree}`;
  
  const updatedCombatants = match.combatants.map((c) => {
    if (c.playerId === player.id && isPF2Combatant(c)) {
      return updateCombatantActions(c, 1, 0);
    }
    
    if (c.playerId === payload.targetId && isPF2Combatant(c)) {
      if (result.degree === 'critical_success') {
        logMessage += ` - Target is flat-footed to all attacks until end of your next turn!`;
        return {
          ...c,
          conditions: [...c.conditions, { condition: 'flat_footed' as const }],
        };
      } else if (result.degree === 'success') {
        logMessage += ` - Target is flat-footed to your next attack!`;
        return {
          ...c,
          conditions: [...c.conditions, { condition: 'flat_footed' as const }],
        };
      }
    }
    
    return c;
  });

  const updated: MatchState = {
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, logMessage],
  };
  
  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  await sendToMatch(matchId, { type: "match_state", state: updated });
};

export const handlePF2Demoralize = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: CombatantState,
  payload: { targetId: string }
): Promise<void> => {
  if (!isPF2Combatant(actorCombatant)) return;

  const actionsRemaining = actorCombatant.actionsRemaining;
  if (actionsRemaining < 1) {
    sendMessage(socket, { type: "error", message: "No actions remaining." });
    return;
  }

  const targetCombatant = match.combatants.find(c => c.playerId === payload.targetId);
  if (!targetCombatant || !isPF2Combatant(targetCombatant)) {
    sendMessage(socket, { type: "error", message: "Invalid target." });
    return;
  }

  const actorCharacter = getCharacterById(match, actorCombatant.characterId);
  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  
  if (!actorCharacter || !isPF2Character(actorCharacter) || !targetCharacter || !isPF2Character(targetCharacter)) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }

  const intimidationBonus = getSkillBonus(actorCharacter, 'Intimidation');

  const willDC = 10 + targetCharacter.derived.willSave;

  const result = rollCheck(intimidationBonus, willDC);

  let logMessage = `${player.name} attempts to Demoralize: [${result.roll}+${result.modifier}=${result.total} vs DC ${result.dc}] ${result.degree}`;
  
  const updatedCombatants = match.combatants.map((c) => {
    if (c.playerId === player.id && isPF2Combatant(c)) {
      return updateCombatantActions(c, 1, 0);
    }
    
    if (c.playerId === payload.targetId && isPF2Combatant(c)) {
      if (result.degree === 'critical_success') {
        logMessage += ` - Target is frightened 2!`;
        return {
          ...c,
          conditions: [...c.conditions, { condition: 'frightened' as const, value: 2 }],
        };
      } else if (result.degree === 'success') {
        logMessage += ` - Target is frightened 1!`;
        return {
          ...c,
          conditions: [...c.conditions, { condition: 'frightened' as const, value: 1 }],
        };
      }
    }
    
    return c;
  });

  const updated: MatchState = {
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, logMessage],
  };
  
  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  await sendToMatch(matchId, { type: "match_state", state: updated });
};
