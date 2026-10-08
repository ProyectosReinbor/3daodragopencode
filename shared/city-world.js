/** Gameplay reinterpretation: named corridors are references, not surveyed road geometry. */
export const CITY_WORLD = Object.freeze({
  name: 'Villavicencio',
  size: 180,
  origin: { lat: 4.1491688, lng: -73.6285475 },
  cartography: 'conceptual',
  landmarks: [
    { id: 'viva', name: 'Viva', type: 'comercial', x: -36, z: 25 },
    { id: 'unico', name: 'Único Outlet', type: 'comercial', x: 26, z: 30 },
    { id: 'unicentro', name: 'Unicentro', type: 'comercial', x: -18, z: -17 },
    { id: 'primavera', name: 'Primavera Urbana', type: 'comercial', x: -29, z: 3 },
    { id: 'llanocentro', name: 'Llanocentro', type: 'comercial', x: -19, z: 18 },
    { id: 'villacentro', name: 'Villacentro', type: 'comercial', x: -28, z: 16 },
    { id: 'unillanos', name: 'Universidad de los Llanos', type: 'universidad', x: 44, z: -20 },
    { id: 'cooperativa', name: 'Universidad Cooperativa', type: 'universidad', x: 9, z: 12 },
    { id: 'unimeta', name: 'Unimeta', type: 'universidad', x: -9, z: -12 },
    { id: 'santo-tomas', name: 'Universidad Santo Tomás', type: 'universidad', x: 36, z: 14 },
    {
      id: 'chorillano',
      name: 'Cooperativa Chorillano · sede por confirmar',
      type: 'universidad',
      x: 55,
      z: -9,
    },
    {
      id: 'parque-central',
      name: 'Parque Central · Campo de entrenamiento',
      type: 'parque',
      x: 0,
      z: -6,
    },
  ],
  roads: [
    {
      id: 'av40',
      name: 'Avenida 40',
      points: [
        [-48, 48],
        [-35, 22],
        [-25, 0],
        [-14, -22],
        [-8, -45],
      ],
    },
    {
      id: 'anillo',
      name: 'Anillo Vial',
      points: [
        [-48, 48],
        [-8, 45],
        [25, 38],
        [52, 20],
        [64, -5],
      ],
    },
    {
      id: 'catama',
      name: 'Avenida Catama',
      points: [
        [-14, -22],
        [10, -28],
        [35, -25],
        [65, -18],
      ],
    },
    {
      id: 'maracos',
      name: 'Avenida Los Maracos',
      points: [
        [10, -28],
        [18, 0],
        [25, 38],
      ],
    },
    {
      id: 'kr34',
      name: 'Carrera 34',
      points: [
        [-25, 0],
        [-10, 14],
        [-8, 45],
      ],
    },
    {
      id: 'barrios',
      name: 'Senderos de los barrios',
      points: [
        [-10, 14],
        [18, 0],
        [52, 20],
      ],
    },
  ],
  biomes: [
    {
      id: 'bosque',
      name: 'Bosque Esmeralda',
      x: -32,
      z: 1,
      radius: 37,
      color: 1923403,
      zone: 'bosque',
    },
    {
      id: 'selva',
      name: 'Selva de Catama',
      x: 36,
      z: -30,
      radius: 36,
      color: 1528904,
      zone: 'bosque',
    },
    {
      id: 'fuego',
      name: 'Tierras de Brasa',
      x: 43,
      z: 36,
      radius: 33,
      color: 6502200,
      zone: 'desierto',
    },
    {
      id: 'nieve',
      name: 'Cumbres de Nacar',
      x: -40,
      z: -45,
      radius: 30,
      color: 6657709,
      zone: 'ruinas',
    },
    {
      id: 'cueva',
      name: 'Cuevas del Anillo',
      x: -9,
      z: 53,
      radius: 26,
      color: 3683412,
      zone: 'cueva',
    },
  ],
  nodes: [
    { id: 'mina-anillo', name: 'Mina del Anillo', x: -8, z: 40, material: 'mineral', amount: 2 },
    {
      id: 'cristal-nacar',
      name: 'Cristales de Nacar',
      x: -34,
      z: -40,
      material: 'cristal',
      amount: 1,
    },
    {
      id: 'bosque-madera',
      name: 'Arboleda Esmeralda',
      x: -30,
      z: 12,
      material: 'madera',
      amount: 2,
    },
    {
      id: 'selva-esencia',
      name: 'Santuario de Catama',
      x: 34,
      z: -23,
      material: 'esencia',
      amount: 1,
    },
    {
      id: 'brasa-obsidiana',
      name: 'Mina de Obsidiana',
      x: 42,
      z: 30,
      material: 'obsidiana',
      amount: 1,
    },
  ],
  forge: { x: 0, z: 4 },
  spawn: { x: 0, z: 0 },
});
export function biomeAt(x, z) {
  return CITY_WORLD.biomes.reduce(
    (best, b) => (Math.hypot(x - b.x, z - b.z) < Math.hypot(x - best.x, z - best.z) ? b : best),
    CITY_WORLD.biomes[0]
  );
}
export function businessWorldPosition(store) {
  if (store.city_id && store.city_id !== 'CO-MET-VVC') return null;
  if (!Number.isFinite(store.lat) || !Number.isFinite(store.lng)) return null;
  const x = (store.lng - CITY_WORLD.origin.lng) * 1600,
    z = (CITY_WORLD.origin.lat - store.lat) * 1600;
  if (Math.abs(x) > 82 || Math.abs(z) > 82) return null;
  return { x, z };
}
