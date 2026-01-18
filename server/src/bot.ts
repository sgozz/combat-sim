import { randomUUID } from "node:crypto";
import type { CharacterSheet, CombatantState, MatchState, Player, DefenseType } from "../../shared/types";
import type { Lobby } from "./types";
import { state } from "./state";
import { upsertCharacter, upsertPlayerProfile, upsertMatch } from "./db";
import { 
  calculateHexDistance, 
  computeHexMoveToward, 
  calculateFacing, 
  getCombatantByPlayerId, 
  getCharacterById, 
  isDefeated,
  sendToLobby,
  checkVictory
} from "./helpers";
import { advanceTurn, calculateDerivedStats, resolveAttack, applyDamageMultiplier, getDefenseOptions, calculateEncumbrance } from "../../shared/rules";

export const createBotCharacter = (name: string): CharacterSheet => {
  const attributes = {
    strength: 10,
    dexterity: 10,
    intelligence: 9,
    health: 10,
  };
  return {
    id: randomUUID(),
    name,
    attributes,
    derived: calculateDerivedStats(attributes),
    skills: [{ id: randomUUID(), name: "Brawling", level: 12 }],
    advantages: [],
    disadvantages: [],
    equipment: [{ 
      id: randomUUID(), 
      name: "Club", 
      type: "melee",
      damage: "1d+1",
      reach: '1' as const,
      parry: 0,
      skillUsed: "Brawling"
    }],
    pointsTotal: 75,
  };
};

export const addBotToLobby = async (lobby: Lobby) => {
  const botName = `Bot ${state.botCount++}`;
  const botPlayer: Player = {
    id: randomUUID(),
    name: botName,
    isBot: true,
    characterId: "",
  };
  const botCharacter = createBotCharacter(botName);
  botPlayer.characterId = botCharacter.id;
  state.players.set(botPlayer.id, botPlayer);
  state.playerCharacters.set(botPlayer.id, botCharacter);
  lobby.players.push(botPlayer);
  await upsertCharacter(botCharacter);
  await upsertPlayerProfile(botPlayer, lobby.id);
};

export const ensureMinimumBots = async (lobby: Lobby) => {
  while (lobby.players.length < 2) {
    await addBotToLobby(lobby);
  }
};

const findNearestEnemy = (
  botCombatant: CombatantState,
  allCombatants: CombatantState[],
  botPlayerId: string
): CombatantState | null => {
  let nearest: CombatantState | null = null;
  let minDistance = Infinity;
  for (const combatant of allCombatants) {
    if (combatant.playerId === botPlayerId) continue;
    if (isDefeated(combatant)) continue;
    const dist = calculateHexDistance(botCombatant.position, combatant.position);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = combatant;
    }
  }
  return nearest;
};

const formatRoll = (r: { target: number, roll: number, success: boolean, margin: number, dice: number[] }, label: string) => 
  `(${label} ${r.target} vs ${r.roll} [${r.dice.join(', ')}]: ${r.success ? 'Made' : 'Missed'} by ${Math.abs(r.margin)})`;

