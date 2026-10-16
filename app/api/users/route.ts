import {env} from 'cloudflare:workers';
import {getUser} from '../../auth';
import {privateJson as json,publicProfile,publicPeople,socialBody,socialError} from '../../../lib/social';
import {readTags} from '../../../lib/article-input';
import seeds from '../../seeds.json';
import {exampleAuthors} from '../../../lib/example-users';
import {trackingStart,followMetric} from '../../../lib/analytics';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const url=new URL(req.url),viewer=await getUser(),id=url.searchParams.get('id')||viewer?.userId||'',tab=url.searchParams.get('tab')||'articles',requested=Number(url.searchParams.get('page')||1),size=10;
 if(!id)return json({error:'请先登录'},401);
 if(id.length>200||!Number.isSafeInteger(requested)||requested<1||requested>100000||!['articles','following','followers'].includes(tab))return json({error:'主页参数无效'},400);
 const db=env.DB!,seed=id.startsWith('seed:')?seeds.find(s=>s.id===Number(id.slice(5))):null;
 if(seed){const example=exampleAuthors.find(a=>a.id===seed.exampleAuthorId)!;const all=seeds.filter(s=>s.exampleAuthorId===example.id).sort((a,b)=>b.id-a.id),ids=JSON.stringify(all.map(a=>a.id));const [ls,vs]=await Promise.all([db.prepare('SELECT post_id,COUNT(*) AS n FROM likes WHERE post_id IN (SELECT value FROM json_each(?)) GROUP BY post_id').bind(ids).all<any>(),db.prepare('SELECT post_id,count FROM views WHERE post_id IN (SELECT value FROM json_each(?))').bind(ids).all<any>()]);const articles=all.map(s=>({...s,authorId:null,isExample:true,likes:s.likes+(ls.results.find(l=>l.post_id===s.id)?.n||0),views:s.views+(vs.results.find(v=>v.post_id===s.id)?.count||0),tags:s.tags||[s.tag],createdAt:s.createdAt||0})),total=tab==='articles'?articles.length:0,pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requested,pages);return json({profile:{...example,contactEmail:null},isExample:true,isSelf:false,isFollowing:false,viewerId:viewer?.userId||null,stats:{posts:articles.length,followers:0,following:0,likes:articles.reduce((n,p)=>n+p.likes,0),views:articles.reduce((n,p)=>n+p.views,0)},items:tab==='articles'?articles.slice((page-1)*size,page*size):[],pagination:{page,size,total,pages}})}
 const profile=await publicProfile(db,id);if(!profile)return json({error:'用户不存在'},404);
 const [stats,following]=await Promise.all([db.prepare(`SELECT (SELECT COUNT(*) FROM posts WHERE user_id=? AND deleted_at IS NULL) AS posts,(SELECT COUNT(*) FROM follows WHERE following_id=?) AS followers,(SELECT COUNT(*) FROM follows WHERE follower_id=?) AS following,(SELECT COUNT(*) FROM likes l JOIN posts p ON p.id=l.post_id WHERE p.user_id=? AND p.deleted_at IS NULL) AS likes,COALESCE((SELECT SUM(v.count) FROM views v JOIN posts p ON p.id=v.post_id WHERE p.user_id=? AND p.deleted_at IS NULL),0) AS views`).bind(id,id,id,id,id).first<any>(),viewer?db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?').bind(viewer.userId,id).first():null]);
 const total=tab==='articles'?stats.posts:stats[tab],pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requested,pages);let items;
 if(tab==='articles'){const rows=await db.prepare('SELECT p.id,p.title,substr(p.body,1,150) AS excerpt,p.category,p.tags,p.created_at,(SELECT COUNT(*) FROM likes WHERE post_id=p.id) AS likes,COALESCE((SELECT count FROM views WHERE post_id=p.id),0) AS views FROM posts p WHERE p.user_id=? AND p.deleted_at IS NULL ORDER BY p.created_at DESC,p.id DESC LIMIT ? OFFSET ?').bind(id,size,(page-1)*size).all<any>();items=rows.results.map(p=>({...p,desc:p.excerpt,tags:readTags(p.tags),createdAt:p.created_at}))}
 else {const column=tab==='following'?'following_id':'follower_id',where=tab==='following'?'follower_id':'following_id';const rows=await db.prepare(`${publicPeople} SELECT u.id,u.username,u.occupation,u.position,u.company,u.bio,EXISTS(SELECT 1 FROM follows v WHERE v.follower_id=? AND v.following_id=u.id) AS isFollowing FROM follows f JOIN people u ON u.id=f.${column} WHERE f.${where}=? ORDER BY f.created_at DESC,u.id LIMIT ? OFFSET ?`).bind(viewer?.userId||'',id,size,(page-1)*size).all();items=rows.results}
 return json({profile,viewerId:viewer?.userId||null,isExample:false,isSelf:viewer?.userId===id,isFollowing:!!following,stats,items,pagination:{page,size,total,pages}});
 }catch(e){return socialError(e,'主页加载失败，请重试')}}
export async function POST(req:Request){try{
 const b=await socialBody(req),viewer=await getUser();if(!viewer)return json({error:'请先登录'},401);
 if(!['follow','unfollow'].includes(b.action)||typeof b.id!=='string'||b.id.length>200)return json({error:'操作无效'},400);
 if(b.id===viewer.userId)return json({error:'不能关注自己'},400);
 const db=env.DB!;if(!await publicProfile(db,b.id))return json({error:'用户不存在'},404);
 await db.batch([trackingStart(db),followMetric(db,b.id,viewer.userId,b.action==='follow'),...(b.action==='follow'?[db.prepare("INSERT INTO notifications (recipient_id,actor_id,kind,created_at,event_key) SELECT ?,?,'follow',?,? WHERE NOT EXISTS(SELECT 1 FROM follows WHERE follower_id=? AND following_id=?)").bind(b.id,viewer.userId,Date.now(),'follow:'+crypto.randomUUID(),viewer.userId,b.id)]:[]),b.action==='follow'?db.prepare('INSERT OR IGNORE INTO follows (follower_id,following_id,created_at) VALUES (?,?,?)').bind(viewer.userId,b.id,Date.now()):db.prepare('DELETE FROM follows WHERE follower_id=? AND following_id=?').bind(viewer.userId,b.id)]);return json({ok:true,isFollowing:b.action==='follow'});
 }catch(e){return socialError(e,'操作失败，请重试')}}
