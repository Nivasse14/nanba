#!/usr/bin/env python3
"""Private operations for the Nanba pilot. Credentials are read from non-echoing stdin.
Input JSON: {setupKey, operation: status|upload|templates|diagnostic|verify_images}.
No real WhatsApp message is sent by this script or the diagnostic endpoint.
"""
import json,sys,termios,urllib.request,urllib.parse,urllib.error,pathlib
if sys.stdin.isatty():
 attrs=termios.tcgetattr(sys.stdin.fileno()); private=termios.tcgetattr(sys.stdin.fileno()); private[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,private)
print('Ready for private input.',flush=True)
config=json.loads(sys.stdin.readline())
if sys.stdin.isatty():termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,attrs)
base='https://nanba-ensemble-pilot-ufgg.onrender.com'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
opener=urllib.request.build_opener(NoRedirect)
def call(path,data=None,mime='application/json',private=True):
 headers={'Content-Type':mime}
 if private:headers['X-Nanba-Setup-Key']=config['setupKey']
 req=urllib.request.Request(base+path,data=data,headers=headers,method='POST' if data is not None else 'GET')
 try:
  with opener.open(req,timeout=180) as r:
   result=r.read()
   return json.loads(result) if 'json' in r.headers.get('Content-Type','') else {'bytes':len(result),'mime':r.headers.get('Content-Type')}
 except urllib.error.HTTPError as e:
  print(json.dumps({'httpError':e.code,'path':path.split('?')[0],'detail':e.read().decode()[:350]}),flush=True)
  raise SystemExit(2)
operation=config['operation']
if operation=='status': print(json.dumps(call('/api/twilio/setup'),ensure_ascii=False),flush=True)
elif operation=='templates':print(json.dumps(call('/api/twilio/templates',b'{}'),ensure_ascii=False),flush=True)
elif operation in ['diagnostic_features','diagnostic_voice']:
 result=call('/api/twilio/diagnostic?mode='+('voice' if operation=='diagnostic_voice' else 'features'),b'{}')
 import base64
 folder=pathlib.Path('/tmp/nanba-live-qa');folder.mkdir(exist_ok=True)
 for i,f in enumerate(result.pop('files',[])):
  suffix='.pdf' if f['mime']=='application/pdf' else '.mp3'
  target=folder/(str(i)+suffix);target.write_bytes(base64.b64decode(f['base64']));print(json.dumps({'saved':str(target),'kind':f['kind'],'bytes':target.stat().st_size}),flush=True)
 print(json.dumps(result,ensure_ascii=False),flush=True)
elif operation=='diagnostic_horoscope':print(json.dumps(call('/api/twilio/diagnostic?mode=horoscope',b'{}'),ensure_ascii=False),flush=True)
elif operation=='diagnostic_routines':print(json.dumps(call('/api/twilio/diagnostic?mode=routines',b'{}'),ensure_ascii=False),flush=True)
elif operation=='diagnostic_presence':print(json.dumps(call('/api/twilio/diagnostic?mode=presence',b'{}')),flush=True)
elif operation=='diagnostic':print(json.dumps(call('/api/twilio/diagnostic',b'{}'),ensure_ascii=False),flush=True)
elif operation=='upload':
 root=pathlib.Path(__file__).resolve().parents[2]
 files=sorted((root/'nanba-family-images').glob('*.png'))
 assert len(files)==12
 languages=['fr','ta','fr','fr','en','fr','ta','ta','ta','fr','fr','ta']
 manifest=[]
 for i,p in enumerate(files):
  metadata={'style':'family','language':languages[i],'title':'Bonne journée en famille' if languages[i]=='fr' else 'Family greetings','days':''}
  r=call('/api/twilio/image-upload?'+urllib.parse.urlencode(metadata),p.read_bytes(),'image/png');manifest.append({'file':p.name,**metadata,**r});print(json.dumps({'uploaded':i+1,'id':r['id']}),flush=True)
 for name,style in [('Mahalakshmi rayonnante sous l’arche dorée.png','spiritual'),('Terrasse parisienne au coucher du soleil.png','nature')]:
  p=root/'nanba-library-images'/name;metadata={'style':style,'language':'en','title':'Happy Friday','days':'5'}
  r=call('/api/twilio/image-upload?'+urllib.parse.urlencode(metadata),p.read_bytes(),'image/png');manifest.append({'file':p.name,**metadata,**r});print(json.dumps({'uploaded':len(manifest),'id':r['id']}),flush=True)
 target=pathlib.Path(__file__).resolve().parents[1]/'docs/companion-images.json';target.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'totalImages':len(manifest)}),flush=True)
elif operation=='verify_images':
 manifest=json.loads((pathlib.Path(__file__).resolve().parents[1]/'docs/companion-images.json').read_text())
 for item in manifest[int(config.get('start',0)):]:
  r=call('/api/twilio/images/'+item['id'],private=False);print(json.dumps({'id':item['id'],**r}),flush=True)
else:raise SystemExit('Unknown operation')
