import { TSprite } from '../src/components/TSprite';

const sprite = new TSprite('test', 0, 0, 100, 100);
sprite.backgroundImage = './images/Ufos/ufo_transparet.png';

console.log('sprite.backgroundImage:', sprite.backgroundImage);
console.log('toDTO:', sprite.toDTO());
