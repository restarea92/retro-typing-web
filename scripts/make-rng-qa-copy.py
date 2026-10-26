#!/usr/bin/env python3
"""Make a clearly labeled LOCAL-ONLY fixed-reseed QA copy; never edit the source.
No original executable or resources are supplied or downloaded by this tool.
"""
import argparse,hashlib,io,json,pathlib,struct,zipfile
ORIGINAL_SHA256='8eaf841b5af1810687b26b7b07c16de0e2d434546c19c6088d31a228fb38d1f5'
PATCH_OFFSET=0x48cf
EXPECTED_INSTRUCTION=bytes.fromhex('8b4606')
MAX_ARCHIVE=32*1024*1024
MAX_EXPANDED=64*1024*1024

def sha(data):return hashlib.sha256(data).hexdigest()
def patch_executable(original,seed):
 if type(seed)is not int or not 0<=seed<=65535:raise ValueError('QA seed must be an integer0..65535')
 if sha(original)!=ORIGINAL_SHA256:raise ValueError('Original executable SHA256 does not match the verified1999 release')
 if original[PATCH_OFFSET:PATCH_OFFSET+3]!=EXPECTED_INSTRUCTION:raise ValueError('Original srand instruction differs')
 patched=original[:PATCH_OFFSET]+b'\xb8'+struct.pack('<H',seed)+original[PATCH_OFFSET+3:]
 assert patched[:PATCH_OFFSET]==original[:PATCH_OFFSET] and patched[PATCH_OFFSET+3:]==original[PATCH_OFFSET+3:]
 return patched,{'label':'LOCAL QA COPY — NOT THE ORIGINAL — FIXED RESEED','qaSeed':seed,'initialState':1,'sourceSha256':sha(original),'patchedSha256':sha(patched),'fileSize':len(original),'patch':{'fileOffset':'0x48cf','length':3,'beforeHex':EXPECTED_INSTRUCTION.hex(),'afterHex':patched[PATCH_OFFSET:PATCH_OFFSET+3].hex(),'meaning':'srand: load immediate16-bit seed instead of caller argument; same3-byte instruction length'},'outsidePatchSha256':sha(original[:PATCH_OFFSET]+original[PATCH_OFFSET+3:]),'changedOffsets':[hex(i)for i,(a,b)in enumerate(zip(original,patched))if a!=b],'unchangedOutsidePatch':True,'warning':'Only RNG reseeds are fixed. Timing, input delivery, call order, vocabulary and gameplay are NOT synchronized. Use web?qa=1&qaRngSeed='+str(seed)}

def prepare(source,seed):
 raw=source.read_bytes()
 if source.suffix.lower() in ('.zip','.jsdos'):
  if len(raw)>MAX_ARCHIVE:raise ValueError('Archive exceeds32MiB')
  with zipfile.ZipFile(io.BytesIO(raw))as z:
   infos=z.infolist()
   if len(infos)>5000 or sum(i.file_size for i in infos)>MAX_EXPANDED:raise ValueError('Archive expands beyond allowed limit')
   entries={}
   for i in infos:
    name=i.filename.replace('\\','/')
    if name.startswith('/')or'..'in name.split('/')or':'in name:raise ValueError('Unsafe archive path')
    if not i.is_dir():
     if name in entries:raise ValueError('Duplicate archive path')
     entries[name]=z.read(i)
  names=[n for n in entries if n.rsplit('/',1)[-1].upper()=='HTTD.EXE']
  if len(names)!=1:raise ValueError('Archive must contain exactly one HTTD.EXE')
  name=names[0];prefix=name[:-8];patched,report=patch_executable(entries[name],seed)
  selected={'HTTD.EXE':patched}
  for n,data in entries.items():
   if n.startswith(prefix)and n[len(prefix):].upper().startswith('APP/HNCTT/'):selected[n[len(prefix):]]=data
  if not any(n.upper()=='APP/HNCTT/WORD.KOR'for n in selected):raise ValueError('Archive lacks APP/HNCTT/WORD.KOR')
  selected['QA-FIXED-SEED.json']=json.dumps(report,ensure_ascii=False,indent=2).encode()
  # The common QA loader uses its own dosbox.conf and ignores this report.
  out=io.BytesIO()
  with zipfile.ZipFile(out,'w',zipfile.ZIP_STORED)as z:
   for n,data in selected.items():z.writestr(n,data)
  report['sourceArchiveSha256']=sha(raw);report['archiveSha256']=sha(out.getvalue());return out.getvalue(),report
 return patch_executable(raw,seed)

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=pathlib.Path);p.add_argument('output',type=pathlib.Path,help='New filename containing QA-FIXED-SEED-<seed>; existing files refused');p.add_argument('--seed',type=int,required=True);args=p.parse_args()
 if args.source.resolve()==args.output.resolve():p.error('Refusing to overwrite original source')
 if 'QA-FIXED-SEED-'+str(args.seed)not in args.output.name.upper():p.error('Output name must contain QA-FIXED-SEED-<seed>')
 manifest=args.output.with_name(args.output.name+'.manifest.json')
 if args.output.exists()or manifest.exists():p.error('Output or manifest already exists; choose a new path')
 try:
  before=sha(args.source.read_bytes());data,report=prepare(args.source,args.seed)
  if sha(args.source.read_bytes())!=before:raise ValueError('Source changed during preparation')
  report['sourceFileSha256']=before;report['sourceUnchanged']=True
  with args.output.open('xb')as f:f.write(data)
  with manifest.open('x')as f:json.dump(report,f,ensure_ascii=False,indent=2)
  print(json.dumps({'output':str(args.output),'manifest':str(manifest),'qaSeed':args.seed,'originalUnchanged':True,'patchedSha256':report['patchedSha256']},indent=2))
 except(ValueError,OSError,zipfile.BadZipFile)as error:p.error(str(error))
if __name__=='__main__':main()
