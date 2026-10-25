import test from 'node:test';import assert from 'node:assert/strict';
import {validateZipDirectory,selectOriginalFiles,prepareLocalBundle,MAX_ARCHIVE_BYTES,MAX_EXPANDED_BYTES,DOSBOX_CONF} from '../source/bundle-local.js';
// Directory-only fixtures exercise validation, not actual decompression.
function directory(names,{size=1,flags=0,disk=0}={}){
 const encoded=names.map(n=>new TextEncoder().encode(n));const length=encoded.reduce((s,n)=>s+46+n.length,0),b=new Uint8Array(length+22),v=new DataView(b.buffer);let p=0;
 for(const n of encoded){v.setUint32(p,0x02014b50,true);v.setUint16(p+8,flags,true);v.setUint32(p+24,size,true);v.setUint16(p+28,n.length,true);b.set(n,p+46);p+=46+n.length;}
 v.setUint32(p,0x06054b50,true);v.setUint16(p+4,disk,true);v.setUint16(p+8,names.length,true);v.setUint16(p+10,names.length,true);v.setUint32(p+12,length,true);v.setUint32(p+16,0,true);return b;
}
test('bounded normal central directory accepted',()=>{const d=validateZipDirectory(directory(['HTTD.EXE','APP/HNCTT/WORD.KOR']));assert.equal(d.count,2);assert.equal(d.total,2);});
test('traversal and absolute drive/archive paths rejected',()=>{for(const name of ['../HTTD.EXE','/HTTD.EXE','C:/HTTD.EXE','APP\\..\\evil'])assert.throws(()=>validateZipDirectory(directory([name])),/경로/);});
test('encrypted/split archives and expanded size overflow rejected',()=>{assert.throws(()=>validateZipDirectory(directory(['A'],{flags:1})),/암호/);assert.throws(()=>validateZipDirectory(directory(['A'],{disk:1})),/분할/);assert.throws(()=>validateZipDirectory(directory(['A'],{size:MAX_EXPANDED_BYTES+1})),/64 MiB/);});
test('bad or excessive archive bytes rejected',()=>{assert.throws(()=>validateZipDirectory(new Uint8Array(2)));assert.throws(()=>validateZipDirectory(new Uint8Array(MAX_ARCHIVE_BYTES+1)));const b=directory(['A']);b[0]=0;assert.throws(()=>validateZipDirectory(b),/손상/);});
test('only executable and known practice directory enter new local bundle',()=>{
 const exe=new Uint8Array([1]),word=new Uint8Array([2]);const out=selectOriginalFiles({'folder/HTTD.EXE':exe,'folder/APP/HNCTT/WORD.KOR':word,'folder/secret.txt':new Uint8Array([3]),'other/APP/HNCTT/WORD.KOR':new Uint8Array([4])});
 assert.equal(out['HTTD.EXE'],exe);assert.equal(out['APP/HNCTT/WORD.KOR'],word);assert.ok(!('secret.txt'in out));assert.ok(!Object.keys(out).some(k=>k.startsWith('other/')));assert.equal(new TextDecoder().decode(out['.jsdos/dosbox.conf']),DOSBOX_CONF);
});
test('missing original executable or practice assets rejected',()=>{assert.throws(()=>selectOriginalFiles({'X.EXE':new Uint8Array()}),/HTTD/);assert.throws(()=>selectOriginalFiles({'HTTD.EXE':new Uint8Array()}),/연습 자료/);});
test('original file input is read locally and only selected bytes reach ZIP encoder',async()=>{
 const bytes=directory(['HTTD.EXE','APP/HNCTT/WORD.KOR']),file={size:bytes.length,arrayBuffer:async()=>bytes.buffer};let encoded;
 const blob=await prepareLocalBundle(file,{unzipSync:()=>({'HTTD.EXE':new Uint8Array([1]),'APP/HNCTT/WORD.KOR':new Uint8Array([2])}),zipSync:x=>(encoded=x,new Uint8Array([0x50,0x4b]))});assert.equal(blob.type,'application/zip');assert.ok(encoded['HTTD.EXE']);
});
