import type { PendingReaction, MatchState, Player } from '../../../../shared/types';

export type PF2ReactionModalProps = {
  pendingReaction: PendingReaction;
  matchState: MatchState;
  player: Player;
  onAction: (action: string, payload?: { type: string; [key: string]: unknown }) => void;
};

export const PF2ReactionModal = ({
  pendingReaction,
  matchState,
  player,
  onAction,
}: PF2ReactionModalProps) => {
  if (pendingReaction.reactorId !== player.id) return null;

  const triggerCombatant = matchState.combatants.find(
    c => c.playerId === pendingReaction.triggerId
  );
  const triggerCharacter = triggerCombatant
    ? matchState.characters.find(c => c.id === triggerCombatant.characterId)
    : null;
  const triggerName = triggerCharacter?.name ?? 'Unknown';

  const handleStrike = () => {
    onAction('pf2_reaction_choice', { type: 'pf2_reaction_choice', choice: 'aoo' });
  };

  const handleDecline = () => {
    onAction('pf2_reaction_choice', { type: 'pf2_reaction_choice', choice: 'decline' });
  };

  return (
    <div className="modal-overlay reaction-modal-overlay">
      <div className="modal reaction-modal">
        <div className="defense-header">
          <div className="warning-badge">⚔️ ATTACK OF OPPORTUNITY</div>
          <div className="attack-info">
            <span className="attacker-name">{triggerName}</span>
            <span className="attack-detail">
              {pendingReaction.triggerAction === 'stride'
                ? ' is moving through your threatened area.'
                : ' is using a manipulate action in your threatened area.'}
            </span>
          </div>
        </div>

        <div className="defense-cards">
          <button
            className="defense-card dodge"
            onClick={handleStrike}
          >
            <div className="defense-title">STRIKE</div>
            <div className="defense-value">⚔️</div>
            <div className="defense-sub">Attack of Opportunity</div>
          </button>

          <button
            className="defense-card block"
            onClick={handleDecline}
          >
            <div className="defense-title">DECLINE</div>
            <div className="defense-value">✋</div>
            <div className="defense-sub">Let them pass</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PF2ReactionModal;
