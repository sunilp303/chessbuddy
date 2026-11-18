import {copyFile,mkdir,writeFile} from 'node:fs/promises';

const directory=new URL('../dist/stockfish/',import.meta.url);
const packageRoot=new URL('../node_modules/stockfish/',import.meta.url);
await mkdir(directory,{recursive:true});
for(const file of [
  'src/stockfish-17.1-lite-single-03e3232.js',
  'src/stockfish-17.1-lite-single-03e3232.wasm',
  'Copying.txt',
  'AUTHORS'
]){
  await copyFile(new URL(file,packageRoot),new URL(file.split('/').at(-1),directory));
}
await writeFile(new URL('SOURCE.txt',directory),
  'Stockfish.js 17.1.0 (lite, single-threaded), GPLv3. See Copying.txt and AUTHORS.\n'+
  'Corresponding source and build scripts: https://github.com/nmrugg/stockfish.js/tree/v17.1.0\n');
