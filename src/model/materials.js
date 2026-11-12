import * as THREE from 'three';

const std = (name, color, o = {}) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...o });
  m.name = name;
  return m;
};

// Shared, named materials. Names are stable so the hero runtime can swap them (e.g. "Water").
export const M = {
  terrain: std('Terrain', 0xffffff, { vertexColors: true, roughness: 1 }),
  asphalt: std('Paving_Road', 0x7d7c78, { roughness: 0.95 }),
  kerb: std('Paving_Kerb', 0x94583f, { roughness: 0.9 }),
  marking: std('Road_Marking', 0xd9d8cf, { roughness: 0.7 }),
  path: std('Paving_Path', 0x9c6a52, { roughness: 0.95 }),
  plaza: std('Paving_Plaza', 0xb6ae9f, { roughness: 0.9 }),
  wall: std('Wall_Plaster', 0xd6c9b2, { roughness: 0.85 }),
  plinth: std('Wall_Stone', 0x8d8578, { roughness: 0.95 }),
  roof: std('Roof_Tile', 0xa3563a, { roughness: 0.75 }),
  glass: std('Glass', 0x1d2a31, { roughness: 0.08, metalness: 0.65 }),
  timber: std('Timber_Pergola', 0x6f2c20, { roughness: 0.7 }),
  deck: std('Pool_Deck', 0xcbc3b4, { roughness: 0.8 }),
  water: std('Water', 0x2aa6d6, { roughness: 0.05, metalness: 0.1 }),
  spray: std('Fountain_Spray', 0xffffff, { roughness: 0.2, transparent: true, opacity: 0.75 }),
  tier: std('Amphi_Seat', 0xd4d0c6, { roughness: 0.85 }),
  stage: std('Amphi_Stage', 0xa59e91, { roughness: 0.9 }),
  playSurface: std('Play_Surface', 0xd29f25, { roughness: 0.9 }),
  playRed: std('Play_Red', 0xb23a2d, { roughness: 0.6 }),
  playBlue: std('Play_Blue', 0x2c5f9e, { roughness: 0.6 }),
  playGreen: std('Play_Green', 0x3d8451, { roughness: 0.6 }),
  metal: std('Metal', 0x8c9195, { roughness: 0.4, metalness: 0.6 }),
  fence: std('Boundary_Wall', 0xcac3b5, { roughness: 0.95, side: THREE.DoubleSide }),
  canvas: std('Shade_Canvas', 0xa3352a, { roughness: 0.8, side: THREE.DoubleSide }),
  foliage: std('Foliage', 0xffffff, { vertexColors: true, roughness: 0.95 }),
  car: (name, color) => std(`Car_${name}`, color, { vertexColors: true, roughness: 0.3, metalness: 0.55 }),
};
