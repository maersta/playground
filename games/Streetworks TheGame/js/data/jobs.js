// ============================================================================
// JOB DEFINITIONS
// ----------------------------------------------------------------------------
// Data-driven paint jobs. Each job has a world size and a list of `targets`.
// Supported target geometry types: 'line' | 'rectangle' | 'circle' | 'arc' | 'polygon'
//
//   line:      { x1, y1, x2, y2 }
//   rectangle: { x, y, w, h, filled? }
//   circle:    { cx, cy, radius, filled? }
//   arc:       { cx, cy, radius, startAngle, endAngle } (radians, unfilled only)
//   polygon:   { points: [[x,y], ...], closed?, filled? }
//
// Every target also carries: id, color (hex), strokeWidth (tolerance band
// width in world px for stroke shapes), label. Add a new job by pushing a new
// object into JOBS - nothing else in the engine needs to change.
// ============================================================================

const DEG = Math.PI / 180;

function basketballCourt() {
  const world = { width: 1500, height: 950 };
  const court = { x: 200, y: 175, w: 1100, h: 600 };
  const cx = court.x + court.w / 2;
  const cy = court.y + court.h / 2;
  const keyW = 224; // extends from baseline into the court
  const keyH = 189; // width of the key
  const ftR = 71;
  const threeR = 280;
  const basketInset = 62;
  const white = '#f2f0e6';

  const targets = [
    {
      id: 'boundary', label: 'Court Boundary', color: white, strokeWidth: 10,
      geometry: { type: 'rectangle', x: court.x, y: court.y, w: court.w, h: court.h },
    },
    {
      id: 'center_line', label: 'Center Line', color: white, strokeWidth: 10,
      geometry: { type: 'line', x1: cx, y1: court.y, x2: cx, y2: court.y + court.h },
    },
    {
      id: 'center_circle', label: 'Center Circle', color: white, strokeWidth: 10,
      geometry: { type: 'circle', cx, cy, radius: ftR },
    },
    {
      id: 'left_key', label: 'Left Key', color: white, strokeWidth: 10,
      geometry: { type: 'rectangle', x: court.x, y: cy - keyH / 2, w: keyW, h: keyH },
    },
    {
      id: 'right_key', label: 'Right Key', color: white, strokeWidth: 10,
      geometry: { type: 'rectangle', x: court.x + court.w - keyW, y: cy - keyH / 2, w: keyW, h: keyH },
    },
    {
      id: 'left_ft_circle', label: 'Left Free-Throw Circle', color: white, strokeWidth: 10,
      geometry: { type: 'circle', cx: court.x + keyW, cy, radius: ftR },
    },
    {
      id: 'right_ft_circle', label: 'Right Free-Throw Circle', color: white, strokeWidth: 10,
      geometry: { type: 'circle', cx: court.x + court.w - keyW, cy, radius: ftR },
    },
    {
      id: 'left_three', label: 'Left Three-Point Arc', color: white, strokeWidth: 10,
      geometry: {
        type: 'arc', cx: court.x + basketInset, cy, radius: threeR,
        startAngle: -100 * DEG, endAngle: 100 * DEG,
      },
    },
    {
      id: 'right_three', label: 'Right Three-Point Arc', color: white, strokeWidth: 10,
      geometry: {
        type: 'arc', cx: court.x + court.w - basketInset, cy, radius: threeR,
        startAngle: 80 * DEG, endAngle: 280 * DEG,
      },
    },
  ];

  return {
    id: 'basketball_court',
    name: 'Basketball Court',
    description: 'Full outdoor court markings - boundary, key, circles and both three-point arcs.',
    difficulty: 'Hard',
    world,
    startPoint: { x: court.x - 80, y: court.y + court.h / 2 },
    parTimeSeconds: 150,
    colors: [white],
    targets,
  };
}

