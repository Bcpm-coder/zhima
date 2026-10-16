import {after} from 'next/server';
import {summaryConfig,generateAndStoreSummary} from '../../../../lib/article-summary';
import {env} from 'cloudflare:workers';
import {getUser} from '../../../auth';
import {validateTags,sourceName} from '../../../../lib/article-input';
import seeds from '../../../seeds.json';
import {trackingStart,articleMetric} from '../../../../lib/analytics';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const cats=['前端','后端','人工智能','移动开发','开发工具','阅读'];
export async function GET(req:Request){try{
 const u=await getUser();if(!u)return json({error:'请先登录'},401);const db=env.DB!,url=new URL(req.url);const article=url.searchParams.get('article');if(article!==null){const id=Number(article);if(!Number.isSafeInteger(id)||id<1)return json({error:'文章无效'},400);const post=await db.prepare('SELECT id,title,body,category,tags,format,source_name,created_at,updated_at FROM posts WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(id,u.userId).first();return post?json({post}):json({error:'文章不存在或无权编辑'},404)}const kind=url.searchParams.get('kind')||'posts';if(!['posts','saved','trash'].includes(kind))return json({error:'分类无效'},400);
 const page=Number(url.searchParams.get('page')||1);if(!Number.isSafeInteger(page)||page<1||page>100000)return json({error:'页码无效'},400);const size=10;
 if(kind==='saved'){
  const total=await db.prepare('SELECT COUNT(*) AS n FROM bookmarks WHERE user_id=?').bind(u.userId).first<{n:number}>();
  const data=await db.prepare('SELECT b.post_id,b.created_at AS saved_at,b.example_batch,p.title,p.category,p.deleted_at,p.user_id,COALESCE(users.username,p.author) AS author FROM bookmarks b LEFT JOIN posts p ON p.id=b.post_id LEFT JOIN users ON users.id=p.user_id WHERE b.user_id=? ORDER BY b.created_at DESC,b.post_id DESC LIMIT ? OFFSET ?').bind(u.userId,size,(page-1)*size).all<any>();
  return json({total:total!.n,page,size,items:data.results.map(p=>{const seed=seeds.find(s=>s.id===p.post_id);const available=!!seed||!!p.title&&p.deleted_at===null;return {savedAt:p.saved_at,isExample:!!p.example_batch,id:p.post_id,title:seed?.title||(available?p.title:'文章已删除或不可用'),category:seed?.cat||(available?p.category:''),author:seed?.author||(available?p.author:''),available}})});
 }
 const clause=kind==='trash'?'deleted_at IS NOT NULL':'deleted_at IS NULL';
 const [total,data]=await Promise.all([db.prepare(`SELECT COUNT(*) AS n FROM posts WHERE user_id=? AND ${clause}`).bind(u.userId).first<{n:number}>(),db.prepare(`SELECT id,title,body,category,tags,format,source_name,created_at,updated_at,deleted_at FROM posts WHERE user_id=? AND ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`).bind(u.userId,size,(page-1)*size).all()]);
 return json({total:total!.n,page,size,items:data.results});
 }catch{return json({error:'管理列表加载失败'},503)}}
export async function PATCH(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'请求来源无效'},403);const user=await getUser();if(!user)return json({error:'请先登录'},401);
 if(Number(req.headers.get('content-length')||0)>100000)return json({error:'内容过长'},413);const raw=await req.text();if(raw.length>80000)return json({error:'内容过长'},413);let b;try{b=JSON.parse(raw)}catch{return json({error:'请求格式无效'},400)}
 if(!b||typeof b!=='object'||Array.isArray(b)||!['edit','trash','restore','unbookmark','purge'].includes(b.action))return json({error:'操作无效'},400);
 const id=Number(b.id);if(!Number.isSafeInteger(id)||id<1)return json({error:'文章无效'},400);const db=env.DB!;
 if(b.action==='unbookmark'){await db.batch([trackingStart(db),articleMetric(db,id,'unsaves','AND EXISTS (SELECT 1 FROM bookmarks WHERE user_id=? AND post_id=?)',[user.userId,id]),db.prepare('DELETE FROM bookmarks WHERE user_id=? AND post_id=?').bind(user.userId,id)]);return json({ok:true})}
 const post=await db.prepare('SELECT id,deleted_at,tags,format,source_name FROM posts WHERE id=? AND user_id=?').bind(id,user.userId).first<{id:number;deleted_at:number|null;tags:string;format:string;source_name:string}>();if(!post)return json({error:'文章不存在或无权管理'},404);
 if(b.action==='purge'){
 if(post.deleted_at===null)return json({error:'只有回收站中的文章可以彻底删除'},409);
 if(b.confirmation!=='彻底删除')return json({error:'请输入“彻底删除”以确认不可恢复的操作'},400);
 const ownTrash='SELECT id FROM posts WHERE id=? AND user_id=? AND deleted_at IS NOT NULL';
 await db.batch([
 db.prepare(`DELETE FROM notifications WHERE post_id IN (${ownTrash})`).bind(id,user.userId),
 db.prepare(`DELETE FROM comments WHERE post_id IN (${ownTrash})`).bind(id,user.userId),
 db.prepare(`DELETE FROM article_daily WHERE post_id IN (${ownTrash})`).bind(id,user.userId),
 db.prepare(`DELETE FROM bookmarks WHERE post_id IN (${ownTrash})`).bind(id,user.userId),
 db.prepare(`DELETE FROM likes WHERE post_id IN (${ownTrash})`).bind(id,user.userId),
 db.prepare(`DELETE FROM views WHERE post_id IN (${ownTrash})`).bind(id,user.userId),
 db.prepare('DELETE FROM posts WHERE id=? AND user_id=? AND deleted_at IS NOT NULL').bind(id,user.userId)
 ]);return json({ok:true});
 }
 if(b.action==='edit'){
 if(post.deleted_at!==null)return json({error:'请先恢复文章再编辑'},409);
 const title=typeof b.title==='string'?b.title.trim():'',body=typeof b.body==='string'?b.body:'';
 if(!title||title.length>100||!body.trim()||body.length>30000||!cats.includes(b.category))return json({error:'标题最多 100 字，正文最多 30000 字，请选择有效分类'},400);
 let tags,filename;try{tags=validateTags(b.tags);filename=sourceName(b.sourceName)}catch(e){return json({error:e instanceof Error?e.message:'标签无效'},400)}
 if(b.format!==undefined&&!['markdown','plain'].includes(b.format))return json({error:'文章格式无效'},400);
 const summarySettings=summaryConfig(env),summaryRevision=crypto.randomUUID();
 const result=await db.prepare('UPDATE posts SET title=?,body=?,category=?,tags=?,format=?,source_name=?,updated_at=?,summary=NULL,summary_status=?,summary_revision=?,summary_requested_at=? WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(title,body,b.category,tags===undefined?post.tags:JSON.stringify(tags),b.format||post.format,filename===undefined?post.source_name:filename,Date.now(),summarySettings?'pending':'none',summaryRevision,summarySettings?Date.now():null,id,user.userId).run();if(!result.meta.changes)return json({error:'文章状态已改变，请刷新'},409);
 if(summarySettings)after(()=>generateAndStoreSummary(db,summarySettings,{id,owner:user.userId,revision:summaryRevision}));
 }else if(b.action==='trash')await db.prepare('UPDATE posts SET deleted_at=? WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(Date.now(),id,user.userId).run();
 else await db.prepare('UPDATE posts SET deleted_at=NULL WHERE id=? AND user_id=?').bind(id,user.userId).run();
 return json({ok:true});
 }catch{return json({error:'操作失败，请稍后重试'},500)}}
