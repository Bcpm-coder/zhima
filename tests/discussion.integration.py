"""Local-only HTTP integration checks; never run against a production account."""
import urllib.request,urllib.error,urllib.parse,json,uuid,concurrent.futures,pathlib
BASE='http://127.0.0.1:8787'
RUN='local-discussion-'+uuid.uuid4().hex[:8]
A,B,C,D=[RUN+x for x in ['-author','-reader','-responder','-outsider']]
def call(user,path,body=None,method=None,origin=BASE):
 h={'Origin':origin,'Content-Type':'application/json'}
 if user:h.update({'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'})
 r=urllib.request.Request(BASE+path,headers=h,data=json.dumps(body).encode() if body else None,method=method)
 try:
  with urllib.request.urlopen(r) as x:return x.status,json.load(x)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def ok(user,path,body=None,method=None):
 code,d=call(user,path,body,method);assert code==200,(path,code,d);return d
def notes(user,q=''):return ok(user,'/api/notifications?'+q)
def create(user,article,body='一条测试评论',reply=None,client=None):
 return ok(user,'/api/comments',{'action':'create','article':article,'body':body,'replyTo':reply,'clientId':client or str(uuid.uuid4())})
def publish(user,title):return ok(user,'/api/community',{'action':'publish','title':title,'body':'本地评论通知验证文章，不发布到线上。','cat':'前端','format':'markdown','tags':['本地测试']})['publishedId']
def listing(article,q=''):return ok(None,'/api/comments?article='+str(article)+'&'+q)
def delete(user,id):return ok(user,'/api/comments',{'action':'delete','id':id})
assert call(None,'/api/notifications')[0]==401
assert call(None,'/api/comments',{'action':'create'})[0]==401
assert call(A,'/api/comments',{'action':'create'},origin='https://foreign.test')[0]==403
p=publish(A,'讨论集成测试');p2=publish(D,'另一篇文章')
assert listing(p)['total']==0
client=str(uuid.uuid4());b=create(B,p,'第一条评论 <img src=x onerror=alert(1)>',client=client)['id']
assert len(notes(A)['items'])==1 and notes(A)['items'][0]['kind']=='comment'
assert notes(B)['unread']==0
assert create(B,p,'第一条评论 <img src=x onerror=alert(1)>',client=client)['id']==b
assert len(notes(A)['items'])==1
c=create(C,p,'回复读者',b)['id'];assert notes(B)['items'][0]['kind']=='reply'
assert len(notes(A)['items'])==2
assert 'comment='+c in notes(B)['items'][0]['href']
create(A,p,'作者回复',b);assert notes(A)['unread']==2
create(B,p,'补充自己的观点',b);assert notes(B)['unread']==2
assert call(C,'/api/comments',{'action':'create','article':p2,'replyTo':b,'body':'跨文章回复','clientId':str(uuid.uuid4())})[0]==404
assert call(C,'/api/comments',{'action':'delete','id':b})[0]==404
assert call(C,'/api/comments',{'action':'create','article':p,'body':'x'*2001,'clientId':str(uuid.uuid4())})[0]==400
assert listing(p)['items'][0]['replies'][0]['body']=='回复读者'
# A notification belonging to another account cannot be marked read.
aid=notes(A)['items'][0]['id'];before=notes(A)['unread'];ok(B,'/api/notifications',{'action':'read','id':aid});assert notes(A)['unread']==before
state=notes(B);ok(B,'/api/notifications',{'action':'readAll','through':state['latest']});assert notes(B)['unread']==0
create(C,p,'已读操作后的新回复',b);assert notes(B)['unread']==1
ok(B,'/api/notifications',{'action':'readAll','through':state['latest']});assert notes(B)['unread']==1
nid=notes(B)['items'][0]['id'];ok(B,'/api/notifications',{'action':'read','id':nid});assert notes(B)['unread']==0
# Concurrent network retries must create exactly one comment and notice.
client=str(uuid.uuid4());before=listing(p)['total'];before_notes=len(notes(A)['items'])
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:r=list(pool.map(lambda _:create(D,p,'并发重试',client=client),range(8)))
assert len({x['id'] for x in r})==1 and listing(p)['total']==before+1
assert len(notes(A)['items'])==before_notes+1
assert call(D,'/api/comments',{'action':'create','article':p,'body':'改变已提交内容','clientId':client})[0]==409
# Delete text, not the discussion tree; remove notices quoting the deleted text.
delete(B,b);root=next(x for x in listing(p)['items'] if x['id']==b);assert root['body']=='' and root['deleted_at'] and len(root['replies'])>=4
assert all(n['excerpt']!='第一条评论 <img src=x onerror=alert(1)>' for n in notes(A)['items'])
assert call(C,'/api/comments',{'action':'create','article':p,'replyTo':b,'body':'回复已删','clientId':str(uuid.uuid4())})[0]==404
# Follow events are emitted only when the relation is actually inserted.
before=len(notes(A,'kind=follow')['items'])
for _ in range(2):ok(B,'/api/users',{'action':'follow','id':A})
assert len(notes(A,'kind=follow')['items'])==before+1
ok(B,'/api/users',{'action':'unfollow','id':A});ok(B,'/api/users',{'action':'follow','id':A});assert len(notes(A,'kind=follow')['items'])==before+2
assert ok(A,'/api/social-state')['notifications']==notes(A)['unread']
# Independent roots and replies paginate; deep-link resolves an off-page thread.
old=create(C,p,'用于定位的旧评论')['id']
for i in range(12):create(RUN+'-pager'+str(i),p,'第'+str(i)+'条分页评论')
f=listing(p,'focus='+old);assert f['focusId']==old and f['pagination']['page']>=2
for i in range(24):create(RUN+'-reply'+str(i),p,'第'+str(i)+'条楼中回复',old)
root=next(x for x in listing(p,'focus='+old)['items'] if x['id']==old);assert root['reply_count']==24 and len(root['replies'])==20
extra=ok(None,'/api/comments?'+urllib.parse.urlencode({'article':p,'root':old,'after':20}));assert len(extra['items'])==4 and not extra['hasMore']
last=extra['items'][-1]['id'];root=next(x for x in listing(p,'focus='+last)['items'] if x['id']==old);assert root['focusedReply']['id']==last
# Notification pages are disjoint and ignore attempts to select a recipient.
n1=notes(A,'page=1');n2=notes(A,'page=2');assert n1['pagination']['pages']>=2 and not ({n['id'] for n in n1['items']}&{n['id'] for n in n2['items']})
assert notes(D,'recipient='+A)['items']==[]
assert call(A,'/api/notifications?kind=bad')[0]==400
# Rate limit and account isolation.
for i in range(10):create(RUN+'-limited',p,'速率'+str(i))
assert call(RUN+'-limited','/api/comments',{'action':'create','article':p,'body':'超过限额','clientId':str(uuid.uuid4())})[0]==429
assert all(n['actorId']!=B for n in notes(B)['items'])
ok(A,'/api/me/manage',{'action':'trash','id':p},'PATCH');assert call(None,'/api/comments?article='+str(p))[0]==404
ok(A,'/api/me/manage',{'action':'restore','id':p},'PATCH');assert listing(p)['total']>0
# Keep one local discussion for UI verification and remove a separate purge test.
q=publish(A,'彻底删除讨论验证');create(B,q,'随文章删除');ok(A,'/api/me/manage',{'action':'trash','id':q},'PATCH');ok(A,'/api/me/manage',{'action':'purge','id':q,'confirmation':'彻底删除'},'PATCH');assert call(None,'/api/comments?article='+str(q))[0]==404
pathlib.Path('../work/discussion-test-context.json').write_text(json.dumps({'article':p,'root':old,'reply':last,'author':A,'reader':B,'responder':C}))
print('PASS: auth/origin isolation; comment+reply recipient routing; idempotent and concurrent submissions; self-notification exclusion; owner-only read/delete; read-all boundary; deleted text privacy; follow dedupe; thread/reply pagination and deep links; rate limit; trash/restore/purge.')
