/* ============================================================
   ODYSSEY — stamina.js
   Phase 3.1: Standalone stamina foundation

   Temporary combat resource. This module has no DOM, scene, HUD,
   movement, combat, or persistence dependencies.
   ============================================================ */

export const STAMINA_DEFAULTS = Object.freeze({
  maximum: 100,
  initial: 100,
  dodgeCost: 20,
  heavyAttackCost: 25,
  parryCost: 12,
  lightAttackCost: 0,
  movementCost: 0,
  regenerationDelay: 0.7,
  regenerationRate: 25,
});

const finiteNonNegative = (value, fallback) =>
  Number.isFinite(value) && value >= 0 ? value : fallback;

export class StaminaSystem {
  constructor(options = {}) {
    const maximum = Number.isFinite(options.maximum) && options.maximum > 0
      ? options.maximum : STAMINA_DEFAULTS.maximum;
    const initial = Number.isFinite(options.initial)
      ? Math.max(0, Math.min(maximum, options.initial))
      : maximum;
    const costs = options.costs || {};

    this.maximum = maximum;
    this.regenerationDelay = finiteNonNegative(
      options.regenerationDelay, STAMINA_DEFAULTS.regenerationDelay
    );
    this.regenerationRate = finiteNonNegative(
      options.regenerationRate, STAMINA_DEFAULTS.regenerationRate
    );
    this.costs = Object.freeze({
      dodge: finiteNonNegative(costs.dodge, STAMINA_DEFAULTS.dodgeCost),
      heavyAttack: finiteNonNegative(costs.heavyAttack, STAMINA_DEFAULTS.heavyAttackCost),
      parry: finiteNonNegative(costs.parry, STAMINA_DEFAULTS.parryCost),
      lightAttack: finiteNonNegative(costs.lightAttack, STAMINA_DEFAULTS.lightAttackCost),
      movement: finiteNonNegative(costs.movement, STAMINA_DEFAULTS.movementCost),
    });

    this._current = initial;
    this._regenerationWait = 0;
  }

  get current() { return this._current; }

  get regenerationWait() { return this._regenerationWait; }

  canSpend(amount) {
    return Number.isFinite(amount) && amount >= 0 && amount <= this._current;
  }

  spend(amount) {
    if (!this.canSpend(amount)) return false;
    if (amount === 0) return true;
    this._current -= amount;
    this._regenerationWait = this.regenerationDelay;
    return true;
  }

  spendAction(action) {
    if (!Object.prototype.hasOwnProperty.call(this.costs, action)) return false;
    return this.spend(this.costs[action]);
  }

  update(dt, gameplayActive = true, hitStop = false) {
    if (!gameplayActive || hitStop || !Number.isFinite(dt) || dt <= 0 ||
        this._current >= this.maximum) return;

    const elapsed = Math.min(dt, 60);
    if (this._regenerationWait > 0) {
      const waited = Math.min(this._regenerationWait, elapsed);
      this._regenerationWait -= waited;
      if (this._regenerationWait > 0) return;
      const regenerationDt = elapsed - waited;
      this._current = Math.min(
        this.maximum, this._current + regenerationDt * this.regenerationRate
      );
      return;
    }

    this._current = Math.min(
      this.maximum, this._current + elapsed * this.regenerationRate
    );
  }

  reset() {
    this._current = this.maximum;
    this._regenerationWait = 0;
  }

  resetFull() {
    this.reset();
  }
}
