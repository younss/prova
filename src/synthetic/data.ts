// Declarative synthetic data lists (spec §5.2): plausible names, fictitious addresses combined
// with real Quebec cities, and varied water-damage descriptions. No Lorem Ipsum, no real data —
// this file is the ONLY source of fake identities/content in the app (CLAUDE.md).

export const FIRST_NAMES: readonly string[] = [
  'Amélie',
  'Benoît',
  'Camille',
  'Didier',
  'Élise',
  'Félix',
  'Geneviève',
  'Hugo',
  'Isabelle',
  'Jean-François',
  'Karine',
  'Louis',
  'Manon',
  'Nicolas',
  'Océane',
];

export const LAST_NAMES: readonly string[] = [
  'Bergeron',
  'Côté',
  'Dubois',
  'Fortin',
  'Gagnon',
  'Lavoie',
  'Leclerc',
  'Morin',
  'Ouellet',
  'Pelletier',
  'Roy',
  'Simard',
  'Tremblay',
  'Vézina',
];

/** Real Quebec municipalities (spec §5.2: "adresses fictives (villes réelles)"). */
export const QUEBEC_CITIES: readonly string[] = [
  'Montréal',
  'Québec',
  'Laval',
  'Gatineau',
  'Sherbrooke',
  'Trois-Rivières',
  'Saguenay',
  'Lévis',
  'Longueuil',
  'Terrebonne',
];

/** Fictitious street names — never paired with a real civic address. */
export const STREET_NAMES: readonly string[] = [
  'rue des Érables',
  'avenue des Pins',
  'rue du Ruisseau',
  'boulevard des Cèdres',
  'rue des Bouleaux',
  'avenue des Lilas',
  'rue de la Rivière',
  'chemin des Ormes',
];

export const WATER_DAMAGE_DESCRIPTIONS: readonly string[] = [
  "Infiltration d'eau au sous-sol suite à de fortes pluies.",
  "Dégât d'eau causé par la rupture d'un tuyau sous l'évier de la cuisine.",
  "Refoulement d'égout dans la salle de lavage après un orage.",
  "Fuite d'eau prolongée derrière le lave-vaisselle, plancher gondolé.",
  "Bris de la valve d'alimentation de la toilette à l'étage.",
  'Infiltration par la toiture après une accumulation de glace.',
  'Débordement de la laveuse ayant endommagé le revêtement de sol.',
  "Fuite d'un radiateur ayant taché le plafond du salon.",
];