export const scheduleBotTurn = (lobby: Lobby, match: MatchState) => {
  if (match.status === "finished") {
    return;
  }
  const activePlayer = lobby.players.find((player) => player.id === match.activeTurnPlayerId);
  if (!activePlayer?.isBot) {
    return;
  }
  const existingTimer = state.botTimers.get(lobby.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  const timer = setTimeout(async () => {
    const currentMatch = state.matches.get(lobby.id);
    if (!currentMatch) return;

    const botCombatant = getCombatantByPlayerId(currentMatch, activePlayer.id);
    if (!botCombatant || botCombatant.currentHP <= 0) {
      const updated = advanceTurn({
        ...currentMatch,
        log: [...currentMatch.log, `${activePlayer.name} is incapacitated.`],
      });
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
      return;
    }

    const target = findNearestEnemy(botCombatant, currentMatch.combatants, activePlayer.id);
    if (!target) {
      const updated = advanceTurn({
        ...currentMatch,
        log: [...currentMatch.log, `${activePlayer.name} finds no targets.`],
      });
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
      return;
    }

    const distanceToTarget = calculateHexDistance(botCombatant.position, target.position);

    if (distanceToTarget <= 1) {
      const attackerCharacter = getCharacterById(currentMatch, botCombatant.characterId);
      const targetCharacter = getCharacterById(currentMatch, target.characterId);
      if (!attackerCharacter || !targetCharacter) {
        const updated = advanceTurn({
          ...currentMatch,
          log: [...currentMatch.log, `${activePlayer.name} waits.`],
        });
        state.matches.set(lobby.id, updated);
        await upsertMatch(lobby.id, updated);
        sendToLobby(lobby, { type: "match_state", state: updated });
        scheduleBotTurn(lobby, updated);
        return;
      }

      const skill = attackerCharacter.skills[0]?.level ?? attackerCharacter.attributes.dexterity;
      const defense = targetCharacter.derived.dodge;
      const weapon = attackerCharacter.equipment[0];
      const damageFormula = weapon?.damage ?? "1d";
      const result = resolveAttack({ skill, defense, damage: damageFormula });

      let updatedCombatants = currentMatch.combatants;
      let logEntry = `${attackerCharacter.name} attacks ${targetCharacter.name}`;

      if (result.outcome === "miss") {
        logEntry += `: Miss. ${formatRoll(result.attack, 'Skill')}`;
      } else if (result.outcome === "defended") {
        logEntry += `: Dodge! ${formatRoll(result.attack, 'Attack')} -> ${formatRoll(result.defense!, 'Dodge')}`;
      } else {
        const dmg = result.damage!;
        const baseDamage = dmg.total;
        const damageType = weapon?.damageType ?? 'crushing';
        const finalDamage = applyDamageMultiplier(baseDamage, damageType);
        const rolls = dmg.rolls.join(',');
        const mod = dmg.modifier !== 0 ? (dmg.modifier > 0 ? `+${dmg.modifier}` : `${dmg.modifier}`) : '';
        const multiplier = damageType === 'cutting' ? 'x1.5' : damageType === 'impaling' ? 'x2' : '';
        const dmgDetail = multiplier 
          ? `(${damageFormula}: [${rolls}]${mod} = ${baseDamage} ${damageType} ${multiplier} = ${finalDamage})`
          : `(${damageFormula}: [${rolls}]${mod} ${damageType})`;
        
        updatedCombatants = currentMatch.combatants.map((combatant) => {
          if (combatant.playerId !== target.playerId) return combatant;
          const nextHp = Math.max(combatant.currentHP - finalDamage, 0);
          return { ...combatant, currentHP: nextHp };
        });
        logEntry += `: Hit for ${finalDamage} damage ${dmgDetail}. ${formatRoll(result.attack, 'Attack')}`;
      }

      let updated = advanceTurn({
        ...currentMatch,
        combatants: updatedCombatants,
        log: [...currentMatch.log, logEntry],
      });
      updated = checkVictory(updated);
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
      return;
    }

    const botCharacter = getCharacterById(currentMatch, botCombatant.characterId);
    const maxMove = botCharacter?.derived.basicMove ?? 5;
    const newPosition = computeHexMoveToward(botCombatant.position, target.position, maxMove);
    const newFacing = calculateFacing(botCombatant.position, newPosition);

    const updatedCombatants = currentMatch.combatants.map((combatant) =>
      combatant.playerId === activePlayer.id
        ? { ...combatant, position: newPosition, facing: newFacing }
        : combatant
    );

    const updated = advanceTurn({
      ...currentMatch,
      combatants: updatedCombatants,
      log: [...currentMatch.log, `${activePlayer.name} moves to (${newPosition.x}, ${newPosition.z}).`],
    });
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
  }, 1500);
  state.botTimers.set(lobby.id, timer);
};

/**
 * Choose the best defense option for a bot based on available defenses.
 * Bots prefer: block (if available) > parry (if available) > dodge
 * This makes them slightly smarter than always dodging.
 */
export const chooseBotDefense = (
  defenderCharacter: CharacterSheet,
  defenderCombatant: CombatantState
): { defenseType: DefenseType; retreat: boolean; dodgeAndDrop: boolean } => {
  const encumbrance = calculateEncumbrance(
    defenderCharacter.attributes.strength,
    defenderCharacter.equipment
  );
  const effectiveDodge = defenderCharacter.derived.dodge + encumbrance.dodgePenalty;
  const options = getDefenseOptions(defenderCharacter, effectiveDodge);
  
  // Collect available defenses with their values
  const defenses: { type: DefenseType; value: number }[] = [
    { type: 'dodge', value: options.dodge }
  ];
  
  if (options.block) {
    defenses.push({ type: 'block', value: options.block.value });
  }
  
  if (options.parry) {
    // Check if this weapon was already used to parry this turn (cumulative -4 penalty)
    const alreadyUsed = defenderCombatant.parryWeaponsUsedThisTurn.includes(options.parry.weapon);
    const parryValue = alreadyUsed ? options.parry.value - 4 : options.parry.value;
    defenses.push({ type: 'parry', value: parryValue });
  }
  
  // Sort by value descending and pick the best
  defenses.sort((a, b) => b.value - a.value);
  const bestDefense = defenses[0];
  
  // Bots retreat if they haven't this turn (gives +3 to defense)
  const canRetreat = !defenderCombatant.retreatedThisTurn;
  
  return {
    defenseType: bestDefense.type,
    retreat: canRetreat,
    dodgeAndDrop: false, // Bots don't dodge and drop
  };
};
