// ============================================================================
// COWORKER ROSTER
// ----------------------------------------------------------------------------
// Face images live in /avatars (loaded automatically by faces.js - see
// js/faces.js). To add or replace a coworker: drop a photo in /avatars and
// add/edit an entry below. Nothing else in the codebase needs to change.
//
// personality fields (all 0..1 unless noted):
//   movementSpeed    - base walk speed multiplier
//   paintingSpeed    - how fast they sweep the roller across a target
//   accuracy         - how tightly they stay inside the tolerance band
//   patience         - willingness to slow down / redo bad sections
//   competitiveness  - how much falling behind speeds them up
//   perfectionism    - chance of doing a correction pass after a target
//   riskTaking       - how close to the tolerance edge they cut it
//   laziness         - chance of idling / taking a break
//   mistakeRate      - chance of jitter/slop while painting
//   taskPreference   - 'hardest_first' | 'easiest_first' | 'sequential' | 'random'
//   correctionBehavior - 'always' | 'sometimes' | 'rarely' | 'never'
//   stressLevel      - baseline jitteriness/speed-up under pressure
// ============================================================================

export const COWORKERS = [
  {
    id: 'benji',
    name: 'Benji',
    tag: 'The Method Man',
    face: 'avatars/benji.jpg',
    blurb: 'Banjo beanie, bigger smile, weirdly disciplined about it. Benji works the job in the exact same order every single time - boring in the best possible way, he just gets it done.',
    shirtColor: '#3f6fb0',
    pantsColor: '#2b2b2b',
    personality: {
      movementSpeed: 1.0,
      paintingSpeed: 1.0,
      accuracy: 0.80,
      patience: 0.70,
      competitiveness: 0.68,
      perfectionism: 0.55,
      riskTaking: 0.38,
      laziness: 0.28,
      mistakeRate: 0.12,
      taskPreference: 'sequential',
      correctionBehavior: 'sometimes',
      stressLevel: 0.4,
    },
  },
  {
    id: 'chrille',
    name: 'Chrille',
    tag: 'The Speedster',
    face: 'avatars/chrille.jpg',
    blurb: 'Glasses on, mustache groomed, zero patience once the roller is in his hand. Chrille thinks a paint job is a race and treats every line like a finish line. Fast, loud, occasionally a disaster.',
    shirtColor: '#4c7a52',
    pantsColor: '#33362a',
    personality: {
      movementSpeed: 1.32,
      paintingSpeed: 1.30,
      accuracy: 0.62,
      patience: 0.28,
      competitiveness: 0.92,
      perfectionism: 0.18,
      riskTaking: 0.88,
      laziness: 0.10,
      mistakeRate: 0.26,
      taskPreference: 'easiest_first',
      correctionBehavior: 'never',
      stressLevel: 0.7,
    },
  },
  {
    id: 'jamie',
    name: 'Jamie',
    tag: 'The Wildcard',
    face: 'avatars/jamie.jpg',
    blurb: 'Neck tattoos, thousand-yard stare, no plan whatsoever. Jamie bounces between tasks on a whim and somehow still gets paint on the ground.',
    shirtColor: '#8a3b3b',
    pantsColor: '#26262a',
    personality: {
      movementSpeed: 1.12,
      paintingSpeed: 0.92,
      accuracy: 0.58,
      patience: 0.18,
      competitiveness: 0.60,
      perfectionism: 0.28,
      riskTaking: 0.72,
      laziness: 0.40,
      mistakeRate: 0.32,
      taskPreference: 'random',
      correctionBehavior: 'sometimes',
      stressLevel: 0.8,
    },
  },
  {
    id: 'wille',
    name: 'Wille',
    tag: 'The Slacker',
    face: 'avatars/wille.jpg',
    blurb: 'Smirking, unbothered, works exactly as hard as required and not one calorie more. Wille will find a reason to stand around if you let him.',
    shirtColor: '#b0842f',
    pantsColor: '#2c2c2c',
    personality: {
      movementSpeed: 0.86,
      paintingSpeed: 0.76,
      accuracy: 0.76,
      patience: 0.6,
      competitiveness: 0.30,
      perfectionism: 0.40,
      riskTaking: 0.30,
      laziness: 0.82,
      mistakeRate: 0.15,
      taskPreference: 'easiest_first',
      correctionBehavior: 'rarely',
      stressLevel: 0.15,
    },
  },
  {
    id: 'jimmy',
    name: 'Jimmy',
    tag: 'The Perfectionist',
    face: 'avatars/1000019607.jpg',
    blurb: 'Sunglasses on indoors, cigarette permanently attached, somehow still a ruler-straight painter. Jimmy will circle back three times on a wobbly edge nobody else even noticed.',
    shirtColor: '#4a4a4a',
    pantsColor: '#1f1f1f',
    personality: {
      movementSpeed: 0.80,
      paintingSpeed: 0.72,
      accuracy: 0.96,
      patience: 0.92,
      competitiveness: 0.45,
      perfectionism: 0.95,
      riskTaking: 0.10,
      laziness: 0.05,
      mistakeRate: 0.03,
      taskPreference: 'hardest_first',
      correctionBehavior: 'always',
      stressLevel: 0.2,
    },
  },
];

export function getCoworker(id) {
  return COWORKERS.find((c) => c.id === id) || null;
}
