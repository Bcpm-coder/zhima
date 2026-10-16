import {env} from 'cloudflare:workers';
import {getUser} from '../../auth';
import {privateJson as json,socialBody,socialError} from '../../../lib/social';
import {discussionArticle,addComment,commentColumns,commentJoins,publicComment,commentIdValid} from '../../../lib/discussion';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const url=new URL(req.url),article=Number(url.searchParams.get('article')),requested=Number(url.searchParams.get('page')||1),root=url.searchParams.get('root'),before=Number(url.searchParams.get('before')||0),focus=url.searchParams.get('focus'),db=env.DB!,viewer=await getUser(),size=10;
 if(!Number.isSafeInteger(article)||article<1||!Number.isSafeInteger(requested)||requested<1||requested>100000||root&&!commentIdValid(root)||focus&&!commentIdValid(focus)||!Number.isSafeInteger(before)||before<0)return json({error:'评论参数无效'},400);
 if(!await discussionArticle(db,article))return json({error:'文章不存在或已删除'},404);
 if(root){
  const parent=await db.prepare('SELECT id FROM comments WHERE id=? AND post_id=? AND parent_id IS NULL').bind(root,article).first();if(!parent)return json({error:'讨论不存在'},404);
  const after=Number(url.searchParams.get('after')||0);if(!Number.isSafeInteger(after)||after<0)return json({error:'页码无效'},400);
  const rows=await db.prepare(`SELECT ${commentColumns} FROM comments c ${commentJoins} WHERE c.post_id=? AND c.parent_id=? ORDER BY c.created_at,c.id LIMIT 21 OFFSET ?`).bind(article,root,after).all<any>();
  return json({items:rows.results.slice(0,20).map(r=>publicComment(r,viewer?.userId||null)),hasMore:rows.results.length>20,next:after+Math.min(rows.results.length,20)});
 }
 const total=(await db.prepare('SELECT COUNT(*) AS n FROM comments WHERE post_id=? AND deleted_at IS NULL').bind(article).first<{n:number}>())!.n;
 const threads=(await db.prepare('SELECT COUNT(*) AS n FROM comments WHERE post_id=? AND parent_id IS NULL').bind(article).first<{n:number}>())!.n,pages=Math.max(1,Math.ceil(threads/size));let page=Math.min(requested,pages),focusId:string|null=null;
 if(focus){const target=await db.prepare('SELECT id,parent_id FROM comments WHERE id=? AND post_id=?').bind(focus,article).first<any>();if(!target)return json({error:'这条讨论已不可用'},404);focusId=target.parent_id||target.id;const rank=await db.prepare('SELECT COUNT(*) AS n FROM comments WHERE post_id=? AND parent_id IS NULL AND (created_at>(SELECT created_at FROM comments WHERE id=?) OR (created_at=(SELECT created_at FROM comments WHERE id=?) AND id>?))').bind(article,focusId,focusId,focusId).first<{n:number}>();page=Math.floor(rank!.n/size)+1;}
 const rows=await db.prepare(`SELECT ${commentColumns},(SELECT COUNT(*) FROM comments r WHERE r.parent_id=c.id) AS reply_count FROM comments c ${commentJoins} WHERE c.post_id=? AND c.parent_id IS NULL ORDER BY c.created_at DESC,c.id DESC LIMIT ? OFFSET ?`).bind(article,size,(page-1)*size).all<any>();
 const items=await Promise.all(rows.results.map(async r=>{const replies=await db.prepare(`SELECT ${commentColumns} FROM comments c ${commentJoins} WHERE c.post_id=? AND c.parent_id=? ORDER BY c.created_at,c.id LIMIT 20`).bind(article,r.id).all<any>();let focusedReply=null;if(focus&&focus!==r.id&&focusId===r.id&&!replies.results.some(x=>x.id===focus)){const f=await db.prepare(`SELECT ${commentColumns} FROM comments c ${commentJoins} WHERE c.id=? AND c.parent_id=? AND c.post_id=?`).bind(focus,r.id,article).first<any>();if(f)focusedReply=publicComment(f,viewer?.userId||null)}return {...publicComment(r,viewer?.userId||null),replies:replies.results.map(x=>publicComment(x,viewer?.userId||null)),focusedReply}}));
 return json({viewerId:viewer?.userId||null,total,items,focusId,pagination:{page,pages,size,total:threads}});
 }catch(e){return socialError(e,'评论加载失败，请重试')}}
export async function POST(req:Request){try{const b=await socialBody(req),u=await getUser();if(!u)return json({error:'请先登录'},401);const db=env.DB!;
 if(b.action==='delete'){
 if(!commentIdValid(b.id))return json({error:'评论无效'},400);const comment=await db.prepare('SELECT user_id,post_id FROM comments WHERE id=?').bind(b.id).first<any>();if(!comment||comment.user_id!==u.userId)return json({error:'评论不存在或无权删除'},404);
 await db.batch([db.prepare("UPDATE comments SET body='',deleted_at=COALESCE(deleted_at,?) WHERE id=? AND user_id=?").bind(Date.now(),b.id,u.userId),db.prepare('DELETE FROM notifications WHERE comment_id=?').bind(b.id)]);return json({ok:true});
 }
 if(b.action!=='create')return json({error:'操作无效'},400);const comment=await addComment(db,u.userId,b);return json({ok:true,id:comment.id,root:comment.parent_id||comment.id});
 }catch(e){return socialError(e,'评论保存失败，请重试')}}
