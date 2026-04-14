import { TButton } from './src/components/TButton';
const btn = new TButton('Btn', 0, 0, 10, 10);
btn.text = '${Map.Test}';
console.log('Keys of btn:', Object.keys(btn));
