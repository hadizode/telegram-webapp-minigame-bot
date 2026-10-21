// PACK = pure data, no logic. Everything here stays on the server.
// The client only ever receives publicView() from packLoader.js — never `digits`.
//
// Scene geometry: images are WIDE landscape pictures; hotspot x/y/w/h are
// percentages of the image (0–100), so they survive any image resolution.
// `image` is a path inside the Mini App's static folder (dist/); until the AI
// images exist, the client paints `bg` instead.
export default {
  name: 'بیمارستان متروکه',
  theme: 'horror',
  theme_fa: 'ترسناک',
  min_players: 2,
  max_players: 5,

  // Hub: where the team starts and where the exit lock is.
  lobby: {
    name_fa: 'لابی',
    image: 'img/demo/lobby.jpg',
    bg: '#1b1f2a',
    hotspots: [
      { id: 'door_r1', type: 'door', to: 'r1', x: 6,  y: 30, w: 12, h: 45, label_fa: 'اتاق ۱' },
      { id: 'door_r2', type: 'door', to: 'r2', x: 24, y: 30, w: 12, h: 45, label_fa: 'اتاق ۲' },
      { id: 'door_r3', type: 'door', to: 'r3', x: 42, y: 30, w: 12, h: 45, label_fa: 'اتاق ۳' },
      { id: 'door_r4', type: 'door', to: 'r4', x: 60, y: 30, w: 12, h: 45, label_fa: 'اتاق ۴' },
      { id: 'exit_lock', type: 'lock', x: 80, y: 35, w: 14, h: 30, label_fa: 'قفل در خروج' },
    ],
  },

  // Each room hides `digits` (secret, 0–9). The exit lock has one cell per player;
  // the digits of all ACTIVE rooms together fill it, in any order.
  rooms: {
    r1: {
      name_fa: 'اتاق عمل',
      image: 'img/demo/r1.jpg',
      bg: '#2a2238',
      digits: [4, 7],
      hotspots: [
        { id: 'back', type: 'door', to: 'lobby', x: 2, y: 35, w: 8, h: 40, label_fa: 'برگشت به لابی' },
        { id: 'chart', type: 'clue', x: 30, y: 25, w: 12, h: 20, label_fa: 'نمودار',
          content: { kind: 'text', text_fa: 'روی نمودار نوشته: «تخت شماره ۴ مال بیمار آخره».' } },
        { id: 'tray', type: 'clue', x: 62, y: 55, w: 12, h: 18, label_fa: 'سینی ابزار',
          content: { kind: 'text', text_fa: 'هفت ابزار روی سینی هست و یکی‌شون کم شده.' } },
      ],
    },
    r2: {
      name_fa: 'داروخانه',
      image: 'img/demo/r2.jpg',
      bg: '#22383a',
      digits: [1],
      hotspots: [
        { id: 'back', type: 'door', to: 'lobby', x: 2, y: 35, w: 8, h: 40, label_fa: 'برگشت به لابی' },
        { id: 'label', type: 'clue', x: 40, y: 30, w: 14, h: 20, label_fa: 'برچسب',
          content: { kind: 'text', text_fa: 'روی قفسه نوشته: «فقط یک قرص کافیه».' } },
      ],
    },
    r3: {
      name_fa: 'آرشیو',
      image: 'img/demo/r3.jpg',
      bg: '#38302a',
      digits: [9],
      hotspots: [
        { id: 'back', type: 'door', to: 'lobby', x: 2, y: 35, w: 8, h: 40, label_fa: 'برگشت به لابی' },
        { id: 'file', type: 'clue', x: 55, y: 40, w: 12, h: 20, label_fa: 'پرونده',
          content: { kind: 'text', text_fa: 'پرونده‌ی شماره ۹ از قفسه افتاده.' } },
      ],
    },
    r4: {
      name_fa: 'سردخانه',
      image: 'img/demo/r4.jpg',
      bg: '#1f2d3a',
      digits: [2],
      hotspots: [
        { id: 'back', type: 'door', to: 'lobby', x: 2, y: 35, w: 8, h: 40, label_fa: 'برگشت به لابی' },
        { id: 'drawer', type: 'clue', x: 48, y: 45, w: 12, h: 20, label_fa: 'کشو',
          content: { kind: 'text', text_fa: 'فقط دو کشو بازه.' } },
      ],
    },
  },

  // Per team size: which rooms are active and how long the team has.
  // Rule (checked by validatePack): total digits of the active rooms === team size.
  variants: {
    2: { rooms: ['r1'],                   minutes: 10 },
    3: { rooms: ['r1', 'r2'],             minutes: 12 },
    4: { rooms: ['r1', 'r2', 'r3'],       minutes: 15 },
    5: { rooms: ['r1', 'r2', 'r3', 'r4'], minutes: 15 },
  },
};
