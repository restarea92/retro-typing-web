/** Assemble a private local/server runtime. Never fetches or packages the original DOS program. */
import {readFile,writeFile,mkdir,copyFile,readdir,cp} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const source=dirname(fileURLToPath(import.meta.url)),input=resolve(process.argv[2]||''),out=resolve(process.argv[3]||'');
if(process.argv.length<4||input===out)throw new Error('Usage: node prepare-runtime.mjs <complete 1999 static runtime> <separate output directory>');
await mkdir(join(out,'qa'),{recursive:true});
const excluded=new Set(['prepare-runtime.mjs','web-hook.js.txt','web-hook.js','package.json','fetch-vendor.mjs','fetch-dos-vendor.mjs','vendor-sources.json']);
for(const entry of await readdir(source,{withFileTypes:true})){if(excluded.has(entry.name)||entry.name.endsWith('.test.mjs'))continue;await cp(join(source,entry.name),join(out,'qa',entry.name),{recursive:true});}
for(const entry of await readdir(input,{withFileTypes:true})){if(!entry.isFile()||!/\.(js|html|css|woff|png)$/.test(entry.name))continue;await copyFile(join(input,entry.name),join(out,entry.name));}
const app=await readFile(join(out,'app.js'),'utf8');
const hook=await readFile(join(source,'web-hook.js.txt'),'utf8').catch(()=>readFile(join(source,'web-hook.js'),'utf8'));
if(app.includes('QA input adapter failed to load')&&!app.endsWith(hook))throw new Error('Input runtime contains a different QA hook; rebuild from the matching baseline.');
await writeFile(join(out,'app.js'),app.endsWith(hook)?app:app+hook);
const files=[];async function walk(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){const rel=prefix+entry.name;if(entry.isDirectory()){await walk(join(dir,entry.name),rel+'/');continue;}const data=await readFile(join(dir,entry.name));files.push({file:rel,size:data.length,sha1:createHash('sha1').update(data).digest('hex'),sha256:createHash('sha256').update(data).digest('hex')});}}
await walk(out);await writeFile(join(out,'..','runtime-manifest.json'),JSON.stringify({originalDosBundled:false,files},null,2));
console.log(`QA runtime: ${out}; open /qa/. DOS executable/bundle intentionally absent: select your own local file.`);