function loadingZoneLot() {
  const world = { width: 1000, height: 700 };
  const lot = { x: 150, y: 150, w: 700, h: 400 };
  const white = '#f2f0e6';
  const blue = '#3f7fd1';
  const yellow = '#f5c518';
  const stallW = lot.w / 6;

  const targets = [
    {
      id: 'boundary', label: 'Lot Boundary', color: white, strokeWidth: 8,
      geometry: { type: 'rectangle', x: lot.x, y: lot.y, w: lot.w, h: lot.h },
    },
    {
      id: 'accessible_bay', label: 'Accessible Bay', color: blue, strokeWidth: 8,
      geometry: { type: 'rectangle', x: lot.x, y: lot.y, w: stallW, h: lot.h, filled: true },
    },
  ];

  for (let i = 1; i < 6; i++) {
    const x = lot.x + i * stallW;
    targets.push({
      id: `divider_${i}`, label: `Stall Divider ${i}`, color: white, strokeWidth: 6,
      geometry: { type: 'line', x1: x, y1: lot.y, x2: x, y2: lot.y + lot.h },
    });
  }

  const arrowCx = lot.x + lot.w / 2;
  const arrowCy = lot.y + lot.h / 2;
  const arrowPts = [
    [0, -60], [-30, -10], [-12, -10], [-12, 45], [12, 45], [12, -10], [30, -10],
  ].map(([px, py]) => [px + arrowCx, py + arrowCy]);

  targets.push({
    id: 'arrow', label: 'Directional Arrow', color: yellow, strokeWidth: 8,
    geometry: { type: 'polygon', points: arrowPts, closed: true, filled: true },
  });

  return {
    id: 'loading_zone',
    name: 'Loading Zone Lot',
    description: 'Small parking lot: boundary, stall dividers, an accessible bay and a directional arrow.',
    difficulty: 'Easy',
    world,
    startPoint: { x: lot.x - 60, y: lot.y + lot.h / 2 },
    parTimeSeconds: 75,
    colors: [white, blue, yellow],
    targets,
  };
}

function tennisCourt() {
  const world = { width: 1220, height: 665 };
  const court = { x: 150, y: 120, w: 920, h: 425 };
  const cx = court.x + court.w / 2;
  const cy = court.y + court.h / 2;
  const singlesInset = 53; // doubles->singles sideline inset
  const serviceDist = 248; // distance from net to each service line
  const white = '#f2f0e6';

  const targets = [
    {
      id: 'boundary', label: 'Doubles Boundary', color: white, strokeWidth: 8,
      geometry: { type: 'rectangle', x: court.x, y: court.y, w: court.w, h: court.h },
    },
    {
      id: 'left_singles', label: 'Left Singles Sideline', color: white, strokeWidth: 6,
      geometry: { type: 'line', x1: court.x + singlesInset, y1: court.y, x2: court.x + singlesInset, y2: court.y + court.h },
    },
    {
      id: 'right_singles', label: 'Right Singles Sideline', color: white, strokeWidth: 6,
      geometry: { type: 'line', x1: court.x + court.w - singlesInset, y1: court.y, x2: court.x + court.w - singlesInset, y2: court.y + court.h },
    },
    {
      id: 'top_service', label: 'Top Service Line', color: white, strokeWidth: 6,
      geometry: { type: 'line', x1: court.x + singlesInset, y1: cy - serviceDist, x2: court.x + court.w - singlesInset, y2: cy - serviceDist },
    },
    {
      id: 'bottom_service', label: 'Bottom Service Line', color: white, strokeWidth: 6,
      geometry: { type: 'line', x1: court.x + singlesInset, y1: cy + serviceDist, x2: court.x + court.w - singlesInset, y2: cy + serviceDist },
    },
    {
      id: 'center_service', label: 'Center Service Line', color: white, strokeWidth: 6,
      geometry: { type: 'line', x1: cx, y1: cy - serviceDist, x2: cx, y2: cy + serviceDist },
    },
  ];

  return {
    id: 'tennis_court',
    name: 'Tennis Court',
    description: 'Doubles boundary, singles sidelines, both service lines and the center service line.',
    difficulty: 'Medium',
    world,
    startPoint: { x: court.x - 70, y: cy },
    parTimeSeconds: 110,
    colors: [white],
    targets,
  };
}

