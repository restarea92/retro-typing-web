/** Asset-free safety tests. Successful native patch/oracle verification requires
 * the privately supplied, SHA-256-verified executable; see RNG-ALIGNMENT.md. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/make-rng-qa-copy.py',import.meta.url));
function python(body){
 const result=spawnSync('python3',['-B','-c',`import runpy,sys,pathlib,tempfile,zipfile\nm=runpy.run_path(sys.argv[1])\n${body}`,script],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));
}
test('QA copy refuses invalid seeds and unverified executable bytes',()=>python(`
for seed in [-1,65536,1.5,True]:
 try:m['patch_executable'](b'not the original',seed)
 except ValueError as e:assert 'seed' in str(e)
 else:raise AssertionError('invalid seed accepted')
try:m['patch_executable'](b'not the original',12345)
except ValueError as e:assert 'SHA256' in str(e)
else:raise AssertionError('unverified bytes accepted')
`));
test('QA copy refuses unsafe archive paths before extraction',()=>python(`
with tempfile.TemporaryDirectory() as directory:
 source=pathlib.Path(directory)/'source.zip'
 with zipfile.ZipFile(source,'w') as z:z.writestr('../HTTD.EXE',b'fixture')
 try:m['prepare'](source,12345)
 except ValueError as e:assert 'Unsafe archive path' in str(e)
 else:raise AssertionError('unsafe archive accepted')
`));
test('QA copy CLI never overwrites original or an existing output',()=>python(`
import subprocess
with tempfile.TemporaryDirectory() as directory:
 source=pathlib.Path(directory)/'source.exe';source.write_bytes(b'preserve source')
 output=pathlib.Path(directory)/'HTTD-QA-FIXED-SEED-12345.exe';output.write_bytes(b'preserve output')
 for destination in [source,output]:
  result=subprocess.run([sys.executable,'-B',sys.argv[1],str(source),str(destination),'--seed','12345'],capture_output=True)
  assert result.returncode!=0
 assert source.read_bytes()==b'preserve source' and output.read_bytes()==b'preserve output'
 assert not output.with_name(output.name+'.manifest.json').exists()
`));
