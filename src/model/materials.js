import * as THREE from 'three';

const std = (name, color, o = {}) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...o });
  m.name = name;
  return m;
};

// Shared, named materials. Names are stable so the hero runtime can swap them (e.g. "Water").
export const M = {
  terrain: std('Terrain', 0xffffff, { vertexColors: true, roughness: 1 }),
  asphalt: std('Paving_Road', 0xb9b6b0, { roughness: 0.95 }),
  kerb: std('Paving_Kerb', 0xb8674c, { roughness: 0.9 }),
  marking: std('Road_Marking', 0xf7f7f2, { roughness: 0.7 }),
  path: std('Paving_Path', 0xc27d5c, { roughness: 0.95 }),
  plaza: std('Paving_Plaza', 0xd8d1c4, { roughness: 0.9 }),
  wall: std('Wall_Plaster', 0xf1e7d6, { roughness: 0.85 }),
  plinth: std('Wall_Stone', 0xbdb2a2, { roughness: 0.95 }),
  roof: std('Roof_Tile', 0xcb6a3f, { roughness: 0.75 }),
  glass: std('Glass', 0x31424e, { roughness: 0.15, metalness: 0.4 }),
  timber: std('Timber_Pergola', 0x8f2d21, { roughness: 0.7 }),
  deck: std('Pool_Deck', 0xebe5da, { roughness: 0.8 }),
  water: std('Water', 0x2aa6d6, { roughness: 0.05, metalness: 0.1 }),
  spray: std('Fountain_Spray', 0xffffff, { roughness: 0.2, transparent: true, opacity: 0.75 }),
  tier: std('Amphi_Seat', 0xf3f1ec, { roughness: 0.85 }),
  stage: std('Amphi_Stage', 0xcfc7b8, { roughness: 0.9 }),
  playSurface: std('Play_Surface', 0xf2c41a, { roughness: 0.9 }),
  playRed: std('Play_Red', 0xd8402f, { roughness: 0.6 }),
  playBlue: std('Play_Blue', 0x2f77c8, { roughness: 0.6 }),
  playGreen: std('Play_Green', 0x3ea35b, { roughness: 0.6 }),
  metal: std('Metal', 0xb3b7bb, { roughness: 0.4, metalness: 0.6 }),
  fence: std('Boundary_Wall', 0xe8e3d8, { roughness: 0.95, side: THREE.DoubleSide }),
  canvas: std('Shade_Canvas', 0xc8372d, { roughness: 0.8, side: THREE.DoubleSide }),
  foliage: std('Foliage', 0xffffff, { vertexColors: true, roughness: 0.95 }),
  car: (name, color) => std(`Car_${name}`, color, { vertexColors: true, roughness: 0.35, metalness: 0.3 }),
};
