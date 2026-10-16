import {articleState} from '../../../lib/article-state';
import {after} from 'next/server';
import {summaryConfig,generateAndStoreSummary} from '../../../lib/article-summary';
import { env } from 'cloudflare:workers';
import { getUser,githubReady } from '../../auth';
import {validateTags,sourceName} from '../../../lib/article-input';
import seeds from '../../seeds.json';
import {trackingStart,articleMetric} from '../../../lib/analytics';
import {cte,seedArgs,serialize} from '../../../lib/article-catalog';
export const dynamic='force-dynamic';
const cats=['前端','后端','人工智能','移动开发','开发工具','阅读'];
const json=(x:unknown,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
const day=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});
async function state(params=new URLSearchParams(),knownUser?:Awaited<ReturnType<typeof getUser>>){
 const requested=Number(params.get('page')||1),category=params.get('cat')||'综合',sort=params.get('sort')||'推荐',onlySaved=params.get('saved')==='1',size=10;
 if(!Number.isSafeInteger(requested)||requested<1||requested>100000||!['综合',...cats].includes(category)||!['推荐','最新','热榜'].includes(sort))throw new Error('INVALID_PAGE');
 const user=knownUser===undefined?await getUser():knownUser;const db=env.DB!;
 const clauses:string[]=[],args:any[]=[...seedArgs];
 if(category!=='综合'){clauses.push('s.category=?');args.push(category)}
 if(onlySaved){clauses.push('EXISTS (SELECT 1 FROM bookmarks b WHERE b.post_id=s.id AND b.user_id=?)');args.push(user?.userId||'')}
 const where=clauses.length?'WHERE '+clauses.join(' AND '):'';
 const total=(await db.prepare(`${cte} SELECT COUNT(*) AS n FROM searchable s ${where}`).bind(...args).first<{n:number}>())!.n;
 const pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requested,pages);
 // Seed popularity is part of the same SQL ordering as published article interactions.
 const seedLikes='CASE s.id '+seeds.map(p=>`WHEN ${p.id} THEN ${p.likes}`).join(' ')+' ELSE 0 END';
 const counts=`(SELECT COUNT(*) FROM likes WHERE post_id=s.id) AS like_count,COALESCE((SELECT count FROM views WHERE post_id=s.id),0) AS view_count`;
 const order=sort==='热榜'?`(${seedLikes}+(SELECT COUNT(*) FROM likes WHERE post_id=s.id)) DESC,s.created_at DESC,s.id DESC`:'s.created_at DESC,s.id DESC';
 const [ps,rank,bs,cs]=await Promise.all([
 db.prepare(`${cte} SELECT s.*,${counts} FROM searchable s ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...args,size,(page-1)*size).all<any>(),
 db.prepare(`${cte} SELECT s.*,${counts} FROM searchable s ORDER BY (${seedLikes}+(SELECT COUNT(*) FROM likes WHERE post_id=s.id)) DESC,s.id DESC LIMIT 3`).bind(...seedArgs).all<any>(),
 user?db.prepare('SELECT post_id FROM bookmarks WHERE user_id=?').bind(user.userId).all<any>():Promise.resolve({results:[]}),
 user?db.prepare('SELECT post_id FROM likes WHERE user_id=?').bind(user.userId).all<any>():Promise.resolve({results:[]})]);
 const checked=user?!!await db.prepare('SELECT day FROM checkins WHERE user_id=? AND day=?').bind(user.userId,day()).first():false;
 const summary=(p:any)=>{const {body,...rest}=serialize(p);return rest};
 return {articles:ps.results.map(summary),ranking:rank.results.map(summary),pagination:{page,size,total,pages},saved:bs.results.map(b=>b.post_id),liked:cs.results.map(c=>c.post_id),checked,auth:{githubEnabled:githubReady()},user:user?{name:user.fullName||'开发者',provider:user.provider}:null};
}
export async function GET(req:Request){try{return json(await state(new URL(req.url).searchParams))}catch(e){if(e instanceof Error&&e.message==='INVALID_PAGE')return json({error:'分页条件无效'},400);console.error(e);return json({error:'文章加载失败，请稍后重试'},503)}}
export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(origin!==new URL(req.url).origin)return json({error:'请求来源无效'},403);
 if(Number(req.headers.get('content-length')||0)>100000)return json({error:'文章过长'},413);
 let raw=await req.text();if(raw.length>80000)return json({error:'文章过长'},413);
 let b;try{b=JSON.parse(raw)}catch{return json({error:'请求格式无效'},400)}const db=env.DB!;
 const user=await getUser();if(b.action!=='view'&&!user)return json({error:'请先登录'},401);
 let publishedId:number|null=null;
 if(b.action==='publish'){
 const title=typeof b.title==='string'?b.title.trim():'';const body=typeof b.body==='string'?b.body:'';
 if(!title||title.length>100||!body.trim()||body.length>30000||!cats.includes(b.cat))return json({error:'请填写标题、正文并选择有效分类（正文最多 30000 字）'},400);
 let tags,filename;try{tags=validateTags(b.tags)||[];filename=sourceName(b.sourceName)||''}catch(e){return json({error:e instanceof Error?e.message:'标签无效'},400)}
 if(b.format!==undefined&&!['markdown','plain'].includes(b.format))return json({error:'文章格式无效'},400);
 const recent=await db.prepare('SELECT COUNT(*) AS n FROM posts WHERE user_id=? AND created_at>?').bind(user!.userId,Date.now()-60000).first<any>();if(recent.n>=10)return json({error:'发布过于频繁，请稍后重试'},429);
 publishedId=Date.now();const summarySettings=summaryConfig(env),summaryRevision=crypto.randomUUID();
 await db.prepare('INSERT OR IGNORE INTO posts (id,user_id,title,body,category,author,created_at,legacy_id,tags,format,source_name,summary_status,summary_revision,summary_requested_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(publishedId,user!.userId,title,body,b.cat,user!.fullName||'开发者',Date.now(),b.legacyId?String(b.legacyId).slice(0,40):null,JSON.stringify(tags),b.format||'markdown',filename,summarySettings?'pending':'none',summaryRevision,summarySettings?Date.now():null).run();
 if(summarySettings){const job={id:publishedId,owner:user!.userId,revision:summaryRevision};after(()=>generateAndStoreSummary(db,summarySettings,job))}
 }else if(b.action==='checkin'){
 await db.prepare('INSERT OR IGNORE INTO checkins (user_id,day) VALUES (?,?)').bind(user!.userId,day()).run();
 }else if(['like','save','view'].includes(b.action)){
 const id=Number(b.id);if(!Number.isSafeInteger(id)||id<1)return json({error:'文章无效'},400);
 if(!seeds.some(s=>s.id===id)&&!await db.prepare('SELECT id FROM posts WHERE id=? AND deleted_at IS NULL').bind(id).first())return json({error:'文章不存在'},404);
 if(b.action==='view'){await db.batch([trackingStart(db),articleMetric(db,id,'views'),db.prepare('INSERT INTO views (post_id,count) VALUES (?,1) ON CONFLICT(post_id) DO UPDATE SET count=count+1').bind(id)]);return json(new URL(req.url).searchParams.get('response')==='article'?{articleState:await articleState(db,id,user,seeds.find(s=>s.id===id))}:{ok:true})}
 const table=b.action==='like'?'likes':'bookmarks';
 // One atomic upsert/delete decision per authenticated user and article.
 const existing=await db.prepare(`SELECT post_id FROM ${table} WHERE user_id=? AND post_id=?`).bind(user!.userId,id).first();
 const field=b.action==='like'?(existing?'unlikes':'likes'):(existing?'unsaves':'saves');
 await db.batch([trackingStart(db),articleMetric(db,id,field,`AND ${existing?'':'NOT '}EXISTS (SELECT 1 FROM ${table} WHERE user_id=? AND post_id=?)`,[user!.userId,id]),existing?db.prepare(`DELETE FROM ${table} WHERE user_id=? AND post_id=?`).bind(user!.userId,id):(b.action==='save'?db.prepare('INSERT OR IGNORE INTO bookmarks (user_id,post_id,created_at) VALUES (?,?,?)').bind(user!.userId,id,Date.now()):db.prepare('INSERT OR IGNORE INTO likes (user_id,post_id) VALUES (?,?)').bind(user!.userId,id))]);
 }else return json({error:'不支持的操作'},400);
 if(['like','save'].includes(b.action)&&new URL(req.url).searchParams.get('response')==='article')return json({articleState:await articleState(db,Number(b.id),user,seeds.find(s=>s.id===Number(b.id)))});
 return json({...await state(new URL(req.url).searchParams,user),publishedId});
 }catch(e){console.error(e);return json({error:'保存失败，请稍后重试'},500)}}