function hopscotchPlayground() {
  const world = { width: 600, height: 950 };
  const S = 85;
  const gap = 10;
  const centerX = world.width / 2;
  const bottomY = 800;
  const rowSpacing = 95;
  const palette = ['#e2503a', '#f5a623', '#f5d423', '#4caf6a', '#3f8ee0', '#8e5fd1'];
  const homeColor = '#e0559c';

  const rowY = (i) => bottomY - i * rowSpacing;
  const singleSquare = (n, rowIndex) => ({
    id: `square_${n}`, label: `Square ${n}`, color: palette[(n - 1) % palette.length], strokeWidth: 8,
    geometry: { type: 'rectangle', x: centerX - S / 2, y: rowY(rowIndex) - S / 2, w: S, h: S, filled: true },
  });
  const pairSquares = (nLeft, nRight, rowIndex) => ([
    {
      id: `square_${nLeft}`, label: `Square ${nLeft}`, color: palette[(nLeft - 1) % palette.length], strokeWidth: 8,
      geometry: { type: 'rectangle', x: centerX - gap / 2 - S, y: rowY(rowIndex) - S / 2, w: S, h: S, filled: true },
    },
    {
      id: `square_${nRight}`, label: `Square ${nRight}`, color: palette[(nRight - 1) % palette.length], strokeWidth: 8,
      geometry: { type: 'rectangle', x: centerX + gap / 2, y: rowY(rowIndex) - S / 2, w: S, h: S, filled: true },
    },
  ]);

  const targets = [
    singleSquare(1, 0),
    ...pairSquares(2, 3, 1),
    singleSquare(4, 2),
    ...pairSquares(5, 6, 3),
    singleSquare(7, 4),
    ...pairSquares(8, 9, 5),
    {
      id: 'square_10', label: 'Home', color: homeColor, strokeWidth: 8,
      geometry: { type: 'circle', cx: centerX, cy: rowY(6), radius: S / 2, filled: true },
    },
  ];

  return {
    id: 'hopscotch',
    name: 'Playground Hopscotch',
    description: 'A rainbow hopscotch grid - ten squares (well, nine squares and a home circle), every one its own color.',
    difficulty: 'Easy',
    world,
    startPoint: { x: centerX - 220, y: rowY(3) },
    parTimeSeconds: 55,
    colors: [...palette, homeColor],
    targets,
  };
}

function crosswalkStreet() {
  const world = { width: 900, height: 500 };
  const white = '#f2f0e6';
  const yellow = '#f5c518';
  const roadY = 110;
  const roadH = 280;
  const stripeW = 40;
  const stripeGap = 45;
  const stripeCount = 6;
  const totalStripesW = stripeCount * stripeW + (stripeCount - 1) * stripeGap;
  const startX = (world.width - totalStripesW) / 2;
  const stopLineX = startX - 80;

  const targets = [
    {
      id: 'centerline', label: 'Road Centerline', color: yellow, strokeWidth: 6,
      geometry: { type: 'line', x1: 20, y1: world.height / 2, x2: world.width - 20, y2: world.height / 2 },
    },
    {
      id: 'stop_line', label: 'Stop Line', color: white, strokeWidth: 8,
      geometry: { type: 'rectangle', x: stopLineX, y: roadY, w: 20, h: roadH, filled: true },
    },
  ];

  for (let i = 0; i < stripeCount; i++) {
    targets.push({
      id: `stripe_${i + 1}`, label: `Crosswalk Stripe ${i + 1}`, color: white, strokeWidth: 8,
      geometry: { type: 'rectangle', x: startX + i * (stripeW + stripeGap), y: roadY, w: stripeW, h: roadH, filled: true },
    });
  }

  return {
    id: 'crosswalk',
    name: 'Crosswalk & Stop Line',
    description: 'A quick street job: the road centerline, a stop line and a full zebra crossing.',
    difficulty: 'Easy',
    world,
    startPoint: { x: 60, y: world.height / 2 },
    parTimeSeconds: 45,
    colors: [white, yellow],
    targets,
  };
}

export const JOBS = [
  crosswalkStreet(),
  hopscotchPlayground(),
  loadingZoneLot(),
  tennisCourt(),
  basketballCourt(),
];

export function getJob(id) {
  return JOBS.find((j) => j.id === id) || null;
}
