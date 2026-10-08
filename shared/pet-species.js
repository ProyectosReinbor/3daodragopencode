/** Original creature families; saved personal names are never overwritten. */
export const PET_SPECIES_NAMES = Object.freeze({
  "cat": "Florvyn",
  "dog": "Brumacan",
  "rabbit": "Nuborín",
  "fox": "Ascuzorro",
  "bear": "Pedrumb",
  "bird": "Ventorel",
  "axolotl": "Nacarín",
  "turtle": "Coralco",
  "fish": "Marelio",
  "insect": "Brotalia",
  "alien": "Orbun",
  "monster": "Rocor",
  "dragon": "Brasal",
  "spirit": "Velúm"
});
export function petSpeciesName(species) { return PET_SPECIES_NAMES[species] || 'Aodase'; }
