export default {
  id: "power",
  views: {
    main: {"image":"/dist/pack1/powerroom/main.png"},
    box: {"image":"/dist/pack1/powerroom/box.png"},
    cassete: {"image":"/dist/pack1/powerroom/cassete.png"},
  },
  objects: {
    fuse1: {"view":"main","x":86,"y":79.2,"w":2.7,"h":2.6,"action":"pickup"},
    fuse2: {"view":"main","x":48.6,"y":83.1,"w":3.4,"h":1.6,"action":"pickup"},
    fuse3: {"view":"main","x":6.2,"y":58.5,"w":2.7,"h":1.4,"action":"pickup"},
    cassete: {"view":"main","x":27.7,"y":86.5,"w":4.7,"h":5.3,"action":"goto","to":"cassete"},
    connector: {"view":"main","x":3.7,"y":74.7,"w":2.3,"h":2.3,"action":"pickup"},
    slot1: {"view":"box","x":56.5,"y":35.2,"w":5.8,"h":25.3,"action":"place","accepts":"fuse","images":{"done":{"image":"rooms/power/fuse_installed_1.webp"}},"text":"🔧 فیوز جا رفت","failText":"🤔 این اینجا جا نمی‌شه"},
    slot2: {"view":"box","x":47.6,"y":35.2,"w":5.8,"h":24.9,"action":"place","accepts":"fuse","images":{"done":{"image":"rooms/power/fuse_installed_2.webp"}},"text":"🔧 فیوز جا رفت","failText":"🤔 این اینجا جا نمی‌شه"},
    slot3: {"view":"box","x":38.9,"y":35.2,"w":5.8,"h":24.9,"action":"place","accepts":"fuse","images":{"done":{"image":"rooms/power/fuse_installed_3.webp"}},"text":"🔧 فیوز جا رفت","failText":"🤔 این اینجا جا نمی‌شه"},
    wiretip: {"view":"box","x":56.7,"y":69.7,"w":3.7,"h":5.6,"action":"examine","images":{"idle":{"image":"rooms/power/wire_blue_loose.webp"},"done":{"image":"rooms/power/wire_blue_connected.webp"}},"text":"سیم آبی سرش لخته و کانکتور نداره","doneText":"سیم آبی به ترمینال نول وصله"},
    button: {"view":"cassete","x":69.4,"y":61.8,"w":5.4,"h":6.6,"action":"play","audio":"rooms/power/recorder.mp3","text":"🎙 صدای خش‌دار: «...کمک... سیم آبی... نول...»","images":{"done":{"image":"rooms/power/recorder_playing.webp"}}},
    box: {"view":"main","x":3.1,"y":19.1,"w":9.2,"h":23.5,"action":"goto","to":"box"},
  },
};
