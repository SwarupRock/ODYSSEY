/* ============================================================
   ODYSSEY — gear kit ("Arms of the Hero")
   Persistent equipment earned across the voyage: armor, sword,
   bow. One owner of all combat numbers; scenes ask, never invent.
   - armor: damage reduction (absorbs hits entirely up to tier)
   - sword: melee damage / stagger power (1 = olive stake ...)
   - bow:   unlock + arrow damage tier
   ============================================================ */

import { Save } from "./engine.js";

export const ARMOR = [
  { id: 0, name: "Ragged Cloak",    reduce: 0.00, desc: "a beggar's rags" },
  { id: 1, name: "Bronze Cuirass",  reduce: 0.34, desc: "trophy of the cave" },
  { id: 2, name: "Aegis Half-Cape", reduce: 0.55, desc: "gift of the witch" },
  { id: 3, name: "Armor of Achilles", reduce: 0.72, desc: "won among shades" },
];

export const SWORDS = [
  { id: 0, name: "Olive Stake",    power: 1, desc: "sharp enough for a giant" },
  { id: 1, name: "Bronze Sword",   power: 2, desc: "taken in the cyclops's nest" },
  { id: 2, name: "Moly Blade",     power: 3, desc: "circe-tempered edge" },
  { id: 3, name: "Sword of Hector", power: 4, desc: "the shade's last gift" },
];

export const BOWS = [
  { id: 0, name: "No Bow",        power: 0, desc: "the great bow sleeps" },
  { id: 1, name: "Shepherd's Bow", power: 1, desc: "hunted hares on Ithaca" },
  { id: 2, name: "The Great Bow",  power: 3, desc: "twelve axes in a row" },
];

/* arrow tiers — choose your quiver in the Armory (basic → best) */
export const ARROWS = [
  { id: 0, name: "Broadhead Shafts",  dmg: 0, desc: "honest bronze points — basic" },
  { id: 1, name: "Fire Arrows",       dmg: 1, desc: "pitch-soaked, they burn — stronger" },
  { id: 2, name: "Arrows of Apollo",  dmg: 3, desc: "the far-shooter's golden gift — best" },
];

export const Gear = {
  /** load (or default) the kit from the save; called once at boot */
  load() {
    const s = Save.data;
    s.gear = s.gear || { armor: 0, sword: 0, bow: 0, arrow: 0 };
    if (s.gear.arrow === undefined) s.gear.arrow = 0; // pre-armory saves
    return s.gear;
  },

  kit() {
    this.load();
    const g = Save.data.gear || {};
    return {
      armor: ARMOR[Math.min(ARMOR.length - 1, g.armor | 0)],
      sword: SWORDS[Math.min(SWORDS.length - 1, (g.swordEq !== undefined ? g.swordEq : g.sword) | 0)],
      bow: BOWS[Math.min(BOWS.length - 1, g.bow | 0)],
      arrow: ARROWS[Math.min(ARROWS.length - 1, (g.arrowEq !== undefined ? g.arrowEq : g.arrow) | 0)],
    };
  },

  /**
   * equip an owned tier from the Armory (any tier up to what you own —
   * down-equip is a style choice and never burns the ownership record:
   * `gear.X` is what you OWN, `gear.XEq` is what you carry).
   */
  equip(kind, tier) {
    this.load();
    const owned = Save.data.gear[kind] | 0;
    if (tier > owned) return false;
    Save.data.gear[kind + "Eq"] = tier;
    Save.save();
    return true;
  },

  /** total arrow damage: bow power + quiver tier */
  arrowDmg() {
    const k = this.kit();
    return (k.bow.power | 0) + (k.arrow.dmg | 0);
  },

  /** quiver name for HUD/menu */
  arrowName() {
    return this.kit().arrow.name;
  },

  /** award an item tier (never downgrades); returns true if it was new.
   *  A new best auto-equips — the hero takes up the better arms at once. */
  award(kind, tier) {
    this.load();
    const s = Save.data.gear;
    if ((s[kind] | 0) >= tier) return false;
    s[kind] = tier;
    s[kind + "Eq"] = tier;
    Save.save();
    return true;
  },

  /** damage reduction from current armor, 0..0.72 */
  armorReduce() {
    return this.kit().armor.reduce;
  },

  /**
   * incoming hit through current armor.
   * Returns "blocked" (armor ate it) or "hit".
   */
  absorb() {
    return Math.random() < this.armorReduce() ? "blocked" : "hit";
  },

  /** armor name for HUD chips */
  armorName() {
    return this.kit().armor.name;
  },
};
