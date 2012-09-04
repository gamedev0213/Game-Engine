Quintus.Scenes = function(Q) {

  Q.scenes = {};
  Q.stages = [];

  Q.Scene = Q.Class.extend({
    init: function(sceneFunc,opts) {
      this.opts = opts || {};
      this.sceneFunc = sceneFunc;
    }
  });

  // Set up or return a new scene
  Q.scene = function(name,sceneObj,opts) {
    if(sceneObj === void 0) {
      return Q.scenes[name];
    } else {
      if(_.isFunction(sceneObj)) {
        sceneObj = new Q.Scene(sceneObj,opts);
      }
      Q.scenes[name] = sceneObj;
      return sceneObj;
    }
  };

  Q._generatePoints = function(obj) {
    var p = obj.p,
        halfW = p.w/2,
        halfH = p.h/2;

    p.points = [ 
      [ -halfW, -halfH ],
      [  halfW, -halfH ],
      [  halfW,  halfH ],
      [ -halfW,  halfH ]
      ]
  };

  Q._generateCollisionPoints = function(obj) {
    if(!obj.c || 
       obj.c.angle != obj.p.angle ||
       obj.c.scale != obj.p.scale) {

       if(!obj.c) { obj.c = { points: [] } }

       obj.c.angle = obj.p.angle;
       obj.c.scale = obj.p.scale;

       var mat = Q.matrix2d();

       if(obj.c.angle) { mat.rotateDeg(obj.c.angle); }
       if(obj.c.scale) { mat.scale(obj.c.scale); }
      
       for(var i=0;i<obj.p.points.length;i++) {
         if(!obj.c.points[i]) {
           obj.c.points[i] = [];
         }
         mat.transformArr(obj.p.points[i],obj.c.points[i]);
       }

       mat.release();
    }

  };

  // Default to SAT collision between two objects
  // Thanks to doc's at: http://www.sevenson.com.au/actionscript/sat/
  // TODO: handle angles on objects 
  Q.collision = (function() { 
    var normalX, normalY,
        offset = [ 0,0 ],
        result1 = { separate: [] },
        result2 = { separate: [] };

    function calculateNormal(points,idx) {
      var pt1 = points[idx],
          pt2 = points[idx+1] || points[0];

      normalX = -(pt2[1] - pt1[1]);
      normalY = pt2[0] - pt1[0];

      var dist = Math.sqrt(normalX*normalX + normalY*normalY);
      if(dist > 0) {
        normalX /= dist;
        normalY /= dist;
      }
    }

    function dotProductAgainstNormal(point) {
      return (normalX * point[0]) + (normalY * point[1]);

    }

    function collide(o1,o2,flip) {
      var min1,max1,
          min2,max2,
          d1, d2,
          offsetLength,
          tmp, i, j,
          minDist, minDistAbs,
          shortestDist = Number.POSITIVE_INFINITY,
          collided = false,
          p1, p2;

      var result = flip ? result2 : result1;

      p1 = o1.c ? o1.c.points : o1.p.points;
      p2 = o2.c ? o2.c.points : o2.p.points;

      o1 = o1.p;
      o2 = o2.p;

      offset[0] = o1.x + o1.cx - o2.x - o2.cx;
      offset[1] = o1.y + o1.cy - o2.y - o2.cy;

      for(i = 0;i<p1.length;i++) {
        calculateNormal(p1,i);

        min1 = dotProductAgainstNormal(p1[0]);
        max1 = min1;

        for(j = 1; j<p1.length;j++) {
          tmp = dotProductAgainstNormal(p1[j]);
          if(tmp < min1) min1 = tmp;
          if(tmp > max1) max1 = tmp;
        }

        min2 = dotProductAgainstNormal(p2[0]);
        max2 = min2;

        for(j = 1;j<p2.length;j++) {
          tmp = dotProductAgainstNormal(p2[j]);
          if(tmp < min2) min2 = tmp;
          if(tmp > max2) max2 = tmp;
        }

        offsetLength = dotProductAgainstNormal(offset);
        min1 += offsetLength;
        max1 += offsetLength;

        d1 = min1 - max2;
        d2 = min2 - max1;

        if(d1 > 0 || d2 > 0) { return null; }

        minDist = (max2 - min1) * -1;
        if(flip) minDist *= -1;

        minDistAbs = Math.abs(minDist);

        if(minDistAbs < shortestDist) {
          result.distance = minDist;
          result.magnitude = minDistAbs;
          result.normalX = normalX;
          result.normalY = normalY;

          collided = true;
          shortestDist = minDistAbs;
        }
      }

      // Do do return the actual collision
      return collided ? result : null;
    }

    function satCollision(o1,o2) {
      var result1, result2, result;

      // Don't compare a square to a square for no reason
      // if(!o1.p.points && !o2.p.points) return true;

      if(!o1.p.points) { Q._generatePoints(o1); }
      if(!o2.p.points) { Q._generatePoints(o2); }

      if(o1.c || o1.p.angle || o1.p.scale) { Q._generateCollisionPoints(o1); }
      if(o2.c || o2.p.angle || o2.p.scale) { Q._generateCollisionPoints(o2); }

      result1 = collide(o1,o2);
      if(!result1) return false;

      result2 = collide(o2,o1,true);
      if(!result2) return false;

      result = (result2.magnitude < result1.magnitude) ? result2 : result1;

      result.separate[0] = result.distance * result.normalX;
      result.separate[1] = result.distance * result.normalY;

      return result;
    }

    return satCollision;
  })();


  Q.overlap = function(o1,o2) {
    return !((o1.p.y+o1.p.h<o2.p.y) || (o1.p.y>o2.p.y+o2.p.h) ||
             (o1.p.x+o1.p.w<o2.p.x) || (o1.p.x>o2.p.x+o2.p.w));
  };

  Q.Stage = Q.GameObject.extend({
    // Should know whether or not the stage is paused
    defaults: {
      sort: false
    },

    init: function(scene,opts) {
      this.scene = scene;
      this.items = [];
      this.lists = {};
      this.index = {};
      this.removeList = [];

      this.options = _(this.defaults).clone();
      if(this.scene)  { 
        Q._extend(this.options,scene.opts);
      }
      if(opts) { Q._extend(this.options,opts); }


      if(this.options.sort && !_.isFunction(this.options.sort)) {
          this.options.sort = function(a,b) { return ((a.p && a.p.z) || -1) - ((b.p && b.p.z) || -1); };
      }
    },

    // Needs to be separated out so the current stage can be set
    loadScene: function() {
      if(this.scene)  { 
        this.scene.sceneFunc(this);
      }
    },

    each: function(callback) {
      for(var i=0,len=this.items.length;i<len;i++) {
        callback.call(this.items[i],arguments[1],arguments[2]);
      }
    },

    invoke: function(funcName) {
      for(var i=0,len=this.items.length;i<len;i++) {              
        this.items[i][funcName].call(
          this.items[i],arguments[1],arguments[2]
        );
      }
    },

    detect: function(func) {
      for(var i = this.items.length-1;i >= 0; i--) {
        if(func.call(this.items[i],arguments[1],arguments[2],arguments[3])) {
          return this.items[i];
        }
      }
      return false;
    },


    identify: function(func) {
      var result;
      for(var i = this.items.length-1;i >= 0; i--) {
        if(result = func.call(this.items[i],arguments[1],arguments[2],arguments[3])) {
          return result;
        }
      }
      return false;
    },

    addToLists: function(lists,object) {
      for(var i=0;i<lists.length;i++) {
        this.addToList(lists[i],object);
      }
    },

    addToList: function(list, itm) {
      if(!this.lists[list]) { this.lists[list] = []; }
      this.lists[list].push(itm);
    },


    removeFromLists: function(lists, itm) {
      for(var i=0;i<lists.length;i++) {
        this.removeFromList(lists[i],itm);
      }
    },

    removeFromList: function(list, itm) {
      var listIndex = _.indexOf(this.lists[list],itm);
      if(listIndex != -1) { 
        this.lists[list].splice(listIndex,1);
      }
    },

    insert: function(itm) {
      this.items.push(itm);
      itm.parent = this;
      if(itm.className) { this.addToList(itm.className, itm); }
      if(itm.activeComponents) { this.addToLists(itm.activeComponents, itm) }

      if(itm.p) {
        this.index[itm.p.id] = itm;
      }
      this.trigger('inserted',itm);
      itm.trigger('inserted',this);
      return itm;
    },

    remove: function(itm) {
      this.removeList.push(itm);
    },

    forceRemove: function(itm) {
      var idx = _.indexOf(this.items,itm);
      if(idx != -1) { 
        this.items.splice(idx,1);

        if(itm.className) { this.removeFromList(itm.className,itm); }
        if(itm.activeComponents) { this.removeFromLists(itm.activeComponents,itm); }

        if(itm.destroy) itm.destroy();
        if(itm.p.id) {
          delete this.index[itm.p.id];
        }
        this.trigger('removed',itm);
      }
    },

    pause: function() {
      this.paused = true;
    },

    unpause: function() {
      this.paused = false;
    },

    _hitTest: function(obj,collisionMask,collisionLayer) {
      if(obj != this && this != collisionLayer) {
        var col = (!collisionMask || (this.p && this.p.type & collisionMask)) && Q.overlap(obj,this);
        if(col) {
          col= Q.collision(obj,this);
          col.obj = this;
        }
        return col ? col : false;
      }
    },

    collisionLayer: function(layer) {
      this._collisionLayer = this.insert(layer);
    },

    search: function(obj,collisionMask) {
      collisionMask = collisionMask || (obj.p && obj.p.collisionMask);
      if(this._collisionLayer && (this._collisionLayer.p.type & collisionMask)) {
        col = this._collisionLayer.collide(obj);
        if(col) return col;
      }

      col = this.identify(this._hitTest,obj,collisionMask,this._collisionLayer);
      return col;
    },

    collide: function(obj,collisionMask) {
      var col, lastCol = true, maxCol = 3;
      collisionMask = collisionMask || (obj.p && obj.p.collisionMask);
      if(this._collisionLayer && (this._collisionLayer.p.type & collisionMask)) {
        while(maxCol > 0 && (col = this._collisionLayer.collide(obj))) {
          obj.trigger('hit',col);
          obj.trigger('hit.collision',col);
          maxCol--;
        }
      }

      col = this.identify(this._hitTest,obj,collisionMask,this._collisionLayer);
      if(col) {
        obj.trigger('hit',col);
        obj.trigger('hit.sprite',col);
      }

      return col;
    },

    step:function(dt) {
      if(this.paused) { return false; }

      this.trigger("prestep",dt);
      this.invoke("step",dt);
      this.trigger("step",dt);

      if(this.removeList.length > 0) {
        for(var i=0,len=this.removeList.length;i<len;i++) {
          this.forceRemove(this.removeList[i]);
        }
        this.removeList.length = 0;
      }

      this.trigger('poststep',dt);
    },

    draw: function(ctx) {
      if(this.options.sort) {
        this.items.sort(this.options.sort);
      }
      this.trigger("predraw",ctx);
      this.invoke("draw",ctx);
      this.trigger("draw",ctx);
    }
  });

  Q.activeStage = 0;

  Q.StageSelector = Q.Class.extend({
    emptyList: [],

    init: function(stage,selector) {
      this.stage = stage;
      this.selector = selector;

      // Generate an object list from the selector
      // TODO: handle array selectors
      this.items = this.stage.lists[this.selector] || this.emptyList;
    },

    each: function(callback) {
      for(var i=0,len=this.items.length;i<len;i++) {
        callback.call(this.items[i],arguments[1],arguments[2]);
      }
      return this;
    },

    invoke: function(funcName) {
      for(var i=0,len=this.items.length;i<len;i++) {              
        this.items[i][funcName].call(
          this.items[i],arguments[1],arguments[2]
        );
      }
      return this;
    },

    trigger: function(name,params) {
      this.invoke("trigger",name,params);
    },

    detect: function(func) {
      for(var i = 0,val=null, len=this.items.length; i < len; i++) {
        if(func.call(this.items[i],arguments[1],arguments[2])) {
          return this.items[i];
        }
      }
      return false;
    },

    identify: function(func) {
      var result = null;
      for(var i = 0,val=null, len=this.items.length; i < len; i++) {
        if(result = func.call(this.items[i],arguments[1],arguments[2])) {
          return result;
        }
      }
      return false;

    },

    // This hidden utility method extends
    // and object's properties with a source object.
    // Used by the p method to set properties.
    _pObject: function(source) {
      Q._extend(this.p,source);
    },

    _pSingle: function(property,value) {
      this.p[property] = value;
    },

    p: function(property, value) {
      // Is value undefined
      if(value == void 0) {
        this.each(this._pObject,property);
      } else {
        this.each(this._pSingle,property,value);
      }

      return this;
    },

    at: function(idx) {
      return this.items[idx];
    },

    first: function() {
      return this.items[0];
    },

    last: function() {
      return this.items[this.items.length-1];
    }

  });

  // Maybe add support for different types
  // entity - active collision detection
  //  particle - no collision detection, no adding components to lists / etc
  //

  // Q("Player").invoke("shimmer); - needs to return a selector
  // Q(".happy").invoke("sasdfa",'fdsafas',"fasdfas");
  // Q("Enemy").p({ a: "asdfasf"  });

  Q.select = function(selector,scope) {
    scope = (scope === void 0) ? Q.activeStage : scope;
    scope = Q.stage(scope);
    if(_.isNumber(selector)) {
      scope.index[selector];
    } else {
      return new Q.StageSelector(scope,selector);
      // check if is array
      // check is has any commas
         // split into arrays
      // find each of the classes
      // find all the instances of a specific class
    }
  };

  Q.stage = function(num) {
    // Use activeStage is num is undefined
    num = (num === void 0) ? Q.activeStage : num;
    return Q.stages[num];
  };

  Q.stageScene = function(scene,num,stageClass) {
    stageClass = stageClass || Q.Stage;
    if(_(scene).isString()) {
      scene = Q.scene(scene);
    }

    num = num || 0;

    if(Q.stages[num]) {
      Q.stages[num].destroy();
    }

    Q.activeStage = num;
    Q.stages[num] = new stageClass(scene);
    if(scene) {
      Q.stages[num].loadScene();
    }
    Q.activeStage = 0;


    if(!Q.loop) {
      Q.gameLoop(Q.stageGameLoop);
    }

    return Q.stages[num];
  };

  Q.stageGameLoop = function(dt) {
    if(Q.ctx) { Q.clear(); }

    for(var i =0,len=Q.stages.length;i<len;i++) {
      Q.activeStage = i;
      var stage = Q.stage();
      if(stage) {
        stage.step(dt);
        stage.draw(Q.ctx);
      }
    }

    Q.activeStage = 0;

    if(Q.input && Q.ctx) { Q.input.drawCanvas(Q.ctx); }
  };

  Q.clearStage = function(num) {
    if(Q.stages[num]) { 
      Q.stages[num].destroy(); 
      Q.stages[num] = null;
    }
  };

  Q.clearStages = function() {
    for(var i=0,len=Q.stages.length;i<len;i++) {
      if(Q.stages[i]) { Q.stages[i].destroy(); }
    }
    Q.stages.length = 0;
  };


};

