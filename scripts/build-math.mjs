import {build} from 'esbuild';
await build({entryPoints:['src/math/MathCore.ts'],bundle:true,platform:'node',format:'cjs',target:'node22',outfile:'scripts/cms/generated/math-core.cjs',logLevel:'silent'});
await build({entryPoints:['src/utils/AnswerChoices.ts'],bundle:true,platform:'node',format:'cjs',target:'node22',outfile:'scripts/cms/generated/card-choice.cjs',logLevel:'silent'});
