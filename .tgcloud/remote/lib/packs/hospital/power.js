// اتاق برق — interactive room (see lib/engine.js for every field).
// Coordinates come from the editor; objects marked NEW still have placeholder coordinates.
// Images live inside public/ (the deployed folder); paths have NO leading slash.
export default {
  name_fa: 'اتاق برق',
  bg: '#1b1f2a',
  digits: [2], // shown on the generator display once it is on
  start: 'main',
  items: {
    fuse: { name: 'فیوز' },
    connector: { name: 'کانکتور' },
  },
  win: {
    requires: ['mainSwitch'],
    text: 'ژنراتور روشن شد و چراغ لابی هم روشن شد!',
  },
  views: {
    main: { image: 'pack1/powerroom/main.jpg' },
    box: { image: 'pack1/powerroom/box.png' },
    cassete: { image: 'pack1/powerroom/cassete.png' },
  },
  objects: {
    fuse1: { view: 'main', x: 86, y: 79.2, w: 2.7, h: 2.6, action: 'pickup', item: 'fuse', image: 'pack1/powerroom/fuse1.webp', text: '🔌 یه فیوز پیدا کردی' },
    fuse2: { view: 'main', x: 48.6, y: 83.1, w: 3.4, h: 1.6, action: 'pickup', item: 'fuse', image: 'pack1/powerroom/fuse2.webp', text: '🔌 یه فیوز پیدا کردی' },
    fuse3: { view: 'main', x: 6.2, y: 58.5, w: 2.7, h: 1.4, action: 'pickup', item: 'fuse', image: 'pack1/powerroom/fuse3.webp', text: '🔌 یه فیوز پیدا کردی' },
    connector: { view: 'main', x: 3.7, y: 74.7, w: 2.3, h: 2.3, action: 'pickup', item: 'connector', image: 'pack1/powerroom/connector.webp', text: '🔧 یه کانکتور یدکی پیدا کردی' },
    cassete: { view: 'main', x: 27.7, y: 86.5, w: 4.7, h: 5.3, action: 'goto', to: 'cassete' },
    box: { view: 'main', x: 3.1, y: 19.1, w: 9.2, h: 23.5, action: 'goto', to: 'box' },

    button: { view: 'cassete', x: 69.4, y: 61.8, w: 5.4, h: 6.6, action: 'play', audio: 'pack1/powerroom/recorder.mp3', images: { done: { image: 'pack1/powerroom/recorder_playing.webp' } }, text: '🎙 صدای خش‌دار: «...کمک... سیم آبی... نول...»' },

    slot1: { view: 'box', x: 56.5, y: 35.2, w: 5.8, h: 25.3, action: 'place', accepts: 'fuse', images: { done: { image: 'pack1/powerroom/fuse_installed_1.webp' } }, text: '🔧 فیوز جا رفت', failText: '🤔 این اینجا جا نمی‌شه' },
    slot2: { view: 'box', x: 47.6, y: 35.2, w: 5.8, h: 24.9, action: 'place', accepts: 'fuse', images: { done: { image: 'pack1/powerroom/fuse_installed_2.webp' } }, text: '🔧 فیوز جا رفت', failText: '🤔 این اینجا جا نمی‌شه' },
    slot3: { view: 'box', x: 38.9, y: 35.2, w: 5.8, h: 24.9, action: 'place', accepts: 'fuse', images: { done: { image: 'pack1/powerroom/fuse_installed_3.webp' } }, text: '🔧 فیوز جا رفت', failText: '🤔 این اینجا جا نمی‌شه' },
    wiretip: { view: 'box', x: 56.7, y: 69.7, w: 3.7, h: 5.6, action: 'examine', images: { idle: { image: 'pack1/powerroom/wire_blue_loose.webp' }, done: { image: 'pack1/powerroom/wire_blue_connected.webp' } }, text: 'سیم آبی سرش لخته و کانکتور نداره', doneText: 'سیم آبی به ترمینال نول وصله' },

    // NEW — coordinates are placeholders, place them in the editor
    wiringMap: { view: 'box', x: 5, y: 30, w: 20, h: 25, action: 'examine', text: '📜 نقشه‌ی سیم‌کشی: ترمینال نول با دایره‌ی توخالی (○) مشخص شده' },
    terminalA: { view: 'box', x: 64, y: 69.7, w: 3.5, h: 5.6, action: 'place', decoy: true, failText: '⚡ جرقه زد! اینجا نیست' },
    terminalN: { view: 'box', x: 69, y: 69.7, w: 3.5, h: 5.6, action: 'place', accepts: 'connector', sets: { wiretip: 'done' }, text: '🔌 سیم آبی به ترمینال نول وصل شد', failText: '🤔 این اینجا جواب نمی‌ده' },
    terminalG: { view: 'box', x: 74, y: 69.7, w: 3.5, h: 5.6, action: 'place', decoy: true, failText: '⚡ جرقه زد! اینجا نیست' },
    mainSwitch: { view: 'box', x: 80, y: 40, w: 7, h: 12, action: 'toggle', requires: ['slot1', 'slot2', 'slot3', 'terminalN'], sets: { display: 'on' }, text: '💡 ژنراتور روشن شد! چراغ لابی هم روشن شد.', failText: '⚡ برق نمی‌گیره؛ یه چیزی کمه' },
    display: { view: 'box', x: 40, y: 12, w: 22, h: 14, action: 'examine', labels: { on: '2' }, text: '📟 نمایشگر خاموشه', doneText: '📟 نمایشگر عدد ۲ رو نشون می‌ده' },
  },
};
