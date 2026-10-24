import power from './hospital/power.js';

export default {
  name: 'بیمارستان متروکه',
  theme: 'horror',
  theme_fa: 'ترسناک',
  min_players: 2,
  max_players: 5,
  rooms: [power],
  map_positions: { power: [0, 0] },
};
