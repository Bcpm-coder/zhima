import {env} from 'cloudflare:workers';
import {getUser} from '../../auth';
import {privateJson as json,socialBody,socialError,publicProfile} from '../../../lib/social';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const viewer=await getUser();if(!viewer)return json({error:'请先登录'},401);const db=env.DB!,url=new URL(req.url),peer=url.searchParams.get('peer');
 if(peer!==null){
 if(!peer||peer.length>200||peer===viewer.userId)return json({error:'会话对象无效'},400);
 const profile=await publicProfile(db,peer);if(!profile)return json({error:'用户不存在'},404);
 const before=Number(url.searchParams.get('before')||0),after=Number(url.searchParams.get('after')||0);if(!Number.isSafeInteger(before)||before<0||!Number.isSafeInteger(after)||after<0||before&&after)return json({error:'消息页码无效'},400);
 const conditions=before?'AND id<?':after?'AND id>?':'';const args:any[]=[viewer.userId,peer,peer,viewer.userId];if(before||after)args.push(before||after);
 const rows=await db.prepare(`SELECT id,sender_id,recipient_id,body,created_at,read_at,client_id FROM messages WHERE ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)) ${conditions} ORDER BY id ${after?'ASC':'DESC'} LIMIT 51`).bind(...args).all<any>();
 const hasMore=rows.results.length>50,data=rows.results.slice(0,50);if(!after)data.reverse();return json({viewerId:viewer.userId,peer:{id:profile.id,username:profile.username,occupation:profile.occupation,position:profile.position,company:profile.company},messages:data,hasMore});
 }
 const requested=Number(url.searchParams.get('page')||1),size=20;if(!Number.isSafeInteger(requested)||requested<1||requested>100000)return json({error:'页码无效'},400);
 const cte='WITH mine AS (SELECT *,CASE WHEN sender_id=? THEN recipient_id ELSE sender_id END AS peer_id FROM messages WHERE sender_id=? OR recipient_id=?),threads AS (SELECT peer_id,MAX(id) AS last_id,SUM(CASE WHEN recipient_id=? AND read_at IS NULL THEN 1 ELSE 0 END) AS unread FROM mine GROUP BY peer_id)';const args=[viewer.userId,viewer.userId,viewer.userId,viewer.userId];
 const total=(await db.prepare(cte+' SELECT COUNT(*) AS n FROM threads').bind(...args).first<{n:number}>())!.n;const pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requested,pages);
 const [rows,n]=await Promise.all([db.prepare(cte+` SELECT t.peer_id,t.unread,COALESCE(u.username,(SELECT author FROM posts WHERE user_id=t.peer_id ORDER BY id DESC LIMIT 1),'开发者') AS username,u.occupation,u.position,m.id,m.sender_id,substr(m.body,1,100) AS body,m.created_at FROM threads t JOIN messages m ON m.id=t.last_id LEFT JOIN users u ON u.id=t.peer_id ORDER BY t.last_id DESC LIMIT ? OFFSET ?`).bind(...args,size,(page-1)*size).all(),db.prepare('SELECT COUNT(*) AS n FROM messages WHERE recipient_id=? AND read_at IS NULL').bind(viewer.userId).first<{n:number}>()]);
 return json({viewerId:viewer.userId,conversations:rows.results,unread:n!.n,pagination:{page,size,total,pages}});
 }catch(e){return socialError(e,'私信加载失败，请重试')}}
export async function POST(req:Request){try{
 const b=await socialBody(req),viewer=await getUser();if(!viewer)return json({error:'请先登录'},401);const db=env.DB!;
 if(typeof b.peer!=='string'||!b.peer||b.peer.length>200||b.peer===viewer.userId||!['send','read'].includes(b.action))return json({error:'会话对象无效'},400);
 if(!await publicProfile(db,b.peer))return json({error:'用户不存在'},404);
 if(b.action==='read'){
 if(!Number.isSafeInteger(b.through)||b.through<1)return json({error:'消息无效'},400);
 await db.prepare('UPDATE messages SET read_at=? WHERE recipient_id=? AND sender_id=? AND id<=? AND read_at IS NULL').bind(Date.now(),viewer.userId,b.peer,b.through).run();return json({ok:true})}
 const body=typeof b.body==='string'?b.body.trim():'';
 if(!body||body.length>2000||typeof b.clientId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(b.clientId))return json({error:'请输入 1–2000 字的消息'},400);
 const duplicate=await db.prepare('SELECT id,sender_id,recipient_id,body,created_at,read_at,client_id FROM messages WHERE sender_id=? AND client_id=?').bind(viewer.userId,b.clientId).first<any>();
 if(duplicate)return duplicate.recipient_id===b.peer&&duplicate.body===body?json({ok:true,message:duplicate}):json({error:'消息已提交，请刷新后重试'},409);
 const recent=await db.prepare('SELECT COUNT(*) AS n FROM messages WHERE sender_id=? AND created_at>?').bind(viewer.userId,Date.now()-60000).first<{n:number}>();if(recent!.n>=30)return json({error:'发送过于频繁，请稍后重试'},429);
 await db.prepare('INSERT OR IGNORE INTO messages (sender_id,recipient_id,body,created_at,client_id) VALUES (?,?,?,?,?)').bind(viewer.userId,b.peer,body,Date.now(),b.clientId).run();
 const message=await db.prepare('SELECT id,sender_id,recipient_id,body,created_at,read_at,client_id FROM messages WHERE sender_id=? AND client_id=?').bind(viewer.userId,b.clientId).first<any>();
 if(message.recipient_id!==b.peer||message.body!==body)return json({error:'消息已提交，请刷新后重试'},409);return json({ok:true,message});
 }catch(e){return socialError(e,'发送失败，请重试')}}
