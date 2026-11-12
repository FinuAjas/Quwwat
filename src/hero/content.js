// Pop-up copy for each hotspot id (ids come from the GLB: userData.hotspotId).
// NOTE: placeholder marketing copy based on the master-plan labels. Replace with approved
// text, figures and images before launch. `image` is optional (path under public/assets).
// `priority: 1` labels show from the aerial view; `2` only appear when the camera is closer.
export const HOTSPOT_CONTENT = {
  'main-building': {
    label: 'Convention Centre', eyebrow: 'Main Building', priority: 1,
    text: 'The heart of Mountain Courtyard: a convention centre for gatherings, celebrations and events, set within landscaped lawns and a ring of visitor parking.',
    tags: ['Events', 'Banquets', 'Lawns'],
  },
  'swimming-pool': {
    label: 'Swimming Pool', eyebrow: 'Leisure', priority: 1,
    text: 'An infinity-edge swimming pool with a central fountain and shaded pergola walk, overlooking the green hillside.',
    tags: ['Infinity edge', 'Fountain', 'Pergola'],
  },
  amphitheater: {
    label: 'Amphitheatre', eyebrow: 'Recreation', priority: 1,
    text: 'An open-air amphitheatre cut into the natural slope, with tiered seating facing a stage and plaza for performances and community events.',
    tags: ['Tiered seating', 'Open-air stage'],
  },
  'recreation-zone': {
    label: "Children's Play Area", eyebrow: 'Recreation Zone', priority: 1,
    text: 'A safe, soft-surfaced play area for children, with slides, swings and play equipment beside the gardens.',
    tags: ['Play equipment', 'Soft surface'],
  },
  'prayer-hall': {
    label: 'Prayer Hall', eyebrow: 'Community', priority: 1,
    text: 'A quiet prayer hall at the upper edge of the site, reached by a garden footpath from the courtyard.',
    tags: ['Garden path'],
  },
  parking: {
    label: 'Visitor Parking', eyebrow: 'Access', priority: 2,
    text: 'Generous landscaped parking wrapping around the courtyard, with further bays along the access road.',
    tags: ['Ring road', 'Landscaped bays'],
  },
  'gate-south': {
    label: 'Nellankandi Gate', eyebrow: 'Entrance', priority: 2,
    text: 'The main entrance from Nellankandi, with a security cabin and a tree-lined winding approach road up the hillside.',
    tags: ['Security cabin', 'Hairpin approach'],
  },
  'gate-west': {
    label: 'West Pergola Gate', eyebrow: 'Entrance', priority: 2,
    text: 'A timber pergola gateway marking the western approach towards the business park side of the site.',
    tags: ['Pergola gateway'],
  },
};
