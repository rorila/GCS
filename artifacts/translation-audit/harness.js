(() => {
  // node_modules/dompurify/dist/purify.es.mjs
  function _arrayLikeToArray(r, a) {
    (null == a || a > r.length) && (a = r.length);
    for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
    return n;
  }
  function _arrayWithHoles(r) {
    if (Array.isArray(r)) return r;
  }
  function _iterableToArrayLimit(r, l) {
    var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
    if (null != t) {
      var e, n, i, u, a = [], f = true, o = false;
      try {
        if (i = (t = t.call(r)).next, 0 === l) ;
        else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = true) ;
      } catch (r2) {
        o = true, n = r2;
      } finally {
        try {
          if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
        } finally {
          if (o) throw n;
        }
      }
      return a;
    }
  }
  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  function _slicedToArray(r, e) {
    return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
  }
  function _unsupportedIterableToArray(r, a) {
    if (r) {
      if ("string" == typeof r) return _arrayLikeToArray(r, a);
      var t = {}.toString.call(r).slice(8, -1);
      return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
    }
  }
  var entries = Object.entries;
  var setPrototypeOf = Object.setPrototypeOf;
  var isFrozen = Object.isFrozen;
  var getPrototypeOf = Object.getPrototypeOf;
  var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  var freeze = Object.freeze;
  var seal = Object.seal;
  var create = Object.create;
  var _ref = typeof Reflect !== "undefined" && Reflect;
  var apply = _ref.apply;
  var construct = _ref.construct;
  if (!freeze) {
    freeze = function freeze2(x) {
      return x;
    };
  }
  if (!seal) {
    seal = function seal2(x) {
      return x;
    };
  }
  if (!apply) {
    apply = function apply2(func, thisArg) {
      for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        args[_key - 2] = arguments[_key];
      }
      return func.apply(thisArg, args);
    };
  }
  if (!construct) {
    construct = function construct2(Func) {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }
      return new Func(...args);
    };
  }
  var arrayForEach = unapply(Array.prototype.forEach);
  var arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
  var arrayPop = unapply(Array.prototype.pop);
  var arrayPush = unapply(Array.prototype.push);
  var arraySplice = unapply(Array.prototype.splice);
  var arrayIsArray = Array.isArray;
  var stringToLowerCase = unapply(String.prototype.toLowerCase);
  var stringToString = unapply(String.prototype.toString);
  var stringMatch = unapply(String.prototype.match);
  var stringReplace = unapply(String.prototype.replace);
  var stringIndexOf = unapply(String.prototype.indexOf);
  var stringTrim = unapply(String.prototype.trim);
  var numberToString = unapply(Number.prototype.toString);
  var booleanToString = unapply(Boolean.prototype.toString);
  var bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
  var symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
  var objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
  var objectToString = unapply(Object.prototype.toString);
  var regExpTest = unapply(RegExp.prototype.test);
  var typeErrorCreate = unconstruct(TypeError);
  function unapply(func) {
    return function(thisArg) {
      if (thisArg instanceof RegExp) {
        thisArg.lastIndex = 0;
      }
      for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        args[_key3 - 1] = arguments[_key3];
      }
      return apply(func, thisArg, args);
    };
  }
  function unconstruct(Func) {
    return function() {
      for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        args[_key4] = arguments[_key4];
      }
      return construct(Func, args);
    };
  }
  function addToSet(set, array) {
    let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
    if (setPrototypeOf) {
      setPrototypeOf(set, null);
    }
    if (!arrayIsArray(array)) {
      return set;
    }
    let l = array.length;
    while (l--) {
      let element = array[l];
      if (typeof element === "string") {
        const lcElement = transformCaseFunc(element);
        if (lcElement !== element) {
          if (!isFrozen(array)) {
            array[l] = lcElement;
          }
          element = lcElement;
        }
      }
      set[element] = true;
    }
    return set;
  }
  function cleanArray(array) {
    for (let index = 0; index < array.length; index++) {
      const isPropertyExist = objectHasOwnProperty(array, index);
      if (!isPropertyExist) {
        array[index] = null;
      }
    }
    return array;
  }
  function clone(object) {
    const newObject = create(null);
    for (const _ref2 of entries(object)) {
      var _ref3 = _slicedToArray(_ref2, 2);
      const property = _ref3[0];
      const value = _ref3[1];
      const isPropertyExist = objectHasOwnProperty(object, property);
      if (isPropertyExist) {
        if (arrayIsArray(value)) {
          newObject[property] = cleanArray(value);
        } else if (value && typeof value === "object" && value.constructor === Object) {
          newObject[property] = clone(value);
        } else {
          newObject[property] = value;
        }
      }
    }
    return newObject;
  }
  function stringifyValue(value) {
    switch (typeof value) {
      case "string": {
        return value;
      }
      case "number": {
        return numberToString(value);
      }
      case "boolean": {
        return booleanToString(value);
      }
      case "bigint": {
        return bigintToString ? bigintToString(value) : "0";
      }
      case "symbol": {
        return symbolToString ? symbolToString(value) : "Symbol()";
      }
      case "undefined": {
        return objectToString(value);
      }
      case "function":
      case "object": {
        if (value === null) {
          return objectToString(value);
        }
        const valueAsRecord = value;
        const valueToString = lookupGetter(valueAsRecord, "toString");
        if (typeof valueToString === "function") {
          const stringified = valueToString(valueAsRecord);
          return typeof stringified === "string" ? stringified : objectToString(stringified);
        }
        return objectToString(value);
      }
      default: {
        return objectToString(value);
      }
    }
  }
  function lookupGetter(object, prop) {
    while (object !== null) {
      const desc = getOwnPropertyDescriptor(object, prop);
      if (desc) {
        if (desc.get) {
          return unapply(desc.get);
        }
        if (typeof desc.value === "function") {
          return unapply(desc.value);
        }
      }
      object = getPrototypeOf(object);
    }
    function fallbackValue() {
      return null;
    }
    return fallbackValue;
  }
  function isRegex(value) {
    try {
      regExpTest(value, "");
      return true;
    } catch (_unused) {
      return false;
    }
  }
  var html$1 = freeze(["a", "abbr", "acronym", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "element", "em", "fieldset", "figcaption", "figure", "font", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "marquee", "menu", "menuitem", "meter", "nav", "nobr", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "search", "section", "select", "shadow", "slot", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"]);
  var svg$1 = freeze(["svg", "a", "altglyph", "altglyphdef", "altglyphitem", "animatecolor", "animatemotion", "animatetransform", "circle", "clippath", "defs", "desc", "ellipse", "enterkeyhint", "exportparts", "filter", "font", "g", "glyph", "glyphref", "hkern", "image", "inputmode", "line", "lineargradient", "marker", "mask", "metadata", "mpath", "part", "path", "pattern", "polygon", "polyline", "radialgradient", "rect", "stop", "style", "switch", "symbol", "text", "textpath", "title", "tref", "tspan", "view", "vkern"]);
  var svgFilters = freeze(["feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence"]);
  var svgDisallowed = freeze(["animate", "color-profile", "cursor", "discard", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "foreignobject", "hatch", "hatchpath", "mesh", "meshgradient", "meshpatch", "meshrow", "missing-glyph", "script", "set", "solidcolor", "unknown", "use"]);
  var mathMl$1 = freeze(["math", "menclose", "merror", "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mmultiscripts", "mn", "mo", "mover", "mpadded", "mphantom", "mroot", "mrow", "ms", "mspace", "msqrt", "mstyle", "msub", "msup", "msubsup", "mtable", "mtd", "mtext", "mtr", "munder", "munderover", "mprescripts"]);
  var mathMlDisallowed = freeze(["maction", "maligngroup", "malignmark", "mlongdiv", "mscarries", "mscarry", "msgroup", "mstack", "msline", "msrow", "semantics", "annotation", "annotation-xml", "mprescripts", "none"]);
  var text = freeze(["#text"]);
  var html = freeze(["accept", "action", "align", "alt", "autocapitalize", "autocomplete", "autopictureinpicture", "autoplay", "background", "bgcolor", "border", "capture", "cellpadding", "cellspacing", "checked", "cite", "class", "clear", "color", "cols", "colspan", "command", "commandfor", "controls", "controlslist", "coords", "crossorigin", "datetime", "decoding", "default", "dir", "disabled", "disablepictureinpicture", "disableremoteplayback", "download", "draggable", "enctype", "enterkeyhint", "exportparts", "face", "for", "headers", "height", "hidden", "high", "href", "hreflang", "id", "inert", "inputmode", "integrity", "ismap", "kind", "label", "lang", "list", "loading", "loop", "low", "max", "maxlength", "media", "method", "min", "minlength", "multiple", "muted", "name", "nonce", "noshade", "novalidate", "nowrap", "open", "optimum", "part", "pattern", "placeholder", "playsinline", "popover", "popovertarget", "popovertargetaction", "poster", "preload", "pubdate", "radiogroup", "readonly", "rel", "required", "rev", "reversed", "role", "rows", "rowspan", "spellcheck", "scope", "selected", "shape", "size", "sizes", "slot", "span", "srclang", "start", "src", "srcset", "step", "style", "summary", "tabindex", "title", "translate", "type", "usemap", "valign", "value", "width", "wrap", "xmlns"]);
  var svg = freeze(["accent-height", "accumulate", "additive", "alignment-baseline", "amplitude", "ascent", "attributename", "attributetype", "azimuth", "basefrequency", "baseline-shift", "begin", "bias", "by", "class", "clip", "clippathunits", "clip-path", "clip-rule", "color", "color-interpolation", "color-interpolation-filters", "color-profile", "color-rendering", "cx", "cy", "d", "dx", "dy", "diffuseconstant", "direction", "display", "divisor", "dur", "edgemode", "elevation", "end", "exponent", "fill", "fill-opacity", "fill-rule", "filter", "filterunits", "flood-color", "flood-opacity", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "fx", "fy", "g1", "g2", "glyph-name", "glyphref", "gradientunits", "gradienttransform", "height", "href", "id", "image-rendering", "in", "in2", "intercept", "k", "k1", "k2", "k3", "k4", "kerning", "keypoints", "keysplines", "keytimes", "lang", "lengthadjust", "letter-spacing", "kernelmatrix", "kernelunitlength", "lighting-color", "local", "marker-end", "marker-mid", "marker-start", "markerheight", "markerunits", "markerwidth", "maskcontentunits", "maskunits", "max", "mask", "mask-type", "media", "method", "mode", "min", "name", "numoctaves", "offset", "operator", "opacity", "order", "orient", "orientation", "origin", "overflow", "paint-order", "path", "pathlength", "patterncontentunits", "patterntransform", "patternunits", "points", "preservealpha", "preserveaspectratio", "primitiveunits", "r", "rx", "ry", "radius", "refx", "refy", "repeatcount", "repeatdur", "restart", "result", "rotate", "scale", "seed", "shape-rendering", "slope", "specularconstant", "specularexponent", "spreadmethod", "startoffset", "stddeviation", "stitchtiles", "stop-color", "stop-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke", "stroke-width", "style", "surfacescale", "systemlanguage", "tabindex", "tablevalues", "targetx", "targety", "transform", "transform-origin", "text-anchor", "text-decoration", "text-rendering", "textlength", "type", "u1", "u2", "unicode", "values", "viewbox", "visibility", "version", "vert-adv-y", "vert-origin-x", "vert-origin-y", "width", "word-spacing", "wrap", "writing-mode", "xchannelselector", "ychannelselector", "x", "x1", "x2", "xmlns", "y", "y1", "y2", "z", "zoomandpan"]);
  var mathMl = freeze(["accent", "accentunder", "align", "bevelled", "close", "columnalign", "columnlines", "columnspacing", "columnspan", "denomalign", "depth", "dir", "display", "displaystyle", "encoding", "fence", "frame", "height", "href", "id", "largeop", "length", "linethickness", "lquote", "lspace", "mathbackground", "mathcolor", "mathsize", "mathvariant", "maxsize", "minsize", "movablelimits", "notation", "numalign", "open", "rowalign", "rowlines", "rowspacing", "rowspan", "rspace", "rquote", "scriptlevel", "scriptminsize", "scriptsizemultiplier", "selection", "separator", "separators", "stretchy", "subscriptshift", "supscriptshift", "symmetric", "voffset", "width", "xmlns"]);
  var xml = freeze(["xlink:href", "xml:id", "xlink:title", "xml:space", "xmlns:xlink"]);
  var MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
  var ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
  var TMPLIT_EXPR = seal(/\${[\w\W]*/g);
  var DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
  var ARIA_ATTR = seal(/^aria-[\-\w]+$/);
  var IS_ALLOWED_URI = seal(
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
    // eslint-disable-line no-useless-escape
  );
  var IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
  var ATTR_WHITESPACE = seal(
    /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g
    // eslint-disable-line no-control-regex
  );
  var DOCTYPE_NAME = seal(/^html$/i);
  var CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
  var NODE_TYPE = {
    element: 1,
    attribute: 2,
    text: 3,
    cdataSection: 4,
    entityReference: 5,
    // Deprecated
    entityNode: 6,
    // Deprecated
    progressingInstruction: 7,
    comment: 8,
    document: 9,
    documentType: 10,
    documentFragment: 11,
    notation: 12
    // Deprecated
  };
  var getGlobal = function getGlobal2() {
    return typeof window === "undefined" ? null : window;
  };
  var _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
    if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") {
      return null;
    }
    let suffix = null;
    const ATTR_NAME = "data-tt-policy-suffix";
    if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) {
      suffix = purifyHostElement.getAttribute(ATTR_NAME);
    }
    const policyName = "dompurify" + (suffix ? "#" + suffix : "");
    try {
      return trustedTypes.createPolicy(policyName, {
        createHTML(html2) {
          return html2;
        },
        createScriptURL(scriptUrl) {
          return scriptUrl;
        }
      });
    } catch (_) {
      console.warn("TrustedTypes policy " + policyName + " could not be created.");
      return null;
    }
  };
  var _createHooksMap = function _createHooksMap2() {
    return {
      afterSanitizeAttributes: [],
      afterSanitizeElements: [],
      afterSanitizeShadowDOM: [],
      beforeSanitizeAttributes: [],
      beforeSanitizeElements: [],
      beforeSanitizeShadowDOM: [],
      uponSanitizeAttribute: [],
      uponSanitizeElement: [],
      uponSanitizeShadowNode: []
    };
  };
  function createDOMPurify() {
    let window2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
    const DOMPurify = (root) => createDOMPurify(root);
    DOMPurify.version = "3.4.9";
    DOMPurify.removed = [];
    if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document || !window2.Element) {
      DOMPurify.isSupported = false;
      return DOMPurify;
    }
    let document2 = window2.document;
    const originalDocument = document2;
    const currentScript = originalDocument.currentScript;
    window2.DocumentFragment;
    const HTMLTemplateElement = window2.HTMLTemplateElement, Node2 = window2.Node, Element = window2.Element, NodeFilter = window2.NodeFilter, _window$NamedNodeMap = window2.NamedNodeMap;
    _window$NamedNodeMap === void 0 ? window2.NamedNodeMap || window2.MozNamedAttrMap : _window$NamedNodeMap;
    window2.HTMLFormElement;
    const DOMParser = window2.DOMParser, trustedTypes = window2.trustedTypes;
    const ElementPrototype = Element.prototype;
    const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
    const remove = lookupGetter(ElementPrototype, "remove");
    const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
    const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
    const getParentNode = lookupGetter(ElementPrototype, "parentNode");
    const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
    const getAttributes = lookupGetter(ElementPrototype, "attributes");
    const getNodeType = Node2 && Node2.prototype ? lookupGetter(Node2.prototype, "nodeType") : null;
    const getNodeName = Node2 && Node2.prototype ? lookupGetter(Node2.prototype, "nodeName") : null;
    if (typeof HTMLTemplateElement === "function") {
      const template = document2.createElement("template");
      if (template.content && template.content.ownerDocument) {
        document2 = template.content.ownerDocument;
      }
    }
    let trustedTypesPolicy;
    let emptyHTML = "";
    let defaultTrustedTypesPolicy;
    let defaultTrustedTypesPolicyResolved = false;
    let IN_TRUSTED_TYPES_POLICY = 0;
    const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy2() {
      if (IN_TRUSTED_TYPES_POLICY > 0) {
        throw typeErrorCreate('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.');
      }
    };
    const _createTrustedHTML = function _createTrustedHTML2(html2) {
      _assertNotInTrustedTypesPolicy();
      IN_TRUSTED_TYPES_POLICY++;
      try {
        return trustedTypesPolicy.createHTML(html2);
      } finally {
        IN_TRUSTED_TYPES_POLICY--;
      }
    };
    const _createTrustedScriptURL = function _createTrustedScriptURL2(scriptUrl) {
      _assertNotInTrustedTypesPolicy();
      IN_TRUSTED_TYPES_POLICY++;
      try {
        return trustedTypesPolicy.createScriptURL(scriptUrl);
      } finally {
        IN_TRUSTED_TYPES_POLICY--;
      }
    };
    const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy2() {
      if (!defaultTrustedTypesPolicyResolved) {
        defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
        defaultTrustedTypesPolicyResolved = true;
      }
      return defaultTrustedTypesPolicy;
    };
    const _document = document2, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
    const importNode = originalDocument.importNode;
    let hooks = _createHooksMap();
    DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
    const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
    let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
    let ALLOWED_TAGS = null;
    const DEFAULT_ALLOWED_TAGS = addToSet({}, [...html$1, ...svg$1, ...svgFilters, ...mathMl$1, ...text]);
    let ALLOWED_ATTR = null;
    const DEFAULT_ALLOWED_ATTR = addToSet({}, [...html, ...svg, ...mathMl, ...xml]);
    let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
      tagNameCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      attributeNameCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      allowCustomizedBuiltInElements: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: false
      }
    }));
    let FORBID_TAGS = null;
    let FORBID_ATTR = null;
    const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
      tagCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      attributeCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      }
    }));
    let ALLOW_ARIA_ATTR = true;
    let ALLOW_DATA_ATTR = true;
    let ALLOW_UNKNOWN_PROTOCOLS = false;
    let ALLOW_SELF_CLOSE_IN_ATTR = true;
    let SAFE_FOR_TEMPLATES = false;
    let SAFE_FOR_XML = true;
    let WHOLE_DOCUMENT = false;
    let SET_CONFIG = false;
    let FORCE_BODY = false;
    let RETURN_DOM = false;
    let RETURN_DOM_FRAGMENT = false;
    let RETURN_TRUSTED_TYPE = false;
    let SANITIZE_DOM = true;
    let SANITIZE_NAMED_PROPS = false;
    const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
    let KEEP_CONTENT = true;
    let IN_PLACE = false;
    let USE_PROFILES = {};
    let FORBID_CONTENTS = null;
    const DEFAULT_FORBID_CONTENTS = addToSet({}, [
      "annotation-xml",
      "audio",
      "colgroup",
      "desc",
      "foreignobject",
      "head",
      "iframe",
      "math",
      "mi",
      "mn",
      "mo",
      "ms",
      "mtext",
      "noembed",
      "noframes",
      "noscript",
      "plaintext",
      "script",
      // <selectedcontent> mirrors the selected <option>'s subtree, cloned by
      // the UA (customizable <select>) — including any on* handlers — and the
      // engine re-mirrors synchronously whenever a removal changes which
      // option/selectedcontent is current, even inside DOMPurify's inert
      // DOMParser document. Hoisting its children on removal re-inserts a fresh
      // mirror target ahead of the walk, which the engine refills, looping
      // forever (DoS) and amplifying output. Dropping its content on removal
      // (rather than hoisting) breaks that cascade; the content is a duplicate
      // of the option, which is sanitized on its own. See campaign-3 F1/F6.
      "selectedcontent",
      "style",
      "svg",
      "template",
      "thead",
      "title",
      "video",
      "xmp"
    ]);
    let DATA_URI_TAGS = null;
    const DEFAULT_DATA_URI_TAGS = addToSet({}, ["audio", "video", "img", "source", "image", "track"]);
    let URI_SAFE_ATTRIBUTES = null;
    const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, ["alt", "class", "for", "id", "label", "name", "pattern", "placeholder", "role", "summary", "title", "value", "style", "xmlns"]);
    const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
    const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
    const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
    let NAMESPACE = HTML_NAMESPACE;
    let IS_EMPTY_INPUT = false;
    let ALLOWED_NAMESPACES = null;
    const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [MATHML_NAMESPACE, SVG_NAMESPACE, HTML_NAMESPACE], stringToString);
    let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, ["mi", "mo", "mn", "ms", "mtext"]);
    let HTML_INTEGRATION_POINTS = addToSet({}, ["annotation-xml"]);
    const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, ["title", "style", "font", "a", "script"]);
    let PARSER_MEDIA_TYPE = null;
    const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
    const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
    let transformCaseFunc = null;
    let CONFIG = null;
    const formElement = document2.createElement("form");
    const isRegexOrFunction = function isRegexOrFunction2(testValue) {
      return testValue instanceof RegExp || testValue instanceof Function;
    };
    const _parseConfig = function _parseConfig2() {
      let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      if (CONFIG && CONFIG === cfg) {
        return;
      }
      if (!cfg || typeof cfg !== "object") {
        cfg = {};
      }
      cfg = clone(cfg);
      PARSER_MEDIA_TYPE = // eslint-disable-next-line unicorn/prefer-includes
      SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
      transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
      ALLOWED_TAGS = objectHasOwnProperty(cfg, "ALLOWED_TAGS") && arrayIsArray(cfg.ALLOWED_TAGS) ? addToSet({}, cfg.ALLOWED_TAGS, transformCaseFunc) : DEFAULT_ALLOWED_TAGS;
      ALLOWED_ATTR = objectHasOwnProperty(cfg, "ALLOWED_ATTR") && arrayIsArray(cfg.ALLOWED_ATTR) ? addToSet({}, cfg.ALLOWED_ATTR, transformCaseFunc) : DEFAULT_ALLOWED_ATTR;
      ALLOWED_NAMESPACES = objectHasOwnProperty(cfg, "ALLOWED_NAMESPACES") && arrayIsArray(cfg.ALLOWED_NAMESPACES) ? addToSet({}, cfg.ALLOWED_NAMESPACES, stringToString) : DEFAULT_ALLOWED_NAMESPACES;
      URI_SAFE_ATTRIBUTES = objectHasOwnProperty(cfg, "ADD_URI_SAFE_ATTR") && arrayIsArray(cfg.ADD_URI_SAFE_ATTR) ? addToSet(clone(DEFAULT_URI_SAFE_ATTRIBUTES), cfg.ADD_URI_SAFE_ATTR, transformCaseFunc) : DEFAULT_URI_SAFE_ATTRIBUTES;
      DATA_URI_TAGS = objectHasOwnProperty(cfg, "ADD_DATA_URI_TAGS") && arrayIsArray(cfg.ADD_DATA_URI_TAGS) ? addToSet(clone(DEFAULT_DATA_URI_TAGS), cfg.ADD_DATA_URI_TAGS, transformCaseFunc) : DEFAULT_DATA_URI_TAGS;
      FORBID_CONTENTS = objectHasOwnProperty(cfg, "FORBID_CONTENTS") && arrayIsArray(cfg.FORBID_CONTENTS) ? addToSet({}, cfg.FORBID_CONTENTS, transformCaseFunc) : DEFAULT_FORBID_CONTENTS;
      FORBID_TAGS = objectHasOwnProperty(cfg, "FORBID_TAGS") && arrayIsArray(cfg.FORBID_TAGS) ? addToSet({}, cfg.FORBID_TAGS, transformCaseFunc) : clone({});
      FORBID_ATTR = objectHasOwnProperty(cfg, "FORBID_ATTR") && arrayIsArray(cfg.FORBID_ATTR) ? addToSet({}, cfg.FORBID_ATTR, transformCaseFunc) : clone({});
      USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
      ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
      ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
      ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
      ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
      SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
      SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
      WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
      RETURN_DOM = cfg.RETURN_DOM || false;
      RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
      RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
      FORCE_BODY = cfg.FORCE_BODY || false;
      SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
      SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
      KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
      IN_PLACE = cfg.IN_PLACE || false;
      IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
      NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
      MATHML_TEXT_INTEGRATION_POINTS = objectHasOwnProperty(cfg, "MATHML_TEXT_INTEGRATION_POINTS") && cfg.MATHML_TEXT_INTEGRATION_POINTS && typeof cfg.MATHML_TEXT_INTEGRATION_POINTS === "object" ? clone(cfg.MATHML_TEXT_INTEGRATION_POINTS) : addToSet({}, ["mi", "mo", "mn", "ms", "mtext"]);
      HTML_INTEGRATION_POINTS = objectHasOwnProperty(cfg, "HTML_INTEGRATION_POINTS") && cfg.HTML_INTEGRATION_POINTS && typeof cfg.HTML_INTEGRATION_POINTS === "object" ? clone(cfg.HTML_INTEGRATION_POINTS) : addToSet({}, ["annotation-xml"]);
      const customElementHandling = objectHasOwnProperty(cfg, "CUSTOM_ELEMENT_HANDLING") && cfg.CUSTOM_ELEMENT_HANDLING && typeof cfg.CUSTOM_ELEMENT_HANDLING === "object" ? clone(cfg.CUSTOM_ELEMENT_HANDLING) : create(null);
      CUSTOM_ELEMENT_HANDLING = create(null);
      if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) {
        CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
      }
      if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) {
        CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
      }
      if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") {
        CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
      }
      if (SAFE_FOR_TEMPLATES) {
        ALLOW_DATA_ATTR = false;
      }
      if (RETURN_DOM_FRAGMENT) {
        RETURN_DOM = true;
      }
      if (USE_PROFILES) {
        ALLOWED_TAGS = addToSet({}, text);
        ALLOWED_ATTR = create(null);
        if (USE_PROFILES.html === true) {
          addToSet(ALLOWED_TAGS, html$1);
          addToSet(ALLOWED_ATTR, html);
        }
        if (USE_PROFILES.svg === true) {
          addToSet(ALLOWED_TAGS, svg$1);
          addToSet(ALLOWED_ATTR, svg);
          addToSet(ALLOWED_ATTR, xml);
        }
        if (USE_PROFILES.svgFilters === true) {
          addToSet(ALLOWED_TAGS, svgFilters);
          addToSet(ALLOWED_ATTR, svg);
          addToSet(ALLOWED_ATTR, xml);
        }
        if (USE_PROFILES.mathMl === true) {
          addToSet(ALLOWED_TAGS, mathMl$1);
          addToSet(ALLOWED_ATTR, mathMl);
          addToSet(ALLOWED_ATTR, xml);
        }
      }
      EXTRA_ELEMENT_HANDLING.tagCheck = null;
      EXTRA_ELEMENT_HANDLING.attributeCheck = null;
      if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
        if (typeof cfg.ADD_TAGS === "function") {
          EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
        } else if (arrayIsArray(cfg.ADD_TAGS)) {
          if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) {
            ALLOWED_TAGS = clone(ALLOWED_TAGS);
          }
          addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
        }
      }
      if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
        if (typeof cfg.ADD_ATTR === "function") {
          EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
        } else if (arrayIsArray(cfg.ADD_ATTR)) {
          if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) {
            ALLOWED_ATTR = clone(ALLOWED_ATTR);
          }
          addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
        }
      }
      if (objectHasOwnProperty(cfg, "ADD_URI_SAFE_ATTR") && arrayIsArray(cfg.ADD_URI_SAFE_ATTR)) {
        addToSet(URI_SAFE_ATTRIBUTES, cfg.ADD_URI_SAFE_ATTR, transformCaseFunc);
      }
      if (objectHasOwnProperty(cfg, "FORBID_CONTENTS") && arrayIsArray(cfg.FORBID_CONTENTS)) {
        if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
          FORBID_CONTENTS = clone(FORBID_CONTENTS);
        }
        addToSet(FORBID_CONTENTS, cfg.FORBID_CONTENTS, transformCaseFunc);
      }
      if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
        if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
          FORBID_CONTENTS = clone(FORBID_CONTENTS);
        }
        addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
      }
      if (KEEP_CONTENT) {
        ALLOWED_TAGS["#text"] = true;
      }
      if (WHOLE_DOCUMENT) {
        addToSet(ALLOWED_TAGS, ["html", "head", "body"]);
      }
      if (ALLOWED_TAGS.table) {
        addToSet(ALLOWED_TAGS, ["tbody"]);
        delete FORBID_TAGS.tbody;
      }
      if (cfg.TRUSTED_TYPES_POLICY) {
        if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") {
          throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
        }
        if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") {
          throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
        }
        const previousTrustedTypesPolicy = trustedTypesPolicy;
        trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
        try {
          emptyHTML = _createTrustedHTML("");
        } catch (error) {
          trustedTypesPolicy = previousTrustedTypesPolicy;
          throw error;
        }
      } else if (cfg.TRUSTED_TYPES_POLICY === null) {
        trustedTypesPolicy = void 0;
        emptyHTML = "";
      } else {
        if (trustedTypesPolicy === void 0) {
          trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
        }
        if (trustedTypesPolicy && typeof emptyHTML === "string") {
          emptyHTML = _createTrustedHTML("");
        }
      }
      if ((hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) && ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) {
        ALLOWED_TAGS = clone(ALLOWED_TAGS);
      }
      if (hooks.uponSanitizeAttribute.length > 0 && ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) {
        ALLOWED_ATTR = clone(ALLOWED_ATTR);
      }
      if (freeze) {
        freeze(cfg);
      }
      CONFIG = cfg;
    };
    const ALL_SVG_TAGS = addToSet({}, [...svg$1, ...svgFilters, ...svgDisallowed]);
    const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
    const _checkValidNamespace = function _checkValidNamespace2(element) {
      let parent = getParentNode(element);
      if (!parent || !parent.tagName) {
        parent = {
          namespaceURI: NAMESPACE,
          tagName: "template"
        };
      }
      const tagName = stringToLowerCase(element.tagName);
      const parentTagName = stringToLowerCase(parent.tagName);
      if (!ALLOWED_NAMESPACES[element.namespaceURI]) {
        return false;
      }
      if (element.namespaceURI === SVG_NAMESPACE) {
        if (parent.namespaceURI === HTML_NAMESPACE) {
          return tagName === "svg";
        }
        if (parent.namespaceURI === MATHML_NAMESPACE) {
          return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
        }
        return Boolean(ALL_SVG_TAGS[tagName]);
      }
      if (element.namespaceURI === MATHML_NAMESPACE) {
        if (parent.namespaceURI === HTML_NAMESPACE) {
          return tagName === "math";
        }
        if (parent.namespaceURI === SVG_NAMESPACE) {
          return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
        }
        return Boolean(ALL_MATHML_TAGS[tagName]);
      }
      if (element.namespaceURI === HTML_NAMESPACE) {
        if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) {
          return false;
        }
        if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) {
          return false;
        }
        return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
      }
      if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) {
        return true;
      }
      return false;
    };
    const _forceRemove = function _forceRemove2(node) {
      arrayPush(DOMPurify.removed, {
        element: node
      });
      try {
        getParentNode(node).removeChild(node);
      } catch (_) {
        remove(node);
        if (!getParentNode(node)) {
          throw typeErrorCreate("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place");
        }
      }
    };
    const _neutralizeRoot = function _neutralizeRoot2(root) {
      const childNodes = getChildNodes ? getChildNodes(root) : root.childNodes;
      if (childNodes) {
        const snapshot = [];
        arrayForEach(childNodes, (child) => {
          arrayPush(snapshot, child);
        });
        arrayForEach(snapshot, (child) => {
          try {
            remove(child);
          } catch (_) {
          }
        });
      }
      const attributes = getAttributes ? getAttributes(root) : null;
      if (attributes) {
        for (let i = attributes.length - 1; i >= 0; --i) {
          const attribute = attributes[i];
          const name = attribute && attribute.name;
          if (typeof name === "string") {
            try {
              root.removeAttribute(name);
            } catch (_) {
            }
          }
        }
      }
    };
    const _removeAttribute = function _removeAttribute2(name, element) {
      try {
        arrayPush(DOMPurify.removed, {
          attribute: element.getAttributeNode(name),
          from: element
        });
      } catch (_) {
        arrayPush(DOMPurify.removed, {
          attribute: null,
          from: element
        });
      }
      element.removeAttribute(name);
      if (name === "is") {
        if (RETURN_DOM || RETURN_DOM_FRAGMENT) {
          try {
            _forceRemove(element);
          } catch (_) {
          }
        } else {
          try {
            element.setAttribute(name, "");
          } catch (_) {
          }
        }
      }
    };
    const _stripDisallowedAttributes = function _stripDisallowedAttributes2(element) {
      const attributes = getAttributes ? getAttributes(element) : element.attributes;
      if (!attributes) {
        return;
      }
      for (let i = attributes.length - 1; i >= 0; --i) {
        const attribute = attributes[i];
        const name = attribute && attribute.name;
        if (typeof name !== "string" || ALLOWED_ATTR[transformCaseFunc(name)]) {
          continue;
        }
        try {
          element.removeAttribute(name);
        } catch (_) {
        }
      }
    };
    const _neutralizeSubtree = function _neutralizeSubtree2(root) {
      const stack = [root];
      while (stack.length > 0) {
        const node = stack.pop();
        const nodeType = getNodeType ? getNodeType(node) : node.nodeType;
        if (nodeType === NODE_TYPE.element) {
          _stripDisallowedAttributes(node);
        }
        const childNodes = getChildNodes ? getChildNodes(node) : node.childNodes;
        if (childNodes) {
          for (let i = childNodes.length - 1; i >= 0; --i) {
            stack.push(childNodes[i]);
          }
        }
      }
    };
    const _initDocument = function _initDocument2(dirty) {
      let doc = null;
      let leadingWhitespace = null;
      if (FORCE_BODY) {
        dirty = "<remove></remove>" + dirty;
      } else {
        const matches = stringMatch(dirty, /^[\r\n\t ]+/);
        leadingWhitespace = matches && matches[0];
      }
      if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) {
        dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
      }
      const dirtyPayload = trustedTypesPolicy ? _createTrustedHTML(dirty) : dirty;
      if (NAMESPACE === HTML_NAMESPACE) {
        try {
          doc = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
        } catch (_) {
        }
      }
      if (!doc || !doc.documentElement) {
        doc = implementation.createDocument(NAMESPACE, "template", null);
        try {
          doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
        } catch (_) {
        }
      }
      const body = doc.body || doc.documentElement;
      if (dirty && leadingWhitespace) {
        body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
      }
      if (NAMESPACE === HTML_NAMESPACE) {
        return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
      }
      return WHOLE_DOCUMENT ? doc.documentElement : body;
    };
    const _createNodeIterator = function _createNodeIterator2(root) {
      return createNodeIterator.call(
        root.ownerDocument || root,
        root,
        // eslint-disable-next-line no-bitwise
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION,
        null
      );
    };
    const _scrubTemplateExpressions2 = function _scrubTemplateExpressions(node) {
      var _node$querySelectorAl, _node$querySelectorAl2;
      node.normalize();
      const walker = createNodeIterator.call(
        node.ownerDocument || node,
        node,
        // eslint-disable-next-line no-bitwise
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION,
        null
      );
      let currentNode = walker.nextNode();
      while (currentNode) {
        let data = currentNode.data;
        arrayForEach([MUSTACHE_EXPR$1, ERB_EXPR$1, TMPLIT_EXPR$1], (expr) => {
          data = stringReplace(data, expr, " ");
        });
        currentNode.data = data;
        currentNode = walker.nextNode();
      }
      const templates = (_node$querySelectorAl = (_node$querySelectorAl2 = node.querySelectorAll) === null || _node$querySelectorAl2 === void 0 ? void 0 : _node$querySelectorAl2.call(node, "template")) !== null && _node$querySelectorAl !== void 0 ? _node$querySelectorAl : [];
      arrayForEach(Array.from(templates), (tmpl) => {
        if (_isDocumentFragment(tmpl.content)) {
          _scrubTemplateExpressions2(tmpl.content);
        }
      });
    };
    const _isClobbered = function _isClobbered2(element) {
      const realTagName = getNodeName ? getNodeName(element) : null;
      if (typeof realTagName !== "string") {
        return false;
      }
      if (transformCaseFunc(realTagName) !== "form") {
        return false;
      }
      return typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || // Realm-safe NamedNodeMap detection: equality against the cached
      // prototype getter. Clobbered .attributes (e.g. <input name="attributes">)
      // makes the direct read diverge from the cached read; a clean form
      // (same-realm OR foreign-realm) has both reads pointing at the same
      // canonical NamedNodeMap.
      element.attributes !== getAttributes(element) || typeof element.removeAttribute !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function" || // NodeType clobbering probe. Cached Node.prototype.nodeType getter
      // returns the integer 1 for any Element regardless of realm; direct
      // read on a clobbered form (e.g. <input name="nodeType">) returns
      // the named child element. Cheap addition — nodeType is read from
      // an internal slot, no serialization cost — and removes a residual
      // clobbering surface used by several mXSS / PI / comment branches
      // in _sanitizeElements that compare currentNode.nodeType directly.
      element.nodeType !== getNodeType(element) || // HTMLFormElement has [LegacyOverrideBuiltIns]: a descendant named
      // "childNodes" shadows the prototype getter. Direct reads of
      // form.childNodes from a clobbered form return the named child
      // instead of the real NodeList, so any walk that reads it directly
      // skips the form's real children. Compare the direct read to the
      // cached Node.prototype getter — when the form's named-property
      // getter intercepts the read, the two values differ and we flag
      // the form. This catches every clobbering child type (input,
      // select, etc.) regardless of whether the named child happens to
      // carry a numeric .length, which a typeof-based probe would miss
      // (e.g. HTMLSelectElement.length is a defined unsigned-long).
      element.childNodes !== getChildNodes(element);
    };
    const _isDocumentFragment = function _isDocumentFragment2(value) {
      if (!getNodeType || typeof value !== "object" || value === null) {
        return false;
      }
      try {
        return getNodeType(value) === NODE_TYPE.documentFragment;
      } catch (_) {
        return false;
      }
    };
    const _isNode = function _isNode2(value) {
      if (!getNodeType || typeof value !== "object" || value === null) {
        return false;
      }
      try {
        return typeof getNodeType(value) === "number";
      } catch (_) {
        return false;
      }
    };
    function _executeHooks(hooks2, currentNode, data) {
      arrayForEach(hooks2, (hook) => {
        hook.call(DOMPurify, currentNode, data, CONFIG);
      });
    }
    const _sanitizeElements = function _sanitizeElements2(currentNode) {
      let content = null;
      _executeHooks(hooks.beforeSanitizeElements, currentNode, null);
      if (_isClobbered(currentNode)) {
        _forceRemove(currentNode);
        return true;
      }
      const tagName = transformCaseFunc(getNodeName ? getNodeName(currentNode) : currentNode.nodeName);
      _executeHooks(hooks.uponSanitizeElement, currentNode, {
        tagName,
        allowedTags: ALLOWED_TAGS
      });
      if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(/<[/\w!]/g, currentNode.innerHTML) && regExpTest(/<[/\w!]/g, currentNode.textContent)) {
        _forceRemove(currentNode);
        return true;
      }
      if (SAFE_FOR_XML && currentNode.namespaceURI === HTML_NAMESPACE && tagName === "style" && _isNode(currentNode.firstElementChild)) {
        _forceRemove(currentNode);
        return true;
      }
      if (currentNode.nodeType === NODE_TYPE.progressingInstruction) {
        _forceRemove(currentNode);
        return true;
      }
      if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(/<[/\w]/g, currentNode.data)) {
        _forceRemove(currentNode);
        return true;
      }
      if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS[tagName]) {
        if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName)) {
          if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) {
            return false;
          }
          if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(tagName)) {
            return false;
          }
        }
        if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
          const parentNode = getParentNode(currentNode);
          const childNodes = getChildNodes(currentNode);
          if (childNodes && parentNode) {
            const childCount = childNodes.length;
            for (let i = childCount - 1; i >= 0; --i) {
              const hoisted = IN_PLACE ? childNodes[i] : cloneNode(childNodes[i], true);
              parentNode.insertBefore(hoisted, getNextSibling(currentNode));
            }
          }
        }
        _forceRemove(currentNode);
        return true;
      }
      const nt = getNodeType ? getNodeType(currentNode) : currentNode.nodeType;
      if (nt === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
        _forceRemove(currentNode);
        return true;
      }
      if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(/<\/no(script|embed|frames)/i, currentNode.innerHTML)) {
        _forceRemove(currentNode);
        return true;
      }
      if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
        content = currentNode.textContent;
        arrayForEach([MUSTACHE_EXPR$1, ERB_EXPR$1, TMPLIT_EXPR$1], (expr) => {
          content = stringReplace(content, expr, " ");
        });
        if (currentNode.textContent !== content) {
          arrayPush(DOMPurify.removed, {
            element: currentNode.cloneNode()
          });
          currentNode.textContent = content;
        }
      }
      _executeHooks(hooks.afterSanitizeElements, currentNode, null);
      return false;
    };
    const _isValidAttribute = function _isValidAttribute2(lcTag, lcName, value) {
      if (FORBID_ATTR[lcName]) {
        return false;
      }
      if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document2 || value in formElement)) {
        return false;
      }
      const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
      if (ALLOW_DATA_ATTR && !FORBID_ATTR[lcName] && regExpTest(DATA_ATTR$1, lcName)) ;
      else if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName)) ;
      else if (!nameIsPermitted || FORBID_ATTR[lcName]) {
        if (
          // First condition does a very basic check if a) it's basically a valid custom element tagname AND
          // b) if the tagName passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
          // and c) if the attribute name passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.attributeNameCheck
          _isBasicCustomElement(lcTag) && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(lcTag)) && (CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName) || CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.attributeNameCheck(lcName, lcTag)) || // Alternative, second condition checks if it's an `is`-attribute, AND
          // the value passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
          lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(value))
        ) ;
        else {
          return false;
        }
      } else if (URI_SAFE_ATTRIBUTES[lcName]) ;
      else if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) ;
      else if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) ;
      else if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) ;
      else if (value) {
        return false;
      } else ;
      return true;
    };
    const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, ["annotation-xml", "color-profile", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "missing-glyph"]);
    const _isBasicCustomElement = function _isBasicCustomElement2(tagName) {
      return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
    };
    const _sanitizeAttributes = function _sanitizeAttributes2(currentNode) {
      _executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
      const attributes = currentNode.attributes;
      if (!attributes || _isClobbered(currentNode)) {
        return;
      }
      const hookEvent = {
        attrName: "",
        attrValue: "",
        keepAttr: true,
        allowedAttributes: ALLOWED_ATTR,
        forceKeepAttr: void 0
      };
      let l = attributes.length;
      while (l--) {
        const attr = attributes[l];
        const name = attr.name, namespaceURI = attr.namespaceURI, attrValue = attr.value;
        const lcName = transformCaseFunc(name);
        const initValue = attrValue;
        let value = name === "value" ? initValue : stringTrim(initValue);
        hookEvent.attrName = lcName;
        hookEvent.attrValue = value;
        hookEvent.keepAttr = true;
        hookEvent.forceKeepAttr = void 0;
        _executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
        value = hookEvent.attrValue;
        if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
          _removeAttribute(name, currentNode);
          value = SANITIZE_NAMED_PROPS_PREFIX + value;
        }
        if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (lcName === "attributename" && stringMatch(value, "href")) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (hookEvent.forceKeepAttr) {
          continue;
        }
        if (!hookEvent.keepAttr) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(/\/>/i, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (SAFE_FOR_TEMPLATES) {
          arrayForEach([MUSTACHE_EXPR$1, ERB_EXPR$1, TMPLIT_EXPR$1], (expr) => {
            value = stringReplace(value, expr, " ");
          });
        }
        const lcTag = transformCaseFunc(currentNode.nodeName);
        if (!_isValidAttribute(lcTag, lcName, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function") {
          if (namespaceURI) ;
          else {
            switch (trustedTypes.getAttributeType(lcTag, lcName)) {
              case "TrustedHTML": {
                value = _createTrustedHTML(value);
                break;
              }
              case "TrustedScriptURL": {
                value = _createTrustedScriptURL(value);
                break;
              }
            }
          }
        }
        if (value !== initValue) {
          try {
            if (namespaceURI) {
              currentNode.setAttributeNS(namespaceURI, name, value);
            } else {
              currentNode.setAttribute(name, value);
            }
            if (_isClobbered(currentNode)) {
              _forceRemove(currentNode);
            } else {
              arrayPop(DOMPurify.removed);
            }
          } catch (_) {
            _removeAttribute(name, currentNode);
          }
        }
      }
      _executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
    };
    const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
      let shadowNode = null;
      const shadowIterator = _createNodeIterator(fragment);
      _executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
      while (shadowNode = shadowIterator.nextNode()) {
        _executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
        _sanitizeElements(shadowNode);
        _sanitizeAttributes(shadowNode);
        if (_isDocumentFragment(shadowNode.content)) {
          _sanitizeShadowDOM2(shadowNode.content);
        }
        const shadowNodeType = getNodeType ? getNodeType(shadowNode) : shadowNode.nodeType;
        if (shadowNodeType === NODE_TYPE.element) {
          const innerSr = getShadowRoot ? getShadowRoot(shadowNode) : shadowNode.shadowRoot;
          if (_isDocumentFragment(innerSr)) {
            _sanitizeAttachedShadowRoots(innerSr);
            _sanitizeShadowDOM2(innerSr);
          }
        }
      }
      _executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
    };
    const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots2(root) {
      const stack = [{
        node: root,
        shadow: null
      }];
      while (stack.length > 0) {
        const item = stack.pop();
        if (item.shadow) {
          _sanitizeShadowDOM2(item.shadow);
          continue;
        }
        const node = item.node;
        const nodeType = getNodeType ? getNodeType(node) : node.nodeType;
        const isElement = nodeType === NODE_TYPE.element;
        const childNodes = getChildNodes ? getChildNodes(node) : node.childNodes;
        if (childNodes) {
          for (let i = childNodes.length - 1; i >= 0; --i) {
            stack.push({
              node: childNodes[i],
              shadow: null
            });
          }
        }
        if (isElement) {
          const rootName = getNodeName ? getNodeName(node) : null;
          if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
            const content = node.content;
            if (_isDocumentFragment(content)) {
              stack.push({
                node: content,
                shadow: null
              });
            }
          }
        }
        if (isElement) {
          const sr = getShadowRoot ? getShadowRoot(node) : node.shadowRoot;
          if (_isDocumentFragment(sr)) {
            stack.push({
              node: null,
              shadow: sr
            }, {
              node: sr,
              shadow: null
            });
          }
        }
      }
    };
    DOMPurify.sanitize = function(dirty) {
      let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      let body = null;
      let importedNode = null;
      let currentNode = null;
      let returnNode = null;
      IS_EMPTY_INPUT = !dirty;
      if (IS_EMPTY_INPUT) {
        dirty = "<!-->";
      }
      if (typeof dirty !== "string" && !_isNode(dirty)) {
        dirty = stringifyValue(dirty);
        if (typeof dirty !== "string") {
          throw typeErrorCreate("dirty is not a string, aborting");
        }
      }
      if (!DOMPurify.isSupported) {
        return dirty;
      }
      if (!SET_CONFIG) {
        _parseConfig(cfg);
      }
      DOMPurify.removed = [];
      const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
      if (inPlace) {
        const nn = getNodeName ? getNodeName(dirty) : dirty.nodeName;
        if (typeof nn === "string") {
          const tagName = transformCaseFunc(nn);
          if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
            throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
          }
        }
        if (_isClobbered(dirty)) {
          throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
        }
        try {
          _sanitizeAttachedShadowRoots(dirty);
        } catch (error) {
          _neutralizeRoot(dirty);
          throw error;
        }
      } else if (_isNode(dirty)) {
        body = _initDocument("<!---->");
        importedNode = body.ownerDocument.importNode(dirty, true);
        if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") {
          body = importedNode;
        } else if (importedNode.nodeName === "HTML") {
          body = importedNode;
        } else {
          body.appendChild(importedNode);
        }
        _sanitizeAttachedShadowRoots(importedNode);
      } else {
        if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && // eslint-disable-next-line unicorn/prefer-includes
        dirty.indexOf("<") === -1) {
          return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
        }
        body = _initDocument(dirty);
        if (!body) {
          return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
        }
      }
      if (body && FORCE_BODY) {
        _forceRemove(body.firstChild);
      }
      const nodeIterator = _createNodeIterator(inPlace ? dirty : body);
      try {
        while (currentNode = nodeIterator.nextNode()) {
          _sanitizeElements(currentNode);
          _sanitizeAttributes(currentNode);
          if (_isDocumentFragment(currentNode.content)) {
            _sanitizeShadowDOM2(currentNode.content);
          }
        }
      } catch (error) {
        if (inPlace) {
          _neutralizeRoot(dirty);
        }
        throw error;
      }
      if (inPlace) {
        arrayForEach(DOMPurify.removed, (entry) => {
          if (entry.element) {
            _neutralizeSubtree(entry.element);
          }
        });
        if (SAFE_FOR_TEMPLATES) {
          _scrubTemplateExpressions2(dirty);
        }
        return dirty;
      }
      if (RETURN_DOM) {
        if (SAFE_FOR_TEMPLATES) {
          _scrubTemplateExpressions2(body);
        }
        if (RETURN_DOM_FRAGMENT) {
          returnNode = createDocumentFragment.call(body.ownerDocument);
          while (body.firstChild) {
            returnNode.appendChild(body.firstChild);
          }
        } else {
          returnNode = body;
        }
        if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) {
          returnNode = importNode.call(originalDocument, returnNode, true);
        }
        return returnNode;
      }
      let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
      if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) {
        serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
      }
      if (SAFE_FOR_TEMPLATES) {
        arrayForEach([MUSTACHE_EXPR$1, ERB_EXPR$1, TMPLIT_EXPR$1], (expr) => {
          serializedHTML = stringReplace(serializedHTML, expr, " ");
        });
      }
      return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
    };
    DOMPurify.setConfig = function() {
      let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      _parseConfig(cfg);
      SET_CONFIG = true;
    };
    DOMPurify.clearConfig = function() {
      CONFIG = null;
      SET_CONFIG = false;
      trustedTypesPolicy = defaultTrustedTypesPolicy;
      emptyHTML = "";
    };
    DOMPurify.isValidAttribute = function(tag, attr, value) {
      if (!CONFIG) {
        _parseConfig({});
      }
      const lcTag = transformCaseFunc(tag);
      const lcName = transformCaseFunc(attr);
      return _isValidAttribute(lcTag, lcName, value);
    };
    DOMPurify.addHook = function(entryPoint, hookFunction) {
      if (typeof hookFunction !== "function") {
        return;
      }
      arrayPush(hooks[entryPoint], hookFunction);
    };
    DOMPurify.removeHook = function(entryPoint, hookFunction) {
      if (hookFunction !== void 0) {
        const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
        return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
      }
      return arrayPop(hooks[entryPoint]);
    };
    DOMPurify.removeHooks = function(entryPoint) {
      hooks[entryPoint] = [];
    };
    DOMPurify.removeAllHooks = function() {
      hooks = _createHooksMap();
    };
    return DOMPurify;
  }
  var purify = createDOMPurify();

  // src/utils/SecurityUtils.ts
  var SecurityUtils = class {
    /**
     * Bereinigt HTML mit DOMPurify für sichere innerHTML-Zuweisungen.
     * Erlaubt grundlegende Formatierung (b, i, u, strong, em, a, br, p, span)
     * aber blockiert alle Scripts, Event-Handler und gefährlichen URLs.
     */
    static sanitizeHTML(html2) {
      if (!html2) return "";
      return purify.sanitize(html2, {
        ALLOWED_TAGS: ["b", "i", "u", "strong", "em", "a", "br", "p", "span", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "code", "pre"],
        ALLOWED_ATTR: ["href", "target", "title", "class", "style", "data-*"],
        ALLOW_DATA_ATTR: true,
        SANITIZE_DOM: true,
        // Links nur mit http/https/ftp/mailto - kein javascript:
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|xxx):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i
      });
    }
    /**
     * Escaped HTML special characters so strings can be safely inserted into DOM via innerHTML (e.g. tooltips)
     */
    static escapeHtml(str) {
      if (!str) return "";
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };
      return String(str).replace(/[&<>"']/g, (m) => map[m]);
    }
    /**
     * Checks if a CSS color value is reasonably safe to use.
     */
    static isValidCssColor(color) {
      if (!color) return false;
      const colorTrimmed = color.trim();
      return /^#[0-9a-fA-F]{3,8}$/.test(colorTrimmed) || /^(rgb|hsl)a?\([^)]+\)$/.test(colorTrimmed) || /^[a-zA-Z]+$/.test(colorTrimmed);
    }
    /**
     * Guard for ExpressionParser to prevent Arbitrary Code Execution (ACE)
     */
    static sanitizeExpression(expr) {
      if (!expr) return true;
      const blocked = /\b(fetch|XMLHttpRequest|eval|Function|import|require|window|document|localStorage|sessionStorage|electronFS|alert|confirm|prompt|process|global|globalThis)\b/i;
      return !blocked.test(expr);
    }
  };

  // src/editor/services/renderers/RenderedContent.ts
  var sources = /* @__PURE__ */ new WeakMap();
  function setRenderedContent(element, value, mode, preserveTranslation) {
    const source = String(value ?? "");
    const previous = sources.get(element);
    if (preserveTranslation && previous?.mode === mode && previous.value === source) return;
    if (element[mode] !== source) element[mode] = source;
    sources.set(element, { mode, value: source });
  }

  // src/config.ts
  var import_meta = {};
  var env = import_meta.env || {};
  var Config = {
    APP_TITLE: env.VITE_APP_TITLE || "GCS Game Builder",
    // Globales Log-Level
    LOG_LEVEL: parseLogLevel(env.VITE_LOG_LEVEL),
    // Spezifische Log-Level für einzelne Präfixe/Klassen
    // Beispiel in .env: VITE_LOG_LEVEL_StageRenderer=DEBUG
    PREFIX_LOG_LEVELS: parsePrefixLogLevels(env)
  };
  function parseLogLevel(val) {
    if (!val) return 0 /* DEBUG */;
    switch (val.toUpperCase()) {
      case "DEBUG":
        return 0 /* DEBUG */;
      case "INFO":
        return 1 /* INFO */;
      case "WARN":
        return 2 /* WARN */;
      case "ERROR":
        return 3 /* ERROR */;
      case "NONE":
        return 4 /* NONE */;
      default:
        return 0 /* DEBUG */;
    }
  }
  function parsePrefixLogLevels(env2) {
    const levels = {};
    const prefix = "VITE_LOG_LEVEL_";
    for (const key in env2) {
      if (key.startsWith(prefix)) {
        const moduleName = key.substring(prefix.length);
        if (moduleName && moduleName !== "LEVEL") {
          levels[moduleName] = parseLogLevel(env2[key]);
        }
      }
    }
    return levels;
  }

  // src/utils/Logger.ts
  var Logger = class _Logger {
    static logHandler;
    static globalLevel = Config.LOG_LEVEL;
    static useCaseFilter = () => false;
    static useCaseLabelProvider = (id) => id;
    static lastUseCaseId = void 0;
    prefix;
    level;
    useCase;
    constructor(prefix = "", useCase, level) {
      this.prefix = prefix ? `[${prefix}] ` : "";
      this.useCase = useCase;
      if (level !== void 0) {
        this.level = level;
      } else if (prefix && Config.PREFIX_LOG_LEVELS[prefix] !== void 0) {
        this.level = Config.PREFIX_LOG_LEVELS[prefix];
      } else {
        this.level = _Logger.globalLevel;
      }
    }
    /**
     * Sets the global log level.
     */
    static setGlobalLevel(level) {
      this.globalLevel = level;
    }
    /**
     * Sets the log handler callback.
     */
    static setLogHandler(handler) {
      this.logHandler = handler;
    }
    /**
     * Sets the filter function for UseCases.
     */
    static setUseCaseFilter(filter) {
      this.useCaseFilter = filter;
    }
    /**
     * Sets the provider function for UseCase labels.
     */
    static setUseCaseLabelProvider(provider) {
      this.useCaseLabelProvider = provider;
    }
    /**
     * Creates a new logger instance with a prefix and optional useCase.
     */
    static get(prefix, useCase) {
      return new _Logger(prefix, useCase);
    }
    /**
     * PERF: Prueft, ob eine Ausgabe fuer dieses Level ueberhaupt erfolgen wuerde.
     * Aufrufer in heissen Pfaden (Render-Loop) koennen damit die Konstruktion
     * teurer Nachrichten (Template-Strings, JSON, Objekt-Traversierung) vermeiden.
     */
    isEnabled(level) {
      if (level < this.level || level < _Logger.globalLevel) return false;
      if (level < 3 /* ERROR */ && this.useCase && !_Logger.useCaseFilter(this.useCase)) return false;
      return true;
    }
    debug(...args) {
      this.log(0 /* DEBUG */, ...args);
    }
    info(...args) {
      this.log(1 /* INFO */, ...args);
    }
    warn(...args) {
      this.log(2 /* WARN */, ...args);
    }
    error(...args) {
      this.log(3 /* ERROR */, ...args);
    }
    log(level, ...args) {
      if (level < this.level || level < _Logger.globalLevel) return;
      if (level < 3 /* ERROR */ && this.useCase && !_Logger.useCaseFilter(this.useCase)) {
        return;
      }
      if (this.useCase && level < 3 /* ERROR */ && this.useCase !== _Logger.lastUseCaseId) {
        const label2 = _Logger.useCaseLabelProvider(this.useCase);
        console.log(
          `%c
--- UseCase: '${label2}' ---`,
          "color: #673ab7; font-weight: bold; border-top: 1px solid #ddd; padding-top: 8px; margin-top: 8px;"
        );
        _Logger.lastUseCaseId = this.useCase;
      }
      const timestamp = (/* @__PURE__ */ new Date()).toISOString().split("T")[1].split("Z")[0];
      const prefix = `${timestamp} ${this.prefix}`;
      if (_Logger.logHandler) {
        const safeStringify = (a) => {
          if (typeof a !== "object" || a === null) return String(a);
          try {
            const seen = /* @__PURE__ */ new WeakSet();
            return JSON.stringify(a, (key, value) => {
              if (["renderer", "host", "parent", "stage", "editor", "_listeners", "_eventTarget"].includes(key)) return void 0;
              if (typeof value === "object" && value !== null) {
                if (seen.has(value)) return "[Circular]";
                seen.add(value);
              }
              return value;
            });
          } catch {
            return "[Object]";
          }
        };
        _Logger.logHandler(level, this.prefix, args.map(safeStringify).join(" "), this.useCase);
      }
      switch (level) {
        case 0 /* DEBUG */:
          console.debug(prefix, ...args);
          break;
        case 1 /* INFO */:
          console.info(prefix, ...args);
          break;
        case 2 /* WARN */:
          console.warn(prefix, ...args);
          break;
        case 3 /* ERROR */:
          console.error(prefix, ...args);
          break;
      }
    }
  };

  // src/editor/services/renderers/TextObjectRenderer.ts
  var logger = Logger.get("TextObjectRenderer");
  var TextObjectRenderer = class _TextObjectRenderer {
    static renderLabel(ctx2, el, obj) {
      const textValue = obj.text !== void 0 && obj.text !== null ? String(obj.text) : obj.value !== void 0 && obj.value !== null ? String(obj.value) : "";
      setRenderedContent(el, textValue, "innerText", ctx2.host.runMode);
      const fs = obj.style?.fontSize || obj.fontSize || 14;
      el.style.fontSize = ctx2.scaleFontSize(fs);
      const color = obj.style?.color;
      if (color) {
        el.style.color = color;
      } else {
        el.style.color = "";
      }
      const fw = obj.style?.fontWeight;
      el.style.fontWeight = fw === true || fw === "bold" ? "bold" : "normal";
      const fstyle = obj.style?.fontStyle;
      el.style.fontStyle = fstyle === true || fstyle === "italic" ? "italic" : "normal";
      if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
      el.style.userSelect = "none";
      el.style.cursor = "inherit";
      const align = obj.style?.textAlign || obj.alignment;
      if (align === "center") el.style.justifyContent = "center";
      else if (align === "right") el.style.justifyContent = "flex-end";
      else el.style.justifyContent = "flex-start";
    }
    static renderPanel(ctx2, el, obj) {
      const textValue = obj.caption || (ctx2.host.runMode ? "" : obj.name);
      setRenderedContent(el, textValue, "innerText", ctx2.host.runMode);
      const color = obj.style?.color || "#777";
      if (color) el.style.color = color;
      const fSize = obj.style?.fontSize || 14;
      el.style.fontSize = ctx2.scaleFontSize(fSize);
      const fw = obj.style?.fontWeight;
      el.style.fontWeight = fw === true || fw === "bold" ? "bold" : fw || "normal";
      const fStyle = obj.style?.fontStyle;
      el.style.fontStyle = fStyle === true || fStyle === "italic" ? "italic" : "normal";
      if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
      const align = obj.style?.textAlign || "center";
      el.style.justifyContent = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
      el.style.alignItems = "center";
    }
    static renderCard(ctx2, el, obj) {
      const title = obj.title || "";
      const subtitle = obj.subtitle || "";
      let html2 = "";
      if (obj.showHeader !== false && title) {
        html2 += `<div style="font-weight: bold; font-size: 1.2em; margin-bottom: 4px; color: ${obj.style?.color || "#333"};">${title}</div>`;
      }
      if (subtitle) {
        html2 += `<div style="font-size: 0.9em; opacity: 0.7; color: ${obj.style?.color || "#666"};">${subtitle}</div>`;
      }
      const finalHtml = `<div style="padding: 12px; width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column;">${html2}</div>`;
      setRenderedContent(el, finalHtml, "innerHTML", ctx2.host.runMode);
      const align = obj.style?.textAlign || "left";
      el.style.alignItems = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
      el.style.justifyContent = "flex-start";
    }
    static renderRichText(ctx2, el, obj) {
      let textValue = obj.htmlContent || (ctx2.host.runMode ? "" : `<i>${obj.name} (leeres RichText)</i>`);
      textValue = SecurityUtils.sanitizeHTML(textValue);
      if (textValue.includes("<font ")) {
        textValue = textValue.replace(
          /<font\s+color="([^"]+)">/gi,
          '<span style="color:$1">'
        ).replace(/<\/font>/gi, "</span>");
      }
      setRenderedContent(el, textValue, "innerHTML", ctx2.host.runMode);
      if (ctx2.host.runMode) {
        const anchors = el.querySelectorAll("a");
        anchors.forEach((a) => {
          const href = a.getAttribute("href");
          if (href && href.startsWith("stage:")) {
            a.setAttribute("data-stage", href);
            a.setAttribute("href", "#");
            a.onclick = (e) => e.preventDefault();
          }
        });
        el.onclick = (e) => {
          const target = e.target;
          const anchor = target.closest("a");
          if (anchor) {
            const stageHref = anchor.getAttribute("data-stage") || anchor.getAttribute("href");
            if (stageHref && stageHref.startsWith("stage:")) {
              e.preventDefault();
              e.stopPropagation();
              const stageId = stageHref.substring(6);
              if (ctx2.host.onEvent) {
                ctx2.host.onEvent("system", "__SYSTEM_NAVIGATE__", { target: `stage:${stageId}` });
              } else {
                logger.warn("ctx.host.onEvent nicht vorhanden. Stage-Wechsel fehlgeschlagen.");
              }
            }
          }
        };
      } else {
        el.onclick = (e) => {
          const target = e.target;
          if (target.closest("a")) {
            e.preventDefault();
          }
        };
      }
      const color = obj.style?.color;
      if (color) {
        el.style.color = color;
      } else {
        el.style.color = "";
      }
      const fs = obj.style?.fontSize || 14;
      el.style.fontSize = ctx2.scaleFontSize(fs);
      const fw = obj.style?.fontWeight;
      el.style.fontWeight = fw === true || fw === "bold" ? "bold" : fw || "normal";
      const fstyle = obj.style?.fontStyle;
      el.style.fontStyle = fstyle === true || fstyle === "italic" ? "italic" : "normal";
      if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
      const align = obj.style?.textAlign || "left";
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.justifyContent = "center";
      el.style.alignItems = "stretch";
      el.style.textAlign = align;
      if (obj.style?.padding) {
        el.style.padding = typeof obj.style.padding === "number" ? `${obj.style.padding}px` : obj.style.padding;
      }
      el.style.overflowY = "auto";
      el.style.overflowX = "hidden";
    }
    static renderGameHeader(ctx2, el, obj) {
      setRenderedContent(el, obj.title || obj.caption || obj.name, "innerText", ctx2.host.runMode);
      el.style.fontSize = obj.style?.fontSize ? typeof obj.style.fontSize === "number" ? `${obj.style.fontSize}px` : obj.style.fontSize : "18px";
      if (obj.style?.color) el.style.color = obj.style.color;
      const fw = obj.style?.fontWeight;
      el.style.fontWeight = fw === true || fw === "bold" ? "bold" : fw || "bold";
      const align = obj.style?.textAlign;
      el.style.justifyContent = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
      if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
    }
    static renderGameCard(ctx2, el, obj, isNew) {
      if (isNew) {
        el.innerHTML = `
                <div class="card-title" style="font-weight:bold;margin-bottom:10px"></div>
                <div class="card-btns" style="display:flex;gap:5px">
                    <button class="btn-single" style="padding:6px;border:none;border-radius:4px;background:#4caf50;color:#fff;cursor:pointer">\u25B6 Single</button>
                    <button class="btn-multi" style="padding:6px;border:none;border-radius:4px;background:#2196f3;color:#fff;cursor:pointer">\u{1F465} Multi</button>
                </div>
            `;
        el.style.flexDirection = "column";
        el.querySelector(".btn-single")?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (ctx2.host.onEvent) ctx2.host.onEvent(obj.id, "onSingleClick");
        });
        el.querySelector(".btn-multi")?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (ctx2.host.onEvent) ctx2.host.onEvent(obj.id, "onMultiClick");
        });
      }
      const titleEl = el.querySelector(".card-title");
      if (titleEl) setRenderedContent(titleEl, obj.gameName, "innerText", ctx2.host.runMode);
    }
    static renderButton(ctx2, el, obj, _isNew) {
      if (el.querySelector(".table-title-bar")) el.innerHTML = "";
      const textValue = obj.text || obj.caption || obj.name;
      let textSpan = el.querySelector(".btn-text");
      if (!textSpan) {
        el.childNodes.forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) child.remove();
        });
        textSpan = document.createElement("span");
        textSpan.className = "btn-text";
        textSpan.style.pointerEvents = "none";
        textSpan.style.width = "100%";
        el.insertBefore(textSpan, el.firstChild);
      }
      setRenderedContent(textSpan, textValue, "textContent", ctx2.host.runMode);
      const fw = obj.style?.fontWeight;
      el.style.fontWeight = fw === true || fw === "bold" ? "bold" : "normal";
      const fstyle = obj.style?.fontStyle;
      el.style.fontStyle = fstyle === true || fstyle === "italic" ? "italic" : "normal";
      const fs = obj.style?.fontSize || 14;
      el.style.fontSize = ctx2.scaleFontSize(fs);
      if (obj.style?.color) el.style.color = obj.style.color;
      if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
      const align = obj.style?.textAlign;
      const flexJustify = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
      const flexAlign = align === "left" ? "left" : align === "right" ? "right" : "center";
      el.style.justifyContent = flexJustify;
      el.style.textAlign = flexAlign;
      if (ctx2.host.runMode) {
        const isDisabled = obj.enabled === false;
        el.style.opacity = isDisabled ? "0.45" : "1";
        el.style.cursor = isDisabled ? "not-allowed" : "pointer";
        el.setAttribute("aria-disabled", isDisabled ? "true" : "false");
        el.onmouseenter = () => {
          if (obj.enabled === false) return;
          el.style.filter = "brightness(1.1)";
          if (ctx2.host.onEvent) ctx2.host.onEvent(obj.id, "onMouseEnter");
        };
        el.onmouseleave = () => {
          el.style.filter = "none";
          el.style.transform = el.style.transform.replace(" scale(0.98)", "");
          if (ctx2.host.onEvent) ctx2.host.onEvent(obj.id, "onMouseLeave");
        };
        el.onmousedown = () => {
          if (obj.enabled === false) return;
          if (!el.style.transform.includes("scale(0.98)")) {
            el.style.transform += " scale(0.98)";
          }
        };
        el.onmouseup = () => el.style.transform = el.style.transform.replace(" scale(0.98)", "");
        el.onclick = (e) => {
          e.stopPropagation();
          if (obj.enabled === false) return;
          if (ctx2.host.onEvent) {
            ctx2.host.onEvent(obj.id, "onClick");
          }
        };
        el.ondblclick = (e) => {
          e.stopPropagation();
          if (obj.enabled === false) return;
          if (ctx2.host.onEvent) {
            ctx2.host.onEvent(obj.id, "onDoubleClick");
          }
        };
      }
    }
    static renderStickyNote(ctx2, el, obj, isNew) {
      const isRunMode = ctx2.host.runMode;
      if (isNew) {
        const toolbarBtnStyle = "background:rgba(0,0,0,0.12); border:none; border-radius:3px; cursor:pointer; padding:2px 6px; font-size:12px; color:inherit; line-height:1.4;";
        el.innerHTML = `
                <div class="sticky-header" style="display:flex; background:rgba(0,0,0,0.06); border-bottom:1px solid rgba(0,0,0,0.1); cursor:move;">
                    <div style="padding: 4px; color:#888; pointer-events:none; font-size:10px; display:flex; align-items:center;">\u22EE\u22EE</div>
                    <input type="text" class="sticky-title" placeholder="Titel..." style="flex:1; font-weight:bold; font-size:1.1em; background:transparent; border:none; outline:none; padding: 4px 6px; color:inherit; font-family:inherit;">
                </div>
                <div class="sticky-toolbar" style="display:flex; gap:2px; padding:3px 6px; background:rgba(0,0,0,0.05); border-bottom:1px solid rgba(0,0,0,0.08); flex-wrap:wrap;">
                    <button class="stb-bold" title="Fett (Ctrl+B)" style="${toolbarBtnStyle}"><b>B</b></button>
                    <button class="stb-italic" title="Kursiv (Ctrl+I)" style="${toolbarBtnStyle}"><i>I</i></button>
                    <button class="stb-underline" title="Unterstrichen (Ctrl+U)" style="${toolbarBtnStyle}"><u>U</u></button>
                    <div style="width:1px; background:rgba(0,0,0,0.15); margin:2px 3px;"></div>
                    <button class="stb-link" title="Link einf\xFCgen" style="${toolbarBtnStyle}">\u{1F517}</button>
                    <button class="stb-unlink" title="Link entfernen" style="${toolbarBtnStyle}">\u2702\uFE0F</button>
                </div>
                <div class="sticky-body" contenteditable="true" data-placeholder="Notiz eingeben..." style="flex:1; background:transparent; border:none; outline:none; font-size:0.95em; padding:10px; color:inherit; font-family:inherit; overflow-y:auto; word-break:break-word; white-space:pre-wrap; min-height:40px;"></div>
                <div class="sticky-resize-handle" style="position:absolute; right:2px; bottom:2px; width:12px; height:12px; background: linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.15) 50%) bottom right / 8px 8px no-repeat; pointer-events:none;"></div>
            `;
        el.style.display = "flex";
        el.style.flexDirection = "column";
        el.style.padding = "0";
        el.style.overflow = "hidden";
        el.style.alignItems = "stretch";
        el.style.justifyContent = "flex-start";
        const ti2 = el.querySelector(".sticky-title");
        const body2 = el.querySelector(".sticky-body");
        const header2 = el.querySelector(".sticky-header");
        const toolbar2 = el.querySelector(".sticky-toolbar");
        if (!isRunMode) {
          ti2.onmousedown = (e) => e.stopPropagation();
          body2.onmousedown = (e) => e.stopPropagation();
          toolbar2.onmousedown = (e) => e.stopPropagation();
          const captureKey = (e) => e.stopPropagation();
          ti2.onkeydown = captureKey;
          body2.onkeydown = captureKey;
          ti2.oninput = () => {
            obj.title = ti2.value;
            if (ctx2.host.onEvent) ctx2.host.onEvent(obj.id || obj.name, "propertyChange", { path: "title", value: ti2.value });
          };
          body2.oninput = () => {
            const html2 = body2.innerHTML;
            obj.text = html2;
            if (ctx2.host.onEvent) ctx2.host.onEvent(obj.id || obj.name, "propertyChange", { path: "text", value: html2 });
          };
          const exec = (cmd, value) => {
            body2.focus();
            document.execCommand(cmd, false, value);
            const html2 = body2.innerHTML;
            obj.text = html2;
            if (ctx2.host.onEvent) ctx2.host.onEvent(obj.id || obj.name, "propertyChange", { path: "text", value: html2 });
          };
          el.querySelector(".stb-bold").onclick = (e) => {
            e.stopPropagation();
            exec("bold");
          };
          el.querySelector(".stb-italic").onclick = (e) => {
            e.stopPropagation();
            exec("italic");
          };
          el.querySelector(".stb-underline").onclick = (e) => {
            e.stopPropagation();
            exec("underline");
          };
          el.querySelector(".stb-unlink").onclick = (e) => {
            e.stopPropagation();
            exec("unlink");
          };
          el.querySelector(".stb-link").onclick = (e) => {
            e.stopPropagation();
            const sel = window.getSelection();
            const hasSelection = sel && sel.toString().trim().length > 0;
            const url = prompt(hasSelection ? `URL f\xFCr "${sel.toString()}" eingeben:` : "URL eingeben:", "https://");
            if (url && url !== "https://") {
              exec("createLink", url);
            }
          };
          body2.addEventListener("click", (e) => {
            const target = e.target;
            const anchor = target.closest("a");
            if (anchor) {
              e.preventDefault();
              e.stopPropagation();
              if (e.ctrlKey || e.metaKey) {
                if (window.helpOverlay) {
                  window.helpOverlay.show(anchor.href);
                } else {
                  window.open(anchor.href, "_blank");
                }
              }
            }
          });
        } else {
          body2.removeAttribute("contenteditable");
          toolbar2.style.display = "none";
          header2.style.cursor = "default";
          body2.addEventListener("click", (e) => {
            const anchor = e.target.closest("a");
            if (anchor) {
              e.preventDefault();
              _TextObjectRenderer.openUrl(anchor.href);
            }
          });
        }
      }
      const ti = el.querySelector(".sticky-title");
      const body = el.querySelector(".sticky-body");
      const header = el.querySelector(".sticky-header");
      const toolbar = el.querySelector(".sticky-toolbar");
      if (!isRunMode) {
        [ti, body, header, toolbar].forEach((child) => {
          if (child) {
            child.style.pointerEvents = "none";
            child.style.userSelect = "none";
          }
        });
      }
      const titleValue = obj.title !== void 0 ? String(obj.title) : "Notiz";
      if (ti && ti.value !== titleValue && document.activeElement !== ti) {
        ti.value = titleValue;
      }
      const rawText = obj.text !== void 0 ? String(obj.text) : "";
      const safeHTML = SecurityUtils.sanitizeHTML(rawText);
      if (body && document.activeElement !== body) {
        if (body.innerHTML !== safeHTML) {
          body.innerHTML = safeHTML;
        }
      }
      if (body) {
        body.setAttribute("data-placeholder", "Notiz eingeben...");
        if (!body.classList.contains("sticky-placeholder-init")) {
          body.classList.add("sticky-placeholder-init");
          const style = document.createElement("style");
          style.textContent = `.sticky-body[data-placeholder]:empty::before { content: attr(data-placeholder); color: rgba(0,0,0,0.35); pointer-events: none; }`;
          document.head.appendChild(style);
        }
      }
      if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
      if (obj.style?.color) el.style.color = obj.style.color;
    }
    /**
     * Öffnet eine URL in einem neuen Tab und bringt diesen in den Fokus.
     * Verwendet ein temporäres <a>-Element statt window.open(),
     * damit der Browser den neuen Tab sofort in den Vordergrund bringt.
     */
    static openUrl(url) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // audit.ts
  var samples = [{ "stage": "stage_main", "obj": { "className": "TButton", "id": "stage_main_nav_stage_admin_login", "name": "Navigation_stage_admin_login", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Navigation_stage_admin_login" }, "visible": true, "x": 1, "y": 41, "width": 12, "height": 2.5, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#062a26", "fontSize": 26, "fontWeight": "bold", "textAlign": "center", "backgroundColor": "#14b8a6", "borderColor": "#14b8a6", "borderWidth": 2, "borderRadius": 9, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "Verwaltung", "icon": "" }, "english": "Administration", "cell": 18 }, { "stage": "stage_gallery", "obj": { "className": "TButton", "id": "stage_gallery_nav_stage_admin_login", "name": "Navigation_stage_admin_login", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Navigation_stage_admin_login" }, "visible": true, "x": 1, "y": 41, "width": 12, "height": 2.5, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#062a26", "fontSize": 26, "fontWeight": "bold", "textAlign": "center", "backgroundColor": "#14b8a6", "borderColor": "#14b8a6", "borderWidth": 2, "borderRadius": 9, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "Verwaltung", "icon": "" }, "english": "Administration", "cell": 18 }, { "stage": "stage_profile", "obj": { "className": "TButton", "id": "upload_AvatarAbbrechen", "name": "AvatarAbbrechen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Avatar_Abbrechen" }, "visible": true, "x": 43, "y": 34, "width": 13, "height": 3, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#cbd5e1", "fontSize": 18, "fontWeight": "bold", "textAlign": "center", "backgroundColor": "#13222e", "borderColor": "#22394a", "borderWidth": 0, "borderRadius": 9, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "Abbrechen", "icon": "" }, "english": "Cancel", "cell": 18 }, { "stage": "stage_profile", "obj": { "className": "TButton", "id": "stage_profile_nav_stage_admin_login", "name": "Navigation_stage_admin_login", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Navigation_stage_admin_login" }, "visible": true, "x": 1, "y": 41, "width": 12, "height": 2.5, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#062a26", "fontSize": 26, "fontWeight": "bold", "textAlign": "center", "backgroundColor": "#14b8a6", "borderColor": "#14b8a6", "borderWidth": 2, "borderRadius": 9, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "Verwaltung", "icon": "" }, "english": "Administration", "cell": 18 }, { "stage": "stage_admin_login", "obj": { "className": "TButton", "id": "stage_admin_login_stage_main_Anmelden", "name": "Anmelden", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Anmeldung_Starten" }, "visible": true, "x": 12, "y": 23, "width": 40, "height": 3, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#062a26", "fontSize": 20, "fontWeight": "bold", "textAlign": "center", "backgroundColor": "#14b8a6", "borderColor": "#14b8a6", "borderWidth": 1, "borderRadius": 9, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "Anmelden", "icon": "" }, "english": "Sign in", "cell": 18 }, { "stage": "stage_library_detail", "obj": { "className": "TButton", "id": "cms_75e80966-f1e8-402c-b99a-c7a3cd832007", "name": "Abbrechen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Spiel_Upload_Abbrechen" }, "visible": false, "x": 49.18181818181818, "y": 18, "width": 12.818181818181818, "height": 3, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#fff", "fontSize": 18, "fontWeight": "bold", "textAlign": "center", "backgroundColor": "#285464", "borderColor": "transparent", "borderWidth": 0, "borderRadius": 100, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "Abbrechen", "icon": "" }, "english": "Cancel", "cell": 18 }, { "stage": "stage_super_admin_detail", "obj": { "className": "TButton", "id": "cms_button-05a35396-6334-435b-8343-486f9fc2b034", "name": "Confirm", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Sperre_Bestaetigen" }, "visible": false, "x": 31.022727272727273, "y": 9, "width": 21.363636363636363, "height": 2.5, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#ffffff", "fontSize": 17, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "bold", "textAlign": "center", "backgroundColor": "#2a9d8f", "borderColor": "#2a9d8f", "borderWidth": 1, "borderRadius": 100, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "Best\xE4tigen", "icon": "" }, "english": "Confirm", "cell": 18 }, { "stage": "stage_super_admin_detail", "obj": { "className": "TButton", "id": "cms_button-50e29d98-b76d-4c44-96bb-f85066324e96", "name": "Abbrechen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Aktion_Abbrechen" }, "visible": false, "x": 53.45454545454545, "y": 9, "width": 8.545454545454545, "height": 2.5, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#d6f1ec", "fontSize": 17, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "bold", "textAlign": "center", "backgroundColor": "transparent", "borderColor": "#5fa99f", "borderWidth": 1, "borderRadius": 100, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "Abbrechen", "icon": "" }, "english": "Cancel", "cell": 18 }, { "stage": "stage_super_admin_detail", "obj": { "className": "TButton", "id": "cms_button-dfd6084c-f426-4949-b548-16bf017d3c9c", "name": "ProfilSpeichern", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Sperre_ProfilSpeichern" }, "visible": true, "x": 50.25, "y": 14.45, "width": 10.681818181818182, "height": 2.8, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#062a26", "fontSize": 17, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "bold", "textAlign": "center", "backgroundColor": "#14b8a6", "borderColor": "#14b8a6", "borderWidth": 1, "borderRadius": 9, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "Speichern", "icon": "" }, "english": "Save", "cell": 18 }, { "stage": "stage_house_rooms", "obj": { "className": "TButton", "id": "cms_obj-a1e9819d-c61c-4f4d-9205-3c53fdaefab9", "name": "RaumAnlegen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Raum_Anlegen" }, "visible": true, "x": 43, "y": 33, "width": 9, "height": 2.8, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Anlegen", "icon": "" }, "english": "Create", "cell": 18 }, { "stage": "stage_house_residents", "obj": { "className": "TButton", "id": "cms_obj-dfd911cf-a5a0-483b-9646-08b4aa6ceac0", "name": "AnlageBildWaehlen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "AnlageBild_Waehlen" }, "visible": true, "x": 20.8, "y": 32.1, "width": 9.8, "height": 2.2, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "\u{1F4C1} Bild hochladen", "icon": "" }, "english": "\u{1F4C1} Upload image", "cell": 18 }, { "stage": "stage_house_residents", "obj": { "className": "TButton", "id": "cms_obj-8fed8f0c-87ad-4faa-8e9b-557ecb9fbe65", "name": "AnlageBildEntfernen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "AnlageBild_Entfernen" }, "visible": false, "x": 31, "y": 32.1, "width": 6.2, "height": 2.2, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "\u2715 Entfernen", "icon": "" }, "english": "\u2715 Remove", "cell": 18 }, { "stage": "stage_house_residents", "obj": { "className": "TButton", "id": "cms_obj-586978ba-c256-4adb-96c2-d8fb4d13f6a2", "name": "PasswortZuruecksetzen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Passwort_Zuruecksetzen" }, "visible": true, "x": 51.6, "y": 40.7, "width": 9.4, "height": 2.3, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "\u21BA Zur\xFCcksetzen", "icon": "" }, "english": "\u21BA Reset", "cell": 18 }, { "stage": "stage_house_residents", "obj": { "className": "TButton", "id": "cms_obj_d9633f15-6d7e-44db-bb78-527ca8c5bd77", "name": "AvatarAbbrechen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "BewAvatar_Abbrechen" }, "visible": true, "x": 43, "y": 20.4, "width": 10, "height": 2.4, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 17, "fontFamily": "Segoe UI, system-ui, sans-serif", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Abbrechen", "icon": "" }, "english": "Cancel", "cell": 18 }, { "stage": "stage_house_families", "obj": { "className": "TButton", "id": "cms_obj-ba18734e-825b-43fe-855c-9c24855a967e", "name": "FamilieBestaetigen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Familie_Bestaetigen" }, "visible": true, "x": 52, "y": 43.6, "width": 10, "height": 2.8, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Zuordnung best\xE4tigen", "icon": "" }, "english": "Confirm assignment", "cell": 18 }, { "stage": "stage_multiplayer_inbox", "obj": { "className": "TButton", "id": "cms_obj-8494517e-09aa-460b-96c8-88af050b15a7", "name": "EinladungAblehnen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Einladung_Ablehnen" }, "visible": true, "x": 16, "y": 37, "width": 9, "height": 3, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#f0a8b4", "fontSize": 17, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "textAlign": "center", "backgroundColor": "#3a1d24", "borderColor": "#5c2a34", "borderWidth": 1, "borderRadius": 9, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "Ablehnen", "icon": "" }, "english": "Decline", "cell": 18 }, { "stage": "stage_house_resident_detail", "obj": { "className": "TButton", "id": "cms_obj-117366d4-35fa-42a0-ba56-c485007462b1", "name": "Back", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "BewohnerZurueck" }, "visible": true, "x": 15, "y": 9, "width": 10, "height": 2.8, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "\u2190 Zur\xFCck", "icon": "" }, "english": "\u2190 Back", "cell": 18 }, { "stage": "stage_house_resident_detail", "obj": { "className": "TButton", "id": "cms_obj-0f30d8ac-393b-4e18-9da4-2a96b73f77bc", "name": "Confirm", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "BewohnerBestaetigen" }, "visible": false, "x": 42, "y": 9, "width": 10, "height": 2.8, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#2fa79b", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Best\xE4tigen", "icon": "" }, "english": "Confirm", "cell": 18 }, { "stage": "stage_house_resident_detail", "obj": { "className": "TButton", "id": "cms_obj-bf49be0a-933d-4013-b9d4-22b891383f60", "name": "Abbrechen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "BewohnerAbbrechen" }, "visible": false, "x": 53, "y": 9, "width": 9, "height": 2.8, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Abbrechen", "icon": "" }, "english": "Cancel", "cell": 18 }, { "stage": "stage_house_resident_detail", "obj": { "className": "TButton", "id": "cms_obj-e19e3301-a7e3-482d-921c-b73c6be65881", "name": "ProfilSpeichern", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "BewohnerProfil_Speichern" }, "visible": true, "x": 52, "y": 14.7, "width": 9, "height": 2.8, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Profil speichern", "icon": "" }, "english": "Save profile", "cell": 18 }, { "stage": "stage_house_resident_detail", "obj": { "className": "TButton", "id": "cms_obj-a549a31f-3f12-4460-9ac3-9ea9f302ed5a", "name": "CodeZuruecksetzen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Code_Zuruecksetzen" }, "visible": true, "x": 50.1, "y": 34.4, "width": 10.9, "height": 2.3, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "\u21BA Zur\xFCcksetzen", "icon": "" }, "english": "\u21BA Reset", "cell": 18 }, { "stage": "stage_house_resident_detail", "obj": { "className": "TButton", "id": "cms_obj_e1dc594d-67f4-48ae-b1c4-4786d7e98df2", "name": "BildAbbrechen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Bild_Abbrechen" }, "visible": true, "x": 52, "y": 17.6, "width": 9, "height": 2.6, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 17, "fontFamily": "Segoe UI, system-ui, sans-serif", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Abbrechen", "icon": "" }, "english": "Cancel", "cell": 18 }, { "stage": "stage_house_room_detail", "obj": { "className": "TButton", "id": "cms_obj-644fad50-7c60-4443-a2dc-72c12b2a15e5", "name": "Back", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "RaumZurueck" }, "visible": true, "x": 15, "y": 9, "width": 10, "height": 2.8, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "\u2190 Zur\xFCck", "icon": "" }, "english": "\u2190 Back", "cell": 18 }, { "stage": "stage_house_room_detail", "obj": { "className": "TButton", "id": "cms_obj-a37dc35a-406d-4992-82a0-4ea158ceabb1", "name": "Confirm", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "RaumBestaetigen" }, "visible": false, "x": 42, "y": 9, "width": 10, "height": 2.8, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#2fa79b", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Best\xE4tigen", "icon": "" }, "english": "Confirm", "cell": 18 }, { "stage": "stage_house_room_detail", "obj": { "className": "TButton", "id": "cms_obj-348a0d0e-f7a4-4d4d-b340-5f27d48f395c", "name": "Abbrechen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "RaumAbbrechen" }, "visible": false, "x": 53, "y": 9, "width": 9, "height": 2.8, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Abbrechen", "icon": "" }, "english": "Cancel", "cell": 18 }, { "stage": "stage_house_room_detail", "obj": { "className": "TButton", "id": "cms_obj-6fa6a40d-9be3-447e-8cb7-545b111600b8", "name": "ProfilSpeichern", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "RaumProfil_Speichern" }, "visible": true, "x": 52, "y": 14.5, "width": 9, "height": 2.8, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Profil speichern", "icon": "" }, "english": "Save profile", "cell": 18 }, { "stage": "stage_child_room_access", "obj": { "className": "TButton", "id": "cms_obj-145e2e02-aa63-4e67-9856-7775da0848d2", "name": "Abbrechen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Zutritt_Abbrechen" }, "visible": false, "x": 48, "y": 37, "width": 12, "height": 3, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 17, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "textAlign": "center", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 100, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "Abbrechen", "icon": "" }, "english": "Cancel", "cell": 18 }, { "stage": "stage_child_activity", "obj": { "className": "TButton", "id": "cms_button-fd7d484c-865f-4482-a3ef-b52945e12cc1", "name": "Zurueck", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Navigation_stage_parent" }, "visible": true, "x": 50, "y": 4, "width": 10, "height": 2, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#cbd5e1", "fontSize": 26, "fontWeight": "bold", "textAlign": "center", "backgroundColor": "#13222e", "borderColor": "#22394a", "borderWidth": 2, "borderRadius": 9, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "\u2190 Zur\xFCck", "icon": "" }, "english": "\u2190 Back", "cell": 18 }, { "stage": "stage_child_rooms", "obj": { "className": "TButton", "id": "cms_button-9069d971-11c3-4550-ad4f-4a21076bc34c", "name": "Zurueck", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Navigation_stage_parent" }, "visible": true, "x": 50, "y": 4, "width": 10, "height": 2, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#cbd5e1", "fontSize": 26, "fontWeight": "bold", "textAlign": "center", "backgroundColor": "#13222e", "borderColor": "#22394a", "borderWidth": 2, "borderRadius": 9, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "\u2190 Zur\xFCck", "icon": "" }, "english": "\u2190 Back", "cell": 18 }, { "stage": "stage_child_budget", "obj": { "className": "TButton", "id": "cms_button-eb653118-375f-4e77-b3e3-fb29382bb10d", "name": "Zurueck", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Navigation_stage_parent" }, "visible": true, "x": 50, "y": 4, "width": 10, "height": 2, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#cbd5e1", "fontSize": 26, "fontWeight": "bold", "textAlign": "center", "backgroundColor": "#13222e", "borderColor": "#22394a", "borderWidth": 2, "borderRadius": 9, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "\u2190 Zur\xFCck", "icon": "" }, "english": "\u2190 Back", "cell": 18 }, { "stage": "stage_super_houses", "obj": { "className": "TButton", "id": "cms_button-63a11abd-75f7-4afb-84bf-a2856a8f3f65", "name": "HausAnlegen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Sperre_HausAnlegen" }, "visible": true, "x": 39, "y": 33, "width": 10, "height": 3, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#062a26", "fontSize": 26, "fontWeight": "bold", "textAlign": "center", "backgroundColor": "#14b8a6", "borderColor": "#14b8a6", "borderWidth": 2, "borderRadius": 9, "boxShadow": "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }, "text": "Anlegen", "icon": "" }, "english": "Create", "cell": 18 }, { "stage": "stage_parent_sponsors", "obj": { "className": "TButton", "id": "cms_obj-36725e8e-aa3a-42cf-9095-be63076bdc41", "name": "AnfrageAblehnen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Anfrage_Ablehnen" }, "visible": true, "x": 36, "y": 36.6, "width": 12, "height": 2.8, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Ablehnen", "icon": "" }, "english": "Decline", "cell": 18 }, { "stage": "stage_parent_sponsor_detail", "obj": { "className": "TButton", "id": "cms_obj-0ab87ab9-41ea-45e3-863d-b132da744405", "name": "SichtAblehnen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Sicht_Ablehnen" }, "visible": true, "x": 49, "y": 21.6, "width": 13, "height": 2.6, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Ablehnen", "icon": "" }, "english": "Decline", "cell": 18 }, { "stage": "stage_parent_sponsor_detail", "obj": { "className": "TButton", "id": "cms_obj-e8cbb774-44e7-4e15-8ebd-a69d28514a3c", "name": "VertragAblehnen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Vertrag_Ablehnen" }, "visible": true, "x": 28, "y": 34, "width": 12, "height": 2.6, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Ablehnen", "icon": "" }, "english": "Decline", "cell": 18 }, { "stage": "stage_child_sponsors", "obj": { "className": "TButton", "id": "cms_obj-331df124-ec3c-4f16-b493-2198298200e4", "name": "Ablehnen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Begleitung_Ablehnen" }, "visible": true, "x": 15, "y": 19.2, "width": 12, "height": 2.8, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Ablehnen", "icon": "" }, "english": "Decline", "cell": 18 }, { "stage": "stage_parent_child_profile", "obj": { "className": "TButton", "id": "f1936ee9-e45b-4263-b4f4-23df53752d77", "name": "ProfilSpeichern", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "BewohnerProfil_Speichern" }, "visible": false, "x": 41, "y": 14.7, "width": 9, "height": 2.8, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Profil speichern", "icon": "" }, "english": "Save profile", "cell": 18 }, { "stage": "stage_parent_child_profile", "obj": { "className": "TButton", "id": "44f19879-c80e-4d57-9fe1-990334a5a876", "name": "CodeZuruecksetzen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Code_Zuruecksetzen" }, "visible": false, "x": 39.1, "y": 27.4, "width": 10.9, "height": 2.3, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 18, "fontFamily": "Segoe UI, system-ui, sans-serif", "fontWeight": "700", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "\u21BA Zur\xFCcksetzen", "icon": "" }, "english": "\u21BA Reset", "cell": 18 }, { "stage": "stage_parent_child_profile", "obj": { "className": "TButton", "id": "cb41a18f-24f8-4359-abee-a0dd81ed0e6d", "name": "BildAbbrechen", "scope": "stage", "draggable": false, "droppable": false, "dragMode": "move", "events": { "onClick": "Bild_Abbrechen" }, "visible": true, "x": 41, "y": 17.6, "width": 9, "height": 2.6, "zIndex": 0, "rotation": 0, "align": "NONE", "collisionEnabled": false, "protectFromOverlay": false, "style": { "color": "#eefafa", "fontSize": 17, "fontFamily": "Segoe UI, system-ui, sans-serif", "backgroundColor": "#1d4656", "borderColor": "#58bdb2", "borderWidth": 1, "borderRadius": 10 }, "text": "Abbrechen", "icon": "" }, "english": "Cancel", "cell": 18 }];
  var ctx = { host: { runMode: true, onEvent: () => {
  } }, scaleFontSize: (v) => v + "px" };
  var checks = [];
  var label = document.createElement("div");
  document.body.append(label);
  TextObjectRenderer.renderLabel(ctx, label, { text: "Anmelden" });
  label.innerHTML = "<font>Sign in</font>";
  TextObjectRenderer.renderLabel(ctx, label, { text: "Anmelden" });
  checks.push({ test: "Label after external translation and unchanged rerender", actual: label.innerText, translationOverwritten: label.innerText === "Anmelden" });
  label.remove();
  var button = document.createElement("div");
  document.body.append(button);
  TextObjectRenderer.renderButton(ctx, button, { text: "Anmelden" }, true);
  button.querySelector(".btn-text").innerHTML = "<font>Sign in</font>";
  TextObjectRenderer.renderButton(ctx, button, { text: "Anmelden" }, false);
  checks.push({ test: "Button after external translation and unchanged rerender", actual: button.innerText, translationOverwritten: button.innerText === "Anmelden" });
  button.remove();
  var clicked = false;
  var click = document.createElement("div");
  document.body.append(click);
  TextObjectRenderer.renderButton({ ...ctx, host: { runMode: true, onEvent: () => clicked = true } }, click, { id: "login", text: "Anmelden" }, true);
  click.querySelector(".btn-text").innerHTML = "<font>Sign in</font>";
  click.querySelector("font").click();
  checks.push({ test: "Click on translated nested button text", passed: clicked });
  click.remove();
  var updated = document.createElement("div");
  document.body.append(updated);
  TextObjectRenderer.renderLabel(ctx, updated, { text: "Anmelden" });
  updated.innerHTML = "<font>Sign in</font>";
  TextObjectRenderer.renderLabel(ctx, updated, { text: "Abmelden" });
  checks.push({ test: "Changed label source still updates", passed: updated.innerText === "Abmelden" });
  updated.remove();
  var fresh = document.createElement("div");
  document.body.append(fresh);
  TextObjectRenderer.renderLabel(ctx, fresh, { text: "Anmelden" });
  checks.push({ test: "Fresh stage elements initialize with source", passed: fresh.innerText === "Anmelden" });
  fresh.remove();
  var results = [];
  for (const s of samples) {
    const el = document.createElement("div");
    el.style.cssText = "position:absolute;left:-10000px;display:flex;box-sizing:border-box;overflow:hidden;align-items:center;justify-content:center;padding:4px;font-family:Segoe UI,sans-serif;";
    el.style.width = s.obj.width * s.cell + "px";
    el.style.height = s.obj.height * s.cell + "px";
    document.body.append(el);
    TextObjectRenderer.renderButton(ctx, el, s.obj, true);
    const measure = () => ({ width: el.clientWidth, height: el.clientHeight, scrollWidth: el.scrollWidth, scrollHeight: el.scrollHeight, clipped: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1 });
    const de = measure();
    el.querySelector(".btn-text").textContent = s.english;
    const en = measure();
    results.push({ stage: s.stage, text: s.obj.text, english: s.english, de, en });
    el.remove();
  }
  var result = { note: "Controlled DOM-translation simulation, not Google Translate. Layout uses source dimensions, Segoe UI and 4px padding; no theme/inheritance resolution.", checks, sampleCount: results.length, newEnglishOverflows: results.filter((r) => !r.de.clipped && r.en.clipped), existingOverflows: results.filter((r) => r.de.clipped) };
  var pre = document.createElement("pre");
  pre.id = "results";
  pre.textContent = JSON.stringify(result, null, 2);
  document.body.append(pre);
})();
/*! Bundled license information:

dompurify/dist/purify.es.mjs:
  (*! @license DOMPurify 3.4.9 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.9/LICENSE *)
*/
