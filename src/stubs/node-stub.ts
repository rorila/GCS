// Leeres Browser-Stub-Modul für Node.js Built-ins
// Wird als Alias für fs, fs/promises, path, etc. verwendet
export default {};
export const readFile = () => Promise.reject('not in browser');
export const writeFile = () => Promise.reject('not in browser');
export const readFileSync = () => { throw new Error('not in browser'); };
export const writeFileSync = () => { throw new Error('not in browser'); };
export const existsSync = () => false;
export const join = (...args: string[]) => args.join('/');
export const resolve = (...args: string[]) => args.join('/');
export const dirname = (p: string) => p;
export const basename = (p: string) => p;
