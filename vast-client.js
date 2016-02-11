!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.DMVAST=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(_dereq_,module,exports){
var VASTAd;

VASTAd = (function() {
  function VASTAd() {
    this.id = null;
    this.adTitle = null;
    this.adSystem = null;
    this.description = null;
    this.advertiser = null;
    this.errorURLTemplates = [];
    this.impressionURLTemplates = [];
    this.creatives = [];
    this.extensions = {};
  }

  return VASTAd;

})();

module.exports = VASTAd;


},{}],3:[function(_dereq_,module,exports){
var VASTClient, VASTParser, VASTUtil;

VASTParser = _dereq_('./parser.coffee');

VASTUtil = _dereq_('./util.coffee');

VASTClient = (function() {
  function VASTClient() {}

  VASTClient.cappingFreeLunch = 0;

  VASTClient.cappingMinimumTimeInterval = 0;

  VASTClient.options = {
    withCredentials: false,
    timeout: 0
  };

  VASTClient.get = function(url, opts, cb) {
    var extend, now, options;
    now = +new Date();
    extend = exports.extend = function(object, properties) {
      var key, val;
      for (key in properties) {
        val = properties[key];
        object[key] = val;
      }
      return object;
    };
    if (!cb) {
      if (typeof opts === 'function') {
        cb = opts;
      }
      options = {};
    }
    options = extend(this.options, opts);
    if (this.totalCallsTimeout < now) {
      this.totalCalls = 1;
      this.totalCallsTimeout = now + (60 * 60 * 1000);
    } else {
      this.totalCalls++;
    }
    if (this.cappingFreeLunch >= this.totalCalls) {
      cb(null);
      return;
    }
    if (now - this.lastSuccessfullAd < this.cappingMinimumTimeInterval) {
      cb(null);
      return;
    }
    return VASTParser.parse(url, options, (function(_this) {
      return function(response) {
        return cb(response);
      };
    })(this));
  };

  (function() {
    var defineProperty, storage;
    storage = VASTUtil.storage;
    defineProperty = Object.defineProperty;
    ['lastSuccessfullAd', 'totalCalls', 'totalCallsTimeout'].forEach(function(property) {
      defineProperty(VASTClient, property, {
        get: function() {
          return storage.getItem(property);
        },
        set: function(value) {
          return storage.setItem(property, value);
        },
        configurable: false,
        enumerable: true
      });
    });
    if (VASTClient.totalCalls == null) {
      VASTClient.totalCalls = 0;
    }
    if (VASTClient.totalCallsTimeout == null) {
      VASTClient.totalCallsTimeout = 0;
    }
  })();

  return VASTClient;

})();

module.exports = VASTClient;


},{"./parser.coffee":9,"./util.coffee":15}],4:[function(_dereq_,module,exports){
var VASTCompanionAd;

VASTCompanionAd = (function() {
  function VASTCompanionAd() {
    this.id = null;
    this.width = 0;
    this.height = 0;
    this.assetWidth = null;
    this.assetHeight = null;
    this.type = null;
    this.staticResource = null;
    this.htmlResource = null;
    this.iframeResource = null;
    this.companionClickThroughURLTemplate = null;
    this.companionClickTrackingURLTemplates = [];
    this.trackingEvents = {};
    this.adParameters = null;
  }

  return VASTCompanionAd;

})();

module.exports = VASTCompanionAd;


},{}],5:[function(_dereq_,module,exports){
var VASTCreative, VASTCreativeCompanion, VASTCreativeLinear, VASTCreativeNonLinear,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

VASTCreative = (function() {
  function VASTCreative() {
    this.trackingEvents = {};
  }

  return VASTCreative;

})();

VASTCreativeLinear = (function(superClass) {
  extend(VASTCreativeLinear, superClass);

  function VASTCreativeLinear() {
    VASTCreativeLinear.__super__.constructor.apply(this, arguments);
    this.type = "linear";
    this.duration = 0;
    this.skipDelay = null;
    this.mediaFiles = [];
    this.videoClickThroughURLTemplate = null;
    this.videoClickTrackingURLTemplates = [];
    this.videoCustomClickURLTemplates = [];
    this.adParameters = null;
  }

  return VASTCreativeLinear;

})(VASTCreative);

VASTCreativeNonLinear = (function(superClass) {
  extend(VASTCreativeNonLinear, superClass);

  function VASTCreativeNonLinear() {
    this.type = "nonLinear";
    this.variations = [];
  }

  return VASTCreativeNonLinear;

})(VASTCreative);

VASTCreativeCompanion = (function(superClass) {
  extend(VASTCreativeCompanion, superClass);

  function VASTCreativeCompanion() {
    this.type = "companion";
    this.variations = [];
  }

  return VASTCreativeCompanion;

})(VASTCreative);

module.exports = {
  VASTCreativeLinear: VASTCreativeLinear,
  VASTCreativeNonLinear: VASTCreativeNonLinear,
  VASTCreativeCompanion: VASTCreativeCompanion
};


},{}],6:[function(_dereq_,module,exports){
module.exports = {
  client: _dereq_('./client.coffee'),
  tracker: _dereq_('./tracker.coffee'),
  parser: _dereq_('./parser.coffee'),
  util: _dereq_('./util.coffee')
};


},{"./client.coffee":3,"./parser.coffee":9,"./tracker.coffee":11,"./util.coffee":15}],7:[function(_dereq_,module,exports){
var VASTMediaFile;

VASTMediaFile = (function() {
  function VASTMediaFile() {
    this.id = null;
    this.fileURL = null;
    this.deliveryType = "progressive";
    this.mimeType = null;
    this.codec = null;
    this.bitrate = 0;
    this.minBitrate = 0;
    this.maxBitrate = 0;
    this.width = 0;
    this.height = 0;
    this.apiFramework = null;
    this.scalable = null;
    this.maintainAspectRatio = null;
  }

  return VASTMediaFile;

})();

module.exports = VASTMediaFile;


},{}],8:[function(_dereq_,module,exports){
var VASTNonLinearAd;

VASTNonLinearAd = (function() {
  function VASTNonLinearAd() {
    this.id = null;
    this.width = 0;
    this.height = 0;
    this.expandedWidth = null;
    this.expandedHeight = null;
    this.type = null;
    this.staticResource = null;
    this.htmlResource = null;
    this.iframeResource = null;
    this.nonLinearClickThroughURLTemplate = null;
    this.nonLinearClickTrackingURLTemplates = [];
    this.trackingEvents = {};
    this.minSuggestedDuration = null;
  }

  return VASTNonLinearAd;

})();

module.exports = VASTNonLinearAd;


},{}],9:[function(_dereq_,module,exports){
var EventEmitter, URLHandler, VASTAd, VASTCompanionAd, VASTCreativeCompanion, VASTCreativeLinear, VASTCreativeNonLinear, VASTMediaFile, VASTNonLinearAd, VASTParser, VASTResponse, VASTUtil,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

URLHandler = _dereq_('./urlhandler.coffee');

VASTResponse = _dereq_('./response.coffee');

VASTAd = _dereq_('./ad.coffee');

VASTUtil = _dereq_('./util.coffee');

VASTCreativeLinear = _dereq_('./creative.coffee').VASTCreativeLinear;

VASTCreativeNonLinear = _dereq_('./creative.coffee').VASTCreativeNonLinear;

VASTCreativeCompanion = _dereq_('./creative.coffee').VASTCreativeCompanion;

VASTMediaFile = _dereq_('./mediafile.coffee');

VASTCompanionAd = _dereq_('./companionad.coffee');

VASTNonLinearAd = _dereq_('./nonlinearad.coffee');

EventEmitter = _dereq_('events').EventEmitter;

VASTParser = (function() {
  var URLTemplateFilters;

  function VASTParser() {}

  URLTemplateFilters = [];

  VASTParser.addURLTemplateFilter = function(func) {
    if (typeof func === 'function') {
      URLTemplateFilters.push(func);
    }
  };

  VASTParser.removeURLTemplateFilter = function() {
    return URLTemplateFilters.pop();
  };

  VASTParser.countURLTemplateFilters = function() {
    return URLTemplateFilters.length;
  };

  VASTParser.clearUrlTemplateFilters = function() {
    return URLTemplateFilters = [];
  };

  VASTParser.parse = function(url, options, cb) {
    if (!cb) {
      if (typeof options === 'function') {
        cb = options;
      }
      options = {};
    }
    return this._parse(url, null, options, function(err, response) {
      return cb(response);
    });
  };

  VASTParser.vent = new EventEmitter();

  VASTParser.track = function(templates, errorCode) {
    this.vent.emit('VAST-error', errorCode);
    return VASTUtil.track(templates, errorCode);
  };

  VASTParser.on = function(eventName, cb) {
    return this.vent.on(eventName, cb);
  };

  VASTParser.once = function(eventName, cb) {
    return this.vent.once(eventName, cb);
  };

  VASTParser._parse = function(url, parentURLs, options, cb) {
    var filter, i, len;
    if (!cb) {
      if (typeof options === 'function') {
        cb = options;
      }
      options = {};
    }
    for (i = 0, len = URLTemplateFilters.length; i < len; i++) {
      filter = URLTemplateFilters[i];
      url = filter(url);
    }
    if (parentURLs == null) {
      parentURLs = [];
    }
    parentURLs.push(url);
    return URLHandler.get(url, options, (function(_this) {
      return function(err, xml) {
        var ad, complete, j, k, len1, len2, loopIndex, node, ref, ref1, response;
        if (err != null) {
          return cb(err);
        }
        response = new VASTResponse();
        if (!(((xml != null ? xml.documentElement : void 0) != null) && xml.documentElement.nodeName === "VAST")) {
          return cb();
        }
        ref = xml.documentElement.childNodes;
        for (j = 0, len1 = ref.length; j < len1; j++) {
          node = ref[j];
          if (node.nodeName === 'Error') {
            response.errorURLTemplates.push(_this.parseNodeText(node));
          }
        }
        ref1 = xml.documentElement.childNodes;
        for (k = 0, len2 = ref1.length; k < len2; k++) {
          node = ref1[k];
          if (node.nodeName === 'Ad') {
            ad = _this.parseAdElement(node);
            if (ad != null) {
              response.ads.push(ad);
            } else {
              _this.track(response.errorURLTemplates, {
                ERRORCODE: 101
              });
            }
          }
        }
        complete = function(errorAlreadyRaised) {
          var l, len3, ref2;
          if (errorAlreadyRaised == null) {
            errorAlreadyRaised = false;
          }
          if (!response) {
            return;
          }
          ref2 = response.ads;
          for (l = 0, len3 = ref2.length; l < len3; l++) {
            ad = ref2[l];
            if (ad.nextWrapperURL != null) {
              return;
            }
          }
          if (response.ads.length === 0) {
            if (!errorAlreadyRaised) {
              _this.track(response.errorURLTemplates, {
                ERRORCODE: 303
              });
            }
            response = null;
          }
          return cb(null, response);
        };
        loopIndex = response.ads.length;
        while (loopIndex--) {
          ad = response.ads[loopIndex];
          if (ad.nextWrapperURL == null) {
            continue;
          }
          (function(ad) {
            var baseURL, protocol, ref2;
            if (parentURLs.length >= 10 || (ref2 = ad.nextWrapperURL, indexOf.call(parentURLs, ref2) >= 0)) {
              _this.track(ad.errorURLTemplates, {
                ERRORCODE: 302
              });
              response.ads.splice(response.ads.indexOf(ad), 1);
              complete();
              return;
            }
            if (ad.nextWrapperURL.indexOf('//') === 0) {
              protocol = location.protocol;
              ad.nextWrapperURL = "" + protocol + ad.nextWrapperURL;
            } else if (ad.nextWrapperURL.indexOf('://') === -1) {
              baseURL = url.slice(0, url.lastIndexOf('/'));
              ad.nextWrapperURL = baseURL + "/" + ad.nextWrapperURL;
            }
            return _this._parse(ad.nextWrapperURL, parentURLs, options, function(err, wrappedResponse) {
              var base, creative, errorAlreadyRaised, eventName, index, l, len3, len4, len5, len6, m, n, o, ref3, ref4, ref5, ref6, wrappedAd;
              errorAlreadyRaised = false;
              if (err != null) {
                _this.track(ad.errorURLTemplates, {
                  ERRORCODE: 301
                });
                response.ads.splice(response.ads.indexOf(ad), 1);
                errorAlreadyRaised = true;
              } else if (wrappedResponse == null) {
                _this.track(ad.errorURLTemplates, {
                  ERRORCODE: 303
                });
                response.ads.splice(response.ads.indexOf(ad), 1);
                errorAlreadyRaised = true;
              } else {
                response.errorURLTemplates = response.errorURLTemplates.concat(wrappedResponse.errorURLTemplates);
                index = response.ads.indexOf(ad);
                response.ads.splice(index, 1);
                ref3 = wrappedResponse.ads;
                for (l = 0, len3 = ref3.length; l < len3; l++) {
                  wrappedAd = ref3[l];
                  wrappedAd.errorURLTemplates = ad.errorURLTemplates.concat(wrappedAd.errorURLTemplates);
                  wrappedAd.impressionURLTemplates = ad.impressionURLTemplates.concat(wrappedAd.impressionURLTemplates);
                  if (ad.trackingEvents != null) {
                    ref4 = wrappedAd.creatives;
                    for (m = 0, len4 = ref4.length; m < len4; m++) {
                      creative = ref4[m];
                      if (creative.type === 'linear') {
                        ref5 = Object.keys(ad.trackingEvents);
                        for (n = 0, len5 = ref5.length; n < len5; n++) {
                          eventName = ref5[n];
                          (base = creative.trackingEvents)[eventName] || (base[eventName] = []);
                          creative.trackingEvents[eventName] = creative.trackingEvents[eventName].concat(ad.trackingEvents[eventName]);
                        }
                      }
                    }
                  }
                  if (ad.videoClickTrackingURLTemplates != null) {
                    ref6 = wrappedAd.creatives;
                    for (o = 0, len6 = ref6.length; o < len6; o++) {
                      creative = ref6[o];
                      if (creative.type === 'linear') {
                        creative.videoClickTrackingURLTemplates = creative.videoClickTrackingURLTemplates.concat(ad.videoClickTrackingURLTemplates);
                      }
                    }
                  }
                  response.ads.splice(index, 0, wrappedAd);
                }
              }
              delete ad.nextWrapperURL;
              return complete(errorAlreadyRaised);
            });
          })(ad);
        }
        return complete();
      };
    })(this));
  };

  VASTParser.childByName = function(node, name) {
    var child, i, len, ref;
    ref = node.childNodes;
    for (i = 0, len = ref.length; i < len; i++) {
      child = ref[i];
      if (child.nodeName === name) {
        return child;
      }
    }
  };

  VASTParser.childsByName = function(node, name) {
    var child, childs, i, len, ref;
    childs = [];
    ref = node.childNodes;
    for (i = 0, len = ref.length; i < len; i++) {
      child = ref[i];
      if (child.nodeName === name) {
        childs.push(child);
      }
    }
    return childs;
  };

  VASTParser.parseAdElement = function(adElement) {
    var adTypeElement, i, len, ref;
    ref = adElement.childNodes;
    for (i = 0, len = ref.length; i < len; i++) {
      adTypeElement = ref[i];
      adTypeElement.id = adElement.getAttribute("id");
      if (adTypeElement.nodeName === "Wrapper") {
        return this.parseWrapperElement(adTypeElement);
      } else if (adTypeElement.nodeName === "InLine") {
        return this.parseInLineElement(adTypeElement);
      }
    }
  };

  VASTParser.parseWrapperElement = function(wrapperElement) {
    var ad, creative, i, len, ref, wrapperCreativeElement, wrapperURLElement;
    ad = this.parseInLineElement(wrapperElement);
    wrapperURLElement = this.childByName(wrapperElement, "VASTAdTagURI");
    if (wrapperURLElement != null) {
      ad.nextWrapperURL = this.parseNodeText(wrapperURLElement);
    } else {
      wrapperURLElement = this.childByName(wrapperElement, "VASTAdTagURL");
      if (wrapperURLElement != null) {
        ad.nextWrapperURL = this.parseNodeText(this.childByName(wrapperURLElement, "URL"));
      }
    }
    wrapperCreativeElement = null;
    ref = ad.creatives;
    for (i = 0, len = ref.length; i < len; i++) {
      creative = ref[i];
      if (creative.type === 'linear') {
        wrapperCreativeElement = creative;
        break;
      }
    }
    if (wrapperCreativeElement != null) {
      if (wrapperCreativeElement.trackingEvents != null) {
        ad.trackingEvents = wrapperCreativeElement.trackingEvents;
      }
      if (wrapperCreativeElement.videoClickTrackingURLTemplates != null) {
        ad.videoClickTrackingURLTemplates = wrapperCreativeElement.videoClickTrackingURLTemplates;
      }
    }
    if (ad.nextWrapperURL != null) {
      return ad;
    }
  };

  VASTParser.parseInLineElement = function(inLineElement) {
    var ad, creative, creativeElement, creativeTypeElement, extensionElement, i, j, k, l, len, len1, len2, len3, node, ref, ref1, ref2, ref3;
    ad = new VASTAd();
    ad.id = inLineElement.id;
    ref = inLineElement.childNodes;
    for (i = 0, len = ref.length; i < len; i++) {
      node = ref[i];
      switch (node.nodeName) {
        case "AdTitle":
          ad.adTitle = this.parseNodeText(node);
          break;
        case "AdSystem":
          ad.adSystem = this.parseNodeText(node);
          break;
        case "Description":
          ad.description = this.parseNodeText(node);
          break;
        case "Advertiser":
          ad.advertiser = this.parseNodeText(node);
          break;
        case "Extensions":
          ref1 = node.childNodes;
          for (j = 0, len1 = ref1.length; j < len1; j++) {
            extensionElement = ref1[j];
            if (extensionElement.nodeType !== 3) {
              ad.extensions[extensionElement.nodeName] = this.parseNodeText(extensionElement);
            }
          }
          break;
        case "Error":
          ad.errorURLTemplates.push(this.parseNodeText(node));
          break;
        case "Impression":
          ad.impressionURLTemplates.push(this.parseNodeText(node));
          break;
        case "Creatives":
          ref2 = this.childsByName(node, "Creative");
          for (k = 0, len2 = ref2.length; k < len2; k++) {
            creativeElement = ref2[k];
            ref3 = creativeElement.childNodes;
            for (l = 0, len3 = ref3.length; l < len3; l++) {
              creativeTypeElement = ref3[l];
              switch (creativeTypeElement.nodeName) {
                case "Linear":
                  creative = this.parseCreativeLinearElement(creativeTypeElement);
                  if (creative) {
                    ad.creatives.push(creative);
                  }
                  break;
                case "NonLinearAds":
                  creative = this.parseCreativeNonLinearElement(creativeTypeElement);
                  if (creative) {
                    ad.creatives.push(creative);
                  }
                  break;
                case "CompanionAds":
                  creative = this.parseCompanionAd(creativeTypeElement);
                  if (creative) {
                    ad.creatives.push(creative);
                  }
              }
            }
          }
      }
    }
    return ad;
  };

  VASTParser.parseCreativeLinearElement = function(creativeElement) {
    var adParamsElement, base, clickTrackingElement, creative, customClickElement, eventName, i, j, k, l, len, len1, len2, len3, len4, len5, m, maintainAspectRatio, mediaFile, mediaFileElement, mediaFilesElement, n, offset, percent, ref, ref1, ref2, ref3, ref4, ref5, scalable, skipOffset, trackingElement, trackingEventsElement, trackingURLTemplate, videoClicksElement;
    creative = new VASTCreativeLinear();
    creative.duration = this.parseDuration(this.parseNodeText(this.childByName(creativeElement, "Duration")));
    if (creative.duration === -1 && creativeElement.parentNode.parentNode.parentNode.nodeName !== 'Wrapper') {
      return null;
    }
    skipOffset = creativeElement.getAttribute("skipoffset");
    if (skipOffset == null) {
      creative.skipDelay = null;
    } else if (skipOffset.charAt(skipOffset.length - 1) === "%") {
      percent = parseInt(skipOffset, 10);
      creative.skipDelay = creative.duration * (percent / 100);
    } else {
      creative.skipDelay = this.parseDuration(skipOffset);
    }
    videoClicksElement = this.childByName(creativeElement, "VideoClicks");
    if (videoClicksElement != null) {
      creative.videoClickThroughURLTemplate = this.parseNodeText(this.childByName(videoClicksElement, "ClickThrough"));
      ref = this.childsByName(videoClicksElement, "ClickTracking");
      for (i = 0, len = ref.length; i < len; i++) {
        clickTrackingElement = ref[i];
        creative.videoClickTrackingURLTemplates.push(this.parseNodeText(clickTrackingElement));
      }
      ref1 = this.childsByName(videoClicksElement, "CustomClick");
      for (j = 0, len1 = ref1.length; j < len1; j++) {
        customClickElement = ref1[j];
        creative.videoCustomClickURLTemplates.push(this.parseNodeText(customClickElement));
      }
    }
    adParamsElement = this.childByName(creativeElement, "AdParameters");
    if (adParamsElement != null) {
      creative.adParameters = this.parseNodeText(adParamsElement);
    }
    ref2 = this.childsByName(creativeElement, "TrackingEvents");
    for (k = 0, len2 = ref2.length; k < len2; k++) {
      trackingEventsElement = ref2[k];
      ref3 = this.childsByName(trackingEventsElement, "Tracking");
      for (l = 0, len3 = ref3.length; l < len3; l++) {
        trackingElement = ref3[l];
        eventName = trackingElement.getAttribute("event");
        trackingURLTemplate = this.parseNodeText(trackingElement);
        if ((eventName != null) && (trackingURLTemplate != null)) {
          if (eventName === "progress") {
            offset = trackingElement.getAttribute("offset");
            if (!offset) {
              continue;
            }
            if (offset.charAt(offset.length - 1) === '%') {
              eventName = "progress-" + offset;
            } else {
              eventName = "progress-" + (Math.round(this.parseDuration(offset)));
            }
          }
          if ((base = creative.trackingEvents)[eventName] == null) {
            base[eventName] = [];
          }
          creative.trackingEvents[eventName].push(trackingURLTemplate);
        }
      }
    }
    ref4 = this.childsByName(creativeElement, "MediaFiles");
    for (m = 0, len4 = ref4.length; m < len4; m++) {
      mediaFilesElement = ref4[m];
      ref5 = this.childsByName(mediaFilesElement, "MediaFile");
      for (n = 0, len5 = ref5.length; n < len5; n++) {
        mediaFileElement = ref5[n];
        mediaFile = new VASTMediaFile();
        mediaFile.id = mediaFileElement.getAttribute("id");
        mediaFile.fileURL = this.parseNodeText(mediaFileElement);
        mediaFile.deliveryType = mediaFileElement.getAttribute("delivery");
        mediaFile.codec = mediaFileElement.getAttribute("codec");
        mediaFile.mimeType = mediaFileElement.getAttribute("type");
        mediaFile.apiFramework = mediaFileElement.getAttribute("apiFramework");
        mediaFile.bitrate = parseInt(mediaFileElement.getAttribute("bitrate") || 0);
        mediaFile.minBitrate = parseInt(mediaFileElement.getAttribute("minBitrate") || 0);
        mediaFile.maxBitrate = parseInt(mediaFileElement.getAttribute("maxBitrate") || 0);
        mediaFile.width = parseInt(mediaFileElement.getAttribute("width") || 0);
        mediaFile.height = parseInt(mediaFileElement.getAttribute("height") || 0);
        scalable = mediaFileElement.getAttribute("scalable");
        if (scalable && typeof scalable === "string") {
          scalable = scalable.toLowerCase();
          if (scalable === "true") {
            mediaFile.scalable = true;
          } else if (scalable === "false") {
            mediaFile.scalable = false;
          }
        }
        maintainAspectRatio = mediaFileElement.getAttribute("maintainAspectRatio");
        if (maintainAspectRatio && typeof maintainAspectRatio === "string") {
          maintainAspectRatio = maintainAspectRatio.toLowerCase();
          if (maintainAspectRatio === "true") {
            mediaFile.maintainAspectRatio = true;
          } else if (maintainAspectRatio === "false") {
            mediaFile.maintainAspectRatio = false;
          }
        }
        creative.mediaFiles.push(mediaFile);
      }
    }
    return creative;
  };

  VASTParser.parseCreativeNonLinearElement = function(creativeElement) {
    var base, clickTrackingElement, creative, eventName, htmlElement, i, iframeElement, j, k, l, len, len1, len2, len3, len4, len5, len6, m, n, nonLinearAd, nonLinearResource, o, ref, ref1, ref2, ref3, ref4, ref5, ref6, staticElement, trackingElement, trackingEventsElement, trackingURLTemplate;
    creative = new VASTCreativeNonLinear();
    ref = this.childsByName(creativeElement, "NonLinear");
    for (i = 0, len = ref.length; i < len; i++) {
      nonLinearResource = ref[i];
      nonLinearAd = new VASTNonLinearAd();
      nonLinearAd.id = nonLinearResource.getAttribute("id") || null;
      nonLinearAd.width = nonLinearResource.getAttribute("width");
      nonLinearAd.height = nonLinearResource.getAttribute("height");
      nonLinearAd.expandedWidth = nonLinearResource.getAttribute("expandedWidth") || null;
      nonLinearAd.expandedHeight = nonLinearResource.getAttribute("expandedHeight") || null;
      nonLinearAd.minSuggestedDuration = nonLinearResource.getAttribute("minSuggestedDuration") || null;
      ref1 = this.childsByName(nonLinearResource, "HTMLResource");
      for (j = 0, len1 = ref1.length; j < len1; j++) {
        htmlElement = ref1[j];
        nonLinearAd.type = htmlElement.getAttribute("creativeType") || 'text/html';
        nonLinearAd.htmlResource = this.parseNodeText(htmlElement);
      }
      ref2 = this.childsByName(nonLinearResource, "IFrameResource");
      for (k = 0, len2 = ref2.length; k < len2; k++) {
        iframeElement = ref2[k];
        nonLinearAd.type = iframeElement.getAttribute("creativeType") || 0;
        nonLinearAd.iframeResource = this.parseNodeText(iframeElement);
      }
      ref3 = this.childsByName(nonLinearResource, "StaticResource");
      for (l = 0, len3 = ref3.length; l < len3; l++) {
        staticElement = ref3[l];
        nonLinearAd.type = staticElement.getAttribute("creativeType") || 0;
        nonLinearAd.staticResource = this.parseNodeText(staticElement);
      }
      nonLinearAd.nonLinearClickThroughURLTemplate = this.parseNodeText(this.childByName(nonLinearResource, "NonLinearClickThrough"));
      ref4 = this.childsByName(nonLinearResource, "NonLinearClickTracking");
      for (m = 0, len4 = ref4.length; m < len4; m++) {
        clickTrackingElement = ref4[m];
        nonLinearAd.nonLinearClickTrackingURLTemplates.push(this.parseNodeText(clickTrackingElement));
      }
      ref5 = this.childsByName(creativeElement, "TrackingEvents");
      for (n = 0, len5 = ref5.length; n < len5; n++) {
        trackingEventsElement = ref5[n];
        ref6 = this.childsByName(trackingEventsElement, "Tracking");
        for (o = 0, len6 = ref6.length; o < len6; o++) {
          trackingElement = ref6[o];
          eventName = trackingElement.getAttribute("event");
          trackingURLTemplate = this.parseNodeText(trackingElement);
          if ((eventName != null) && (trackingURLTemplate != null)) {
            if ((base = nonLinearAd.trackingEvents)[eventName] == null) {
              base[eventName] = [];
            }
            nonLinearAd.trackingEvents[eventName].push(trackingURLTemplate);
          }
        }
      }
      creative.variations.push(nonLinearAd);
    }
    return creative;
  };

  VASTParser.parseCompanionAd = function(creativeElement) {
    var adParamsElement, base, clickTrackingElement, companionAd, companionResource, creative, eventName, htmlElement, i, iframeElement, j, k, l, len, len1, len2, len3, len4, len5, len6, m, n, o, ref, ref1, ref2, ref3, ref4, ref5, ref6, staticElement, trackingElement, trackingEventsElement, trackingURLTemplate;
    creative = new VASTCreativeCompanion();
    ref = this.childsByName(creativeElement, "Companion");
    for (i = 0, len = ref.length; i < len; i++) {
      companionResource = ref[i];
      companionAd = new VASTCompanionAd();
      companionAd.id = companionResource.getAttribute("id") || null;
      companionAd.width = companionResource.getAttribute("width");
      companionAd.height = companionResource.getAttribute("height");
      companionAd.assetWidth = companionResource.getAttribute("assetWidth");
      companionAd.assetHeight = companionResource.getAttribute("assetHeight");
      ref1 = this.childsByName(companionResource, "HTMLResource");
      for (j = 0, len1 = ref1.length; j < len1; j++) {
        htmlElement = ref1[j];
        companionAd.type = htmlElement.getAttribute("creativeType") || 'text/html';
        companionAd.htmlResource = this.parseNodeText(htmlElement);
      }
      ref2 = this.childsByName(companionResource, "IFrameResource");
      for (k = 0, len2 = ref2.length; k < len2; k++) {
        iframeElement = ref2[k];
        companionAd.type = iframeElement.getAttribute("creativeType") || 0;
        companionAd.iframeResource = this.parseNodeText(iframeElement);
      }
      ref3 = this.childsByName(companionResource, "StaticResource");
      for (l = 0, len3 = ref3.length; l < len3; l++) {
        staticElement = ref3[l];
        companionAd.type = staticElement.getAttribute("creativeType") || 0;
        companionAd.staticResource = this.parseNodeText(staticElement);
      }
      ref4 = this.childsByName(companionResource, "TrackingEvents");
      for (m = 0, len4 = ref4.length; m < len4; m++) {
        trackingEventsElement = ref4[m];
        ref5 = this.childsByName(trackingEventsElement, "Tracking");
        for (n = 0, len5 = ref5.length; n < len5; n++) {
          trackingElement = ref5[n];
          eventName = trackingElement.getAttribute("event");
          trackingURLTemplate = this.parseNodeText(trackingElement);
          if ((eventName != null) && (trackingURLTemplate != null)) {
            if ((base = companionAd.trackingEvents)[eventName] == null) {
              base[eventName] = [];
            }
            companionAd.trackingEvents[eventName].push(trackingURLTemplate);
          }
        }
      }
      companionAd.companionClickThroughURLTemplate = this.parseNodeText(this.childByName(companionResource, "CompanionClickThrough"));
      ref6 = this.childsByName(companionResource, "CompanionClickTracking");
      for (o = 0, len6 = ref6.length; o < len6; o++) {
        clickTrackingElement = ref6[o];
        companionAd.companionClickTrackingURLTemplates.push(this.parseNodeText(clickTrackingElement));
      }
      adParamsElement = this.childByName(companionResource, "AdParameters");
      if (adParamsElement != null) {
        companionAd.adParameters = this.parseNodeText(adParamsElement);
      }
      creative.variations.push(companionAd);
    }
    return creative;
  };

  VASTParser.parseDuration = function(durationString) {
    var durationComponents, hours, minutes, seconds, secondsAndMS;
    if (!(durationString != null)) {
      return -1;
    }
    durationComponents = durationString.split(":");
    if (durationComponents.length !== 3) {
      return -1;
    }
    secondsAndMS = durationComponents[2].split(".");
    seconds = parseInt(secondsAndMS[0]);
    if (secondsAndMS.length === 2) {
      seconds += parseFloat("0." + secondsAndMS[1]);
    }
    minutes = parseInt(durationComponents[1] * 60);
    hours = parseInt(durationComponents[0] * 60 * 60);
    if (isNaN(hours || isNaN(minutes || isNaN(seconds || minutes > 60 * 60 || seconds > 60)))) {
      return -1;
    }
    return hours + minutes + seconds;
  };

  VASTParser.parseNodeText = function(node) {
    return node && (node.textContent || node.text || '').trim();
  };

  return VASTParser;

})();

module.exports = VASTParser;


},{"./ad.coffee":2,"./companionad.coffee":4,"./creative.coffee":5,"./mediafile.coffee":7,"./nonlinearad.coffee":8,"./response.coffee":10,"./urlhandler.coffee":12,"./util.coffee":15,"events":1}],10:[function(_dereq_,module,exports){
var VASTResponse;

VASTResponse = (function() {
  function VASTResponse() {
    this.ads = [];
    this.errorURLTemplates = [];
  }

  return VASTResponse;

})();

module.exports = VASTResponse;


},{}],11:[function(_dereq_,module,exports){
var EventEmitter, VASTClient, VASTCreativeCompanion, VASTCreativeLinear, VASTCreativeNonLinear, VASTTracker, VASTUtil,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

VASTClient = _dereq_('./client.coffee');

VASTUtil = _dereq_('./util.coffee');

VASTCreativeLinear = _dereq_('./creative.coffee').VASTCreativeLinear;

VASTCreativeNonLinear = _dereq_('./creative.coffee').VASTCreativeNonLinear;

VASTCreativeCompanion = _dereq_('./creative.coffee').VASTCreativeCompanion;

EventEmitter = _dereq_('events').EventEmitter;

VASTTracker = (function(superClass) {
  extend(VASTTracker, superClass);

  function VASTTracker(ad, creative) {
    var eventName, events, ref, ref1, ref2;
    this.ad = ad;
    this.creative = creative;
    this.muted = false;
    this.impressed = false;
    this.skipable = false;
    this.skipDelayDefault = -1;
    this.trackingEvents = {};
    this.emitAlwaysEvents = ['creativeView', 'start', 'firstQuartile', 'midpoint', 'thirdQuartile', 'complete', 'resume', 'pause', 'rewind', 'skip', 'closeLinear', 'close'];
    ref = this.creative.trackingEvents;
    for (eventName in ref) {
      events = ref[eventName];
      this.trackingEvents[eventName] = events.slice(0);
    }
    if (this.creative instanceof VASTCreativeLinear) {
      this.setDuration(this.creative.duration);
      this.skipDelay = this.creative.skipDelay;
      this.linear = true;
      this.clickThroughURLTemplate = this.creative.videoClickThroughURLTemplate;
      this.clickTrackingURLTemplates = this.creative.videoClickTrackingURLTemplates;
    } else {
      this.skipDelay = -1;
      this.linear = false;
      this.clickThroughURLTemplate = (ref1 = this.creative.nonLinearClickThroughURLTemplate) != null ? ref1 : this.creative.companionClickThroughURLTemplate;
      this.clickTrackingURLTemplates = (ref2 = this.creative.nonLinearClickTrackingURLTemplates) != null ? ref2 : this.creative.companionClickTrackingURLTemplates;
    }
    this.on('start', function() {
      VASTClient.lastSuccessfullAd = +new Date();
    });
  }

  VASTTracker.prototype.setDuration = function(duration) {
    this.assetDuration = duration;
    return this.quartiles = {
      'firstQuartile': Math.round(25 * this.assetDuration) / 100,
      'midpoint': Math.round(50 * this.assetDuration) / 100,
      'thirdQuartile': Math.round(75 * this.assetDuration) / 100
    };
  };

  VASTTracker.prototype.setProgress = function(progress) {
    var eventName, events, i, len, percent, quartile, ref, skipDelay, time;
    skipDelay = this.skipDelay === null ? this.skipDelayDefault : this.skipDelay;
    if (skipDelay !== -1 && !this.skipable) {
      if (skipDelay > progress) {
        this.emit('skip-countdown', skipDelay - progress);
      } else {
        this.skipable = true;
        this.emit('skip-countdown', 0);
      }
    }
    if (this.linear && this.assetDuration > 0) {
      events = [];
      if (progress > 0) {
        events.push("start");
        percent = Math.round(progress / this.assetDuration * 100);
        events.push("progress-" + percent + "%");
        events.push("progress-" + (Math.round(progress)));
        ref = this.quartiles;
        for (quartile in ref) {
          time = ref[quartile];
          if ((time <= progress && progress <= (time + 1))) {
            events.push(quartile);
          }
        }
      }
      for (i = 0, len = events.length; i < len; i++) {
        eventName = events[i];
        this.track(eventName, true);
      }
      if (progress < this.progress) {
        this.track("rewind");
      }
    }
    return this.progress = progress;
  };

  VASTTracker.prototype.setMuted = function(muted) {
    if (this.muted !== muted) {
      this.track(muted ? "mute" : "unmute");
    }
    return this.muted = muted;
  };

  VASTTracker.prototype.setPaused = function(paused) {
    if (this.paused !== paused) {
      this.track(paused ? "pause" : "resume");
    }
    return this.paused = paused;
  };

  VASTTracker.prototype.setFullscreen = function(fullscreen) {
    if (this.fullscreen !== fullscreen) {
      this.track(fullscreen ? "fullscreen" : "exitFullscreen");
    }
    return this.fullscreen = fullscreen;
  };

  VASTTracker.prototype.setSkipDelay = function(duration) {
    if (typeof duration === 'number') {
      return this.skipDelay = duration;
    }
  };

  VASTTracker.prototype.load = function() {
    if (!this.impressed) {
      this.impressed = true;
      this.trackURLs(this.ad.impressionURLTemplates);
      return this.track("creativeView");
    }
  };

  VASTTracker.prototype.errorWithCode = function(errorCode) {
    return this.trackURLs(this.ad.errorURLTemplates, {
      ERRORCODE: errorCode
    });
  };

  VASTTracker.prototype.complete = function() {
    return this.track("complete");
  };

  VASTTracker.prototype.close = function() {
    return this.track(this.linear ? "closeLinear" : "close");
  };

  VASTTracker.prototype.stop = function() {};

  VASTTracker.prototype.skip = function() {
    this.track("skip");
    return this.trackingEvents = [];
  };

  VASTTracker.prototype.click = function() {
    var clickThroughURL, ref, variables;
    if ((ref = this.clickTrackingURLTemplates) != null ? ref.length : void 0) {
      this.trackURLs(this.clickTrackingURLTemplates);
    }
    if (this.clickThroughURLTemplate != null) {
      if (this.linear) {
        variables = {
          CONTENTPLAYHEAD: this.progressFormated()
        };
      }
      clickThroughURL = VASTUtil.resolveURLTemplates([this.clickThroughURLTemplate], variables)[0];
      return this.emit("clickthrough", clickThroughURL);
    }
  };

  VASTTracker.prototype.track = function(eventName, once) {
    var idx, trackingURLTemplates;
    if (once == null) {
      once = false;
    }
    if (eventName === 'closeLinear' && ((this.trackingEvents[eventName] == null) && (this.trackingEvents['close'] != null))) {
      eventName = 'close';
    }
    trackingURLTemplates = this.trackingEvents[eventName];
    idx = this.emitAlwaysEvents.indexOf(eventName);
    if (trackingURLTemplates != null) {
      this.emit(eventName, '');
      this.trackURLs(trackingURLTemplates);
    } else if (idx !== -1) {
      this.emit(eventName, '');
    }
    if (once === true) {
      delete this.trackingEvents[eventName];
      if (idx > -1) {
        this.emitAlwaysEvents.splice(idx, 1);
      }
    }
  };

  VASTTracker.prototype.trackURLs = function(URLTemplates, variables) {
    if (variables == null) {
      variables = {};
    }
    if (this.linear) {
      variables["CONTENTPLAYHEAD"] = this.progressFormated();
    }
    return VASTUtil.track(URLTemplates, variables);
  };

  VASTTracker.prototype.progressFormated = function() {
    var h, m, ms, s, seconds;
    seconds = parseInt(this.progress);
    h = seconds / (60 * 60);
    if (h.length < 2) {
      h = "0" + h;
    }
    m = seconds / 60 % 60;
    if (m.length < 2) {
      m = "0" + m;
    }
    s = seconds % 60;
    if (s.length < 2) {
      s = "0" + m;
    }
    ms = parseInt((this.progress - seconds) * 100);
    return h + ":" + m + ":" + s + "." + ms;
  };

  return VASTTracker;

})(EventEmitter);

module.exports = VASTTracker;


},{"./client.coffee":3,"./creative.coffee":5,"./util.coffee":15,"events":1}],12:[function(_dereq_,module,exports){
var URLHandler, flash, xhr;

xhr = _dereq_('./urlhandlers/xmlhttprequest.coffee');

flash = _dereq_('./urlhandlers/flash.coffee');

URLHandler = (function() {
  function URLHandler() {}

  URLHandler.get = function(url, options, cb) {
    if (!cb) {
      if (typeof options === 'function') {
        cb = options;
      }
      options = {};
    }
    if (options.urlhandler && options.urlhandler.supported()) {
      return options.urlhandler.get(url, options, cb);
    } else if (typeof window === "undefined" || window === null) {
      return _dereq_('./urlhandlers/' + 'node').get(url, options, cb);
    } else if (xhr.supported()) {
      return xhr.get(url, options, cb);
    } else if (flash.supported()) {
      return flash.get(url, options, cb);
    } else {
      return cb();
    }
  };

  return URLHandler;

})();

module.exports = URLHandler;


},{"./urlhandlers/flash.coffee":13,"./urlhandlers/xmlhttprequest.coffee":14}],13:[function(_dereq_,module,exports){
var FlashURLHandler;

FlashURLHandler = (function() {
  function FlashURLHandler() {}

  FlashURLHandler.xdr = function() {
    var xdr;
    if (window.XDomainRequest) {
      xdr = new XDomainRequest();
    }
    return xdr;
  };

  FlashURLHandler.supported = function() {
    return !!this.xdr();
  };

  FlashURLHandler.get = function(url, options, cb) {
    var xdr, xmlDocument;
    if (xmlDocument = typeof window.ActiveXObject === "function" ? new window.ActiveXObject("Microsoft.XMLDOM") : void 0) {
      xmlDocument.async = false;
    } else {
      return cb();
    }
    xdr = this.xdr();
    xdr.open('GET', url);
    xdr.timeout = options.timeout || 0;
    xdr.withCredentials = options.withCredentials || false;
    xdr.send();
    xdr.onprogress = function() {};
    return xdr.onload = function() {
      xmlDocument.loadXML(xdr.responseText);
      return cb(null, xmlDocument);
    };
  };

  return FlashURLHandler;

})();

module.exports = FlashURLHandler;


},{}],14:[function(_dereq_,module,exports){
var XHRURLHandler;

XHRURLHandler = (function() {
  function XHRURLHandler() {}

  XHRURLHandler.xhr = function() {
    var xhr;
    xhr = new window.XMLHttpRequest();
    if ('withCredentials' in xhr) {
      return xhr;
    }
  };

  XHRURLHandler.supported = function() {
    return !!this.xhr();
  };

  XHRURLHandler.get = function(url, options, cb) {
    var error, xhr;
    if (window.location.protocol === 'https:' && url.indexOf('http://') === 0) {
      return cb(new Error('Cannot go from HTTPS to HTTP.'));
    }
    try {
      xhr = this.xhr();
      xhr.open('GET', url);
      xhr.timeout = options.timeout || 0;
      xhr.withCredentials = options.withCredentials || false;
      xhr.send();
      return xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          return cb(null, xhr.responseXML);
        }
      };
    } catch (error) {
      return cb();
    }
  };

  return XHRURLHandler;

})();

