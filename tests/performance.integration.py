"""Local-only performance contract and compatibility checks; no production calls."""
import urllib.request,urllib.error,json
BASE='http://127.0.0.1:8787'
def call(path,body=None,user='local-performance-check'):
 h={'Origin':BASE,'Content-Type':'application/json'}
 if user:h.update({'oai-authenticated-user-id':user,'oai-authenticated-user-email':'performance@example.test'})
 r=urllib.request.Request(BASE+path,headers=h,data=json.dumps(body).encode() if body else None)
 try:
  with urllib.request.urlopen(r) as x:return x.status,json.load(x)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def ok(path,body=None,user='local-performance-check'):
 code,s=call(path,body,user);assert code==200,(code,s);return s
source='# 性能验证\n\n正文 **加粗**\n\n<script>alert(1)</script>'
p=ok('/api/community',{'action':'publish','title':'本地性能回归验证','body':source,'cat':'前端','format':'markdown','tags':['本地测试']})['publishedId']
s=ok('/api/search?article='+str(p)+'&render=1');assert '<strong>加粗</strong>' in s['html'] and '<script>' not in s['html']
assert 'html' not in ok('/api/search?article='+str(p))
for action,key in [('like','liked'),('save','saved')]:
 before=ok('/api/article-state?id='+str(p));compact=ok('/api/community?response=article',{'action':action,'id':p});assert set(compact)=={'articleState'}
 assert compact['articleState']==ok('/api/article-state?id='+str(p));assert compact['articleState'][key]!=before[key]
 full=ok('/api/community',{'action':action,'id':p});assert 'articles' in full and 'pagination' in full
 assert ok('/api/article-state?id='+str(p))[key]==before[key]
 print(action,'compact_bytes',len(json.dumps(compact).encode()),'legacy_bytes',len(json.dumps(full).encode()))
v=ok('/api/community?response=article',{'action':'view','id':p},None)['articleState'];assert not v['authenticated'] and not v['canEdit'] and not v['liked'] and not v['saved']
assert call('/api/community?response=article',{'action':'like','id':p},None)[0]==401
assert call('/api/article-state?id=9999999999999')[0]==404
assert call('/api/article-state?id=bad')[0]==400
s=ok('/api/social-state');assert 'notifications' in s and 'unread' in s
for path in ['/social.js','/community.js','/comments.js']:
 with urllib.request.urlopen(BASE+path) as r:assert r.headers.get('Cache-Control')=='public, max-age=300'
print('PASS: safe combined Markdown, compact state parity, legacy compatibility, anonymous isolation, validation, notification counts, public asset cache.')
