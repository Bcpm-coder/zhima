import {env} from 'cloudflare:workers';
import {getUser} from '../../auth';
import {privateJson as json,socialBody,socialError} from '../../../lib/social';
import seeds from '../../seeds.json';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const u=await getUser();if(!u)return json({error:'请先登录'},401);const db=env.DB!,url=new URL(req.url),kind=url.searchParams.get('kind')||'all',requested=Number(url.searchParams.get('page')||1),unread=url.searchParams.get('unread')==='1',size=20;
 if(!['all','discussion','follow'].includes(kind)||!Number.isSafeInteger(requested)||requested<1||requested>100000)return json({error:'通知筛选无效'},400);
 const where="n.recipient_id=?"+(kind==='follow'?" AND n.kind='follow'":kind==='discussion'?" AND n.kind IN ('comment','reply')":'')+(unread?' AND n.read_at IS NULL':'');
 const total=(await db.prepare(`SELECT COUNT(*) AS n FROM notifications n WHERE ${where}`).bind(u.userId).first<{n:number}>())!.n,pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requested,pages);
 const [rows,state]=await Promise.all([db.prepare(`SELECT n.id,n.kind,n.actor_id,n.post_id,n.comment_id,n.created_at,n.read_at,COALESCE(a.username,(SELECT author FROM posts WHERE user_id=n.actor_id ORDER BY id DESC LIMIT 1),'开发者') AS actor_name,p.title,p.deleted_at AS post_deleted,c.parent_id,c.deleted_at AS comment_deleted,CASE WHEN c.deleted_at IS NULL THEN substr(c.body,1,140) ELSE NULL END AS excerpt FROM notifications n LEFT JOIN users a ON a.id=n.actor_id LEFT JOIN posts p ON p.id=n.post_id LEFT JOIN comments c ON c.id=n.comment_id WHERE ${where} ORDER BY n.id DESC LIMIT ? OFFSET ?`).bind(u.userId,size,(page-1)*size).all<any>(),db.prepare('SELECT COALESCE(MAX(id),0) AS latest,SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) AS unread FROM notifications WHERE recipient_id=?').bind(u.userId).first<any>()]);
 const items=rows.results.map(n=>{const seed=seeds.find(s=>s.id===n.post_id),available=n.kind==='follow'||((!!seed||!!n.title&&n.post_deleted===null)&&!!n.comment_id&&n.comment_deleted===null);return {id:n.id,kind:n.kind,actorId:n.actor_id,actorName:n.actor_name,createdAt:n.created_at,readAt:n.read_at,title:seed?.title||(!n.post_deleted?n.title:null),excerpt:available?n.excerpt:null,available,href:n.kind==='follow'?'/user?'+new URLSearchParams({id:n.actor_id}):available?'/article?'+new URLSearchParams({id:String(n.post_id),comment:n.comment_id})+'#comment-'+n.comment_id:null}});
 return json({items,unread:state.unread||0,latest:state.latest,pagination:{page,pages,total,size}});
 }catch(e){return socialError(e,'通知加载失败，请重试')}}
export async function POST(req:Request){try{
 const b=await socialBody(req),u=await getUser();if(!u)return json({error:'请先登录'},401);const db=env.DB!;
 if(b.action==='read'&&Number.isSafeInteger(b.id)&&b.id>0){await db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND recipient_id=?').bind(Date.now(),b.id,u.userId).run();return json({ok:true})}
 if(b.action==='readAll'&&Number.isSafeInteger(b.through)&&b.through>=0){await db.prepare('UPDATE notifications SET read_at=? WHERE recipient_id=? AND id<=? AND read_at IS NULL').bind(Date.now(),u.userId,b.through).run();return json({ok:true})}
 return json({error:'操作无效'},400);
 }catch(e){return socialError(e,'通知操作失败，请重试')}}
