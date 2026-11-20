/**
 * The play equipment that moves (Plan 4, H6), shared by src/model/structures.js (the equipment) and
 * src/model/people.js (the children on it), so the two always move together.
 * Positions are in the play area's own frame: origin at its centre on the pad, X east, Z south (the area is not rotated).
 *
 * Each moving object has its origin at its pivot and carries `userData.motion`, which src/hero/motion.js reads:
 *  - { kind: 'swing', amplitude (rad), period (s), phase (rad) }: rocks about the object's local X axis
 *  - { kind: 'spin', period (s) }: turns about the object's local Y axis
 */
export const PLAY = {
  G: 0.2, // top of the play surface
  // swing set: beam along X at height `beam` above G, centred on (x0, z0); a seat hangs at each offset along it
  swings: { x0: 2.5, z0: 1.9, beam: 2.5, seats: [-0.8, 0.8] },
  roundabout: { x: -1.2, z: 3.5 },
  motion: {
    // a pendulum of about 2 m swings once every 3 s; the two drift in and out of step
    swings: [
      { kind: 'swing', amplitude: 0.3, period: 3.0, phase: 0 },
      { kind: 'swing', amplitude: 0.24, period: 3.15, phase: 2.2 },
    ],
    roundabout: { kind: 'spin', period: 16 },
  },
};
