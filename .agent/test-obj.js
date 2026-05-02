class TSprite {
    _backgroundImage = "hello";
    get backgroundImage() {
        return this._backgroundImage;
    }
    set backgroundImage(v) {
        this._backgroundImage = v;
    }
}

const rawObj = new TSprite();

// 1. Object spread (what it was originally)
const obj1 = { ...rawObj, style: {} };
console.log("1. Spread:", obj1.backgroundImage); // undefined!

// 2. Object.create(rawObj) (my previous fix)
const obj2 = Object.create(rawObj);
obj2.style = {};
console.log("2. Object.create:", obj2.backgroundImage); // hello!

// 3. Proxy
const obj3 = new Proxy(rawObj, {
    get(target, prop, receiver) {
        if (prop === 'style') return {};
        return Reflect.get(target, prop, receiver);
    }
});
console.log("3. Proxy:", obj3.backgroundImage); // hello!

// 4. Spread + setPrototypeOf
const obj4 = { ...rawObj, style: {} };
Object.setPrototypeOf(obj4, Object.getPrototypeOf(rawObj));
console.log("4. Spread + setProto:", obj4.backgroundImage); // hello!
