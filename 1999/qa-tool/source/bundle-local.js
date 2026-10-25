/** Browser-local, bounded original archive conversion. No upload or RNG changes. */
export const MAX_ARCHIVE_BYTES=32*1024*1024,MAX_EXPANDED_BYTES=64*1024*1024;
export const DOSBOX_CONF='[sdl]\nautolock=false\n[dosbox]\nmachine=svga_s3\nmemsize=16\n[cpu]\ncycles=10000\n[ipx]\nipx=false\n[autoexec]\n@echo off\nmount c .\nc:\nHTTD.EXE\n';
export function validateZipDirectory(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength>MAX_ARCHIVE_BYTES||bytes.byteLength<22)throw new Error('ZIP 크기는 32 MiB 이하여야 합니다.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw new Error('올바른 ZIP 또는 .jsdos 파일이 아닙니다.');
 const count=v.getUint16(end+10,true),offset=v.getUint32(end+16,true);
 if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||count===65535||count>5000||offset===0xffffffff)throw new Error('분할 ZIP/ZIP64 또는 너무 많은 파일은 지원하지 않습니다.');
 let p=offset,total=0;const names=[];
 for(let i=0;i<count;i++){
  if(p+46>bytes.length||v.getUint32(p,true)!==0x02014b50)throw new Error('ZIP 파일 목록이 손상되었습니다.');
  if(v.getUint16(p+8,true)&1)throw new Error('암호 ZIP은 지원하지 않습니다.');
  const size=v.getUint32(p+24,true),len=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true);total+=size;
  if(size===0xffffffff||total>MAX_EXPANDED_BYTES)throw new Error('압축 해제 크기는 64 MiB 이하여야 합니다.');
  if(p+46+len+extra+comment>bytes.length)throw new Error('ZIP 파일 목록이 손상되었습니다.');
  const name=new TextDecoder().decode(bytes.subarray(p+46,p+46+len)).replaceAll('\\','/');
  if(name.startsWith('/')||name.split('/').includes('..')||/^[A-Za-z]:/.test(name))throw new Error('안전하지 않은 ZIP 경로입니다.');
  names.push(name);p+=46+len+extra+comment;
 }
 return {count,total,names};
}
export function selectOriginalFiles(entries){
 const paths=Object.keys(entries),exe=paths.find(n=>/(^|\/)HTTD\.EXE$/i.test(n));
 if(!exe)throw new Error('HTTD.EXE가 포함된 1999 원본 ZIP/.jsdos를 선택하세요.');
 const prefix=exe.slice(0,exe.length-8),out={};out['HTTD.EXE']=entries[exe];
 for(const n of paths){if(!n.startsWith(prefix))continue;const rel=n.slice(prefix.length).replaceAll('\\','/');if(/^APP\/HNCTT\//i.test(rel)&&!rel.endsWith('/'))out[rel]=entries[n];}
 if(!Object.keys(out).some(n=>/^APP\/HNCTT\/WORD\.KOR$/i.test(n)))throw new Error('APP/HNCTT 연습 자료가 없습니다.');
 // libzip's Emscripten extraction requires explicit parent directory entries.
 for(const path of Object.keys(out)){const parts=path.split('/');for(let i=1;i<parts.length;i++)out[parts.slice(0,i).join('/')+'/']=new Uint8Array();}
 out['.jsdos/']=new Uint8Array();
 out['.jsdos/dosbox.conf']=new TextEncoder().encode(DOSBOX_CONF);
 return out;
}
export async function prepareLocalBundle(file,{unzipSync,zipSync}={}){
 if(!file||typeof file.arrayBuffer!=='function')throw new TypeError('로컬 ZIP/.jsdos 파일을 선택하세요.');
 if(file.size>MAX_ARCHIVE_BYTES)throw new Error('ZIP 크기는 32 MiB 이하여야 합니다.');
 const bytes=new Uint8Array(await file.arrayBuffer());validateZipDirectory(bytes);
 if(!unzipSync||!zipSync)throw new Error('ZIP 처리 모듈이 준비되지 않았습니다.');
 const selected=selectOriginalFiles(unzipSync(bytes));return new Blob([zipSync(Object.fromEntries(Object.entries(selected).sort(([a],[b])=>a.split('/').length-b.split('/').length||a.localeCompare(b))),{level:0})],{type:'application/zip'});
}
