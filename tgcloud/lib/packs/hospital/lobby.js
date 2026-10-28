export default {
  id: "lobby",
  views: {
    lobby: {"image":"/dist/pack1/lobby/Gemini_Generated_Image_ngbl2tngbl2tngbl.jpg"},
  },
  objects: {
    officedoor: {"view":"lobby","x":84.5,"y":17.1,"w":10.4,"h":80.7,"action":"goto","to":"office"},
    powerdoor: {"view":"lobby","x":72.2,"y":28.9,"w":6.6,"h":49.2,"action":"goto","to":"main"},
    libdoor: {"view":"lobby","x":23,"y":30,"w":6,"h":46.6,"action":"goto","to":"library"},
    serdoor: {"view":"lobby","x":4.7,"y":22.9,"w":11.4,"h":67.1,"action":"goto","to":"sergery"},
    back: {"view":"lobby","x":44.5,"y":82.9,"w":11.3,"h":17.1,"action":"goto","image":"/dist/pack1/lobby/Ornate Crimson Fantasy Back Arrow.png","to":"locklobby"},
    morguest: {"view":"lobby","x":30.3,"y":11.2,"w":8.1,"h":49.1,"action":"goto","to":"morgue"},
    waitingdoor: {"view":"lobby","x":44,"y":37.6,"w":16.3,"h":21.8,"action":"goto","to":"waiting"},
  },
};
