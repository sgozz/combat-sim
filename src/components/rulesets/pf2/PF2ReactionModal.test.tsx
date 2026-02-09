import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PF2ReactionModal } from './PF2ReactionModal';
import type { PendingReaction, MatchState, Player } from '../../../../shared/types';

const makePlayer = (id: string, name: string): Player => ({
  id,
  name,
  isBot: false,
  characterId: `char-${id}`,
});

const makeMatchState = (overrides?: Partial<MatchState>): MatchState => ({
  id: 'match-1',
  code: 'ABC',
  name: 'Test Match',
  maxPlayers: 2,
  rulesetId: 'pf2',
  players: [makePlayer('p1', 'Alice'), makePlayer('p2', 'Bob')],
  characters: [
    { id: 'char-p1', name: 'Fighter', rulesetId: 'pf2' } as unknown as MatchState['characters'][0],
    { id: 'char-p2', name: 'Rogue', rulesetId: 'pf2' } as unknown as MatchState['characters'][0],
  ],
  combatants: [
    { playerId: 'p1', characterId: 'char-p1', currentHP: 20, maxHP: 20, position: { x: 0, y: 0, z: 0 }, facing: 0, statusEffects: [], equipped: [], rulesetId: 'pf2', usedReaction: false } as unknown as MatchState['combatants'][0],
    { playerId: 'p2', characterId: 'char-p2', currentHP: 20, maxHP: 20, position: { x: 1, y: 0, z: 0 }, facing: 0, statusEffects: [], equipped: [], rulesetId: 'pf2', usedReaction: false } as unknown as MatchState['combatants'][0],
  ],
  activeTurnPlayerId: 'p1',
  round: 1,
  log: [],
  status: 'active',
  createdAt: Date.now(),
  ...overrides,
});

const makePendingReaction = (overrides?: Partial<PendingReaction>): PendingReaction => ({
  reactorId: 'p2',
  triggerId: 'p1',
  triggerAction: 'stride',
  originalPayload: { type: 'pf2_stride' } as PendingReaction['originalPayload'],
  ...overrides,
});

describe('PF2ReactionModal', () => {
  it('renders when pendingReaction targets current player', () => {
    const onAction = vi.fn();
    const matchState = makeMatchState();
    const player = makePlayer('p2', 'Bob');
    const pendingReaction = makePendingReaction({ reactorId: 'p2' });

    render(
      <PF2ReactionModal
        pendingReaction={pendingReaction}
        matchState={matchState}
        player={player}
        onAction={onAction}
      />
    );

    expect(screen.getByText(/⚔️ ATTACK OF OPPORTUNITY/)).toBeTruthy();
    expect(screen.getByText('STRIKE')).toBeTruthy();
    expect(screen.getByText('DECLINE')).toBeTruthy();
  });

  it('does not render when current player is not the reactor', () => {
    const onAction = vi.fn();
    const matchState = makeMatchState();
    const player = makePlayer('p1', 'Alice');
    const pendingReaction = makePendingReaction({ reactorId: 'p2' });

    const { container } = render(
      <PF2ReactionModal
        pendingReaction={pendingReaction}
        matchState={matchState}
        player={player}
        onAction={onAction}
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('shows trigger combatant name', () => {
    const onAction = vi.fn();
    const matchState = makeMatchState();
    const player = makePlayer('p2', 'Bob');
    const pendingReaction = makePendingReaction({ triggerId: 'p1' });

    render(
      <PF2ReactionModal
        pendingReaction={pendingReaction}
        matchState={matchState}
        player={player}
        onAction={onAction}
      />
    );

    expect(screen.getByText('Fighter')).toBeTruthy();
  });

  it('dispatches aoo choice when Strike button clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const matchState = makeMatchState();
    const player = makePlayer('p2', 'Bob');
    const pendingReaction = makePendingReaction();

    render(
      <PF2ReactionModal
        pendingReaction={pendingReaction}
        matchState={matchState}
        player={player}
        onAction={onAction}
      />
    );

    await user.click(screen.getByText('STRIKE'));
    expect(onAction).toHaveBeenCalledWith('pf2_reaction_choice', {
      type: 'pf2_reaction_choice',
      choice: 'aoo',
    });
  });

  it('dispatches decline choice when Decline button clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const matchState = makeMatchState();
    const player = makePlayer('p2', 'Bob');
    const pendingReaction = makePendingReaction();

    render(
      <PF2ReactionModal
        pendingReaction={pendingReaction}
        matchState={matchState}
        player={player}
        onAction={onAction}
      />
    );

    await user.click(screen.getByText('DECLINE'));
    expect(onAction).toHaveBeenCalledWith('pf2_reaction_choice', {
      type: 'pf2_reaction_choice',
      choice: 'decline',
    });
  });

  it('shows interact trigger description', () => {
    const onAction = vi.fn();
    const matchState = makeMatchState();
    const player = makePlayer('p2', 'Bob');
    const pendingReaction = makePendingReaction({ triggerAction: 'interact' });

    render(
      <PF2ReactionModal
        pendingReaction={pendingReaction}
        matchState={matchState}
        player={player}
        onAction={onAction}
      />
    );

    expect(screen.getByText(/manipulate action/)).toBeTruthy();
  });
});