module.exports = XHRURLHandler;


},{}],15:[function(_dereq_,module,exports){
var VASTUtil;

VASTUtil = (function() {
  function VASTUtil() {}

  VASTUtil.track = function(URLTemplates, variables) {
    var URL, URLs, i, j, len, results;
    URLs = this.resolveURLTemplates(URLTemplates, variables);
    results = [];
    for (j = 0, len = URLs.length; j < len; j++) {
      URL = URLs[j];
      if (typeof window !== "undefined" && window !== null) {
        i = new Image();
        results.push(i.src = URL);
      } else {

      }
    }
    return results;
  };

  VASTUtil.resolveURLTemplates = function(URLTemplates, variables) {
    var URLTemplate, URLs, j, key, len, macro1, macro2, resolveURL, value;
    URLs = [];
    if (variables == null) {
      variables = {};
    }
    if (!("CACHEBUSTING" in variables)) {
      variables["CACHEBUSTING"] = Math.round(Math.random() * 1.0e+10);
    }
    variables["random"] = variables["CACHEBUSTING"];
    for (j = 0, len = URLTemplates.length; j < len; j++) {
      URLTemplate = URLTemplates[j];
      resolveURL = URLTemplate;
      if (!resolveURL) {
        continue;
      }
      for (key in variables) {
        value = variables[key];
        macro1 = "[" + key + "]";
        macro2 = "%%" + key + "%%";
        resolveURL = resolveURL.replace(macro1, value);
        resolveURL = resolveURL.replace(macro2, value);
      }
      URLs.push(resolveURL);
    }
    return URLs;
  };

  VASTUtil.storage = (function() {
    var data, error, isDisabled, storage, storageError;
    try {
      storage = typeof window !== "undefined" && window !== null ? window.localStorage || window.sessionStorage : null;
    } catch (error) {
      storageError = error;
      storage = null;
    }
    isDisabled = function(store) {
      var e, error1, testValue;
      try {
        testValue = '__VASTUtil__';
        store.setItem(testValue, testValue);
        if (store.getItem(testValue) !== testValue) {
          return true;
        }
      } catch (error1) {
        e = error1;
        return true;
      }
      return false;
    };
    if ((storage == null) || isDisabled(storage)) {
      data = {};
      storage = {
        length: 0,
        getItem: function(key) {
          return data[key];
        },
        setItem: function(key, value) {
          data[key] = value;
          this.length = Object.keys(data).length;
        },
        removeItem: function(key) {
          delete data[key];
          this.length = Object.keys(data).length;
        },
        clear: function() {
          data = {};
          this.length = 0;
        }
      };
    }
    return storage;
  })();

  return VASTUtil;

})();

module.exports = VASTUtil;


},{}]},{},[6])
(6)
});