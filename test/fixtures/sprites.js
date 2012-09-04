

SpriteFixtures = {


  isLoaded: false,

  loadBlocks: function(Q,callback) {
    SpriteFixtures.isLoaded = false;
    Q.load(["blockbreak.png"],function() {
      // fake the blockbreak.json asset as the JSON doesn't load in the browser
      Q.assets['blockbreak.json'] =  {"ball":{"sx":0,"sy":0,"cols":1,"tilew":20,"tileh":20,"frames":1},"block":{"sx":0,"sy":20,"cols":1,"tilew":40,"tileh":20,"frames":1},"paddle":{"sx":0,"sy":40,"cols":2,"tilew":60,"tileh":20,"frames":2}};
      SpriteFixtures.isLoaded = true;
      if(callback) callback();
    });
  },

  doneLoaded: function() {
    return SpriteFixtures.isLoaded;
  }


};
