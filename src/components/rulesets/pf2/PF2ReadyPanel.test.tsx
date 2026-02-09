import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PF2ReadyPanel } from './PF2ReadyPanel';
import type { EquippedItem } from '../../../../shared/rulesets/gurps/types';
import type { PF2CharacterWeapon } from '../../../../shared/rulesets/pf2/characterSheet';

const createWeapon = (overrides: Partial<PF2CharacterWeapon> = {}): PF2CharacterWeapon => ({
  id: 'w1',
  name: 'Longsword',
  damage: '1d8',
  damageType: 'slashing',
  proficiencyCategory: 'martial',
  traits: [],
  potencyRune: 0,
  strikingRune: null,
  ...overrides,
});

describe('PF2ReadyPanel', () => {
  const defaultProps = {
    equipped: [] as EquippedItem[],
    weapons: [createWeapon()],
    onInteract: vi.fn(),
    onClose: vi.fn(),
    actionsRemaining: 3,
    isMyTurn: true,
  };

  it('renders hand status showing Empty when no weapons equipped', () => {
    render(<PF2ReadyPanel {...defaultProps} />);
    const emptyTexts = screen.getAllByText('Empty');
    expect(emptyTexts).toHaveLength(2);
  });

  it('renders hand status showing equipped weapon names', () => {
    render(
      <PF2ReadyPanel
        {...defaultProps}
        equipped={[{ equipmentId: 'w1', slot: 'right_hand', ready: true }]}
      />
    );
    expect(screen.getAllByText('Longsword').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Empty')).toHaveLength(1);
  });

  it('shows draw buttons when item not in hand and slot available', () => {
    render(<PF2ReadyPanel {...defaultProps} />);
    expect(screen.getByText('Draw (R)')).toBeTruthy();
    expect(screen.getByText('Draw (L)')).toBeTruthy();
  });

  it('shows sheathe button when item in hand', () => {
    render(
      <PF2ReadyPanel
        {...defaultProps}
        equipped={[{ equipmentId: 'w1', slot: 'right_hand', ready: true }]}
      />
    );
    expect(screen.getByText('Sheathe')).toBeTruthy();
  });

  it('disables buttons when actionsRemaining is 0', () => {
    render(
      <PF2ReadyPanel
        {...defaultProps}
        actionsRemaining={0}
      />
    );
    const drawButton = screen.getByText('Draw (R)');
    expect(drawButton).toBeDisabled();
  });

  it('disables buttons when not player turn', () => {
    render(
      <PF2ReadyPanel
        {...defaultProps}
        isMyTurn={false}
      />
    );
    const drawButton = screen.getByText('Draw (R)');
    expect(drawButton).toBeDisabled();
  });

  it('calls onInteract with correct params on draw click', () => {
    const onInteract = vi.fn();
    render(
      <PF2ReadyPanel
        {...defaultProps}
        onInteract={onInteract}
      />
    );
    fireEvent.click(screen.getByText('Draw (R)'));
    expect(onInteract).toHaveBeenCalledWith('draw', 'w1', 'right_hand');
  });

  it('calls onInteract with left_hand on Draw (L) click', () => {
    const onInteract = vi.fn();
    render(
      <PF2ReadyPanel
        {...defaultProps}
        onInteract={onInteract}
      />
    );
    fireEvent.click(screen.getByText('Draw (L)'));
    expect(onInteract).toHaveBeenCalledWith('draw', 'w1', 'left_hand');
  });

  it('calls onInteract with correct params on sheathe click', () => {
    const onInteract = vi.fn();
    render(
      <PF2ReadyPanel
        {...defaultProps}
        onInteract={onInteract}
        equipped={[{ equipmentId: 'w1', slot: 'right_hand', ready: true }]}
      />
    );
    fireEvent.click(screen.getByText('Sheathe'));
    expect(onInteract).toHaveBeenCalledWith('sheathe', 'w1');
  });

  it('shows Hands Full when both hands occupied', () => {
    const weapons = [
      createWeapon({ id: 'w1', name: 'Longsword' }),
      createWeapon({ id: 'w2', name: 'Dagger' }),
      createWeapon({ id: 'w3', name: 'Shortbow' }),
    ];
    const equipped: EquippedItem[] = [
      { equipmentId: 'w1', slot: 'right_hand', ready: true },
      { equipmentId: 'w2', slot: 'left_hand', ready: true },
    ];
    render(
      <PF2ReadyPanel
        {...defaultProps}
        weapons={weapons}
        equipped={equipped}
      />
    );
    expect(screen.getByText('Hands Full')).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <PF2ReadyPanel
        {...defaultProps}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows weapon traits when present', () => {
    render(
      <PF2ReadyPanel
        {...defaultProps}
        weapons={[createWeapon({ traits: ['agile', 'finesse'] })]}
      />
    );
    expect(screen.getByText('agile, finesse')).toBeTruthy();
  });
});
