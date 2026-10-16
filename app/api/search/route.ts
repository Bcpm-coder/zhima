import {renderMarkdown} from '../../../lib/markdown';
import {env} from 'cloudflare:workers';
import {cte,seedArgs,serialize} from '../../../lib/article-catalog';
import {parseSearch} from '../../../lib/search';
import {directoryCte,exampleUserArgs} from '../../../lib/example-users';
export const dynamic='force-dynamic';
const json=(x:unknown,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){try{
 const url=new URL(req.url),db=env.DB!,article=url.searchParams.get('article');
 if(article!==null){const id=Number(article);if(!Number.isSafeInteger(id)||id<1)return json({error:'文章无效'},400);const row=await db.prepare(`${cte} SELECT s.*,(SELECT COUNT(*) FROM likes WHERE post_id=s.id) AS like_count,COALESCE((SELECT count FROM views WHERE post_id=s.id),0) AS view_count FROM searchable s WHERE s.id=?`).bind(...seedArgs,id).first();return row?json({article:serialize(row),...(url.searchParams.get('render')==='1'?{html:(row as any).format==='markdown'?renderMarkdown((row as any).body):null}:{})}):json({error:'文章不存在或已删除'},404)}
 const q=url.searchParams.get('q')||'',mode=url.searchParams.get('mode')||'all',page=Number(url.searchParams.get('page')||1),size=12;
 if(q.length>100||!Number.isSafeInteger(page)||page<1||page>100000||!['all','articles','users','tags'].includes(mode))return json({error:'搜索条件无效（关键词最多 100 字）'},400);
 const parsed=parseSearch(q);if(!parsed.tokens.length)return json({articles:[],users:[],articleTotal:0,userTotal:0,page,size,query:q,field:parsed.field});
 const field=mode==='tags'?'tag':parsed.field;const expression=field==='user'?"author||char(10)||user_id":field==='tag'?"tag||char(10)||tags||char(10)||category":"title||char(10)||body||char(10)||author||char(10)||user_id||char(10)||tag||char(10)||tags||char(10)||category";
 const where=parsed.tokens.map(()=>`instr(lower(${expression}),lower(?))>0`).join(' AND ');const params=[...seedArgs,...parsed.tokens];
 let articleTotal=0,articles:any[]=[],userTotal=0,users:unknown[]=[];
 if(mode!=='users'){
 const [total,rows]=await Promise.all([db.prepare(`${cte} SELECT COUNT(*) AS n FROM searchable WHERE ${where}`).bind(...params).first<{n:number}>(),db.prepare(`${cte} SELECT s.*,(SELECT COUNT(*) FROM likes WHERE post_id=s.id) AS like_count,COALESCE((SELECT count FROM views WHERE post_id=s.id),0) AS view_count FROM searchable s WHERE ${where} ORDER BY s.created_at DESC,s.id DESC LIMIT ? OFFSET ?`).bind(...params,size,(page-1)*size).all()]);articleTotal=total!.n;articles=rows.results.map(serialize);
 }
 if((mode==='all'||mode==='users')&&parsed.field!=='tag'){
 const userWhere=parsed.tokens.map(()=>"instr(lower(username||char(10)||id),lower(?))>0").join(' AND ');
 const [total,rows]=await Promise.all([db.prepare(`${directoryCte} SELECT COUNT(*) AS n FROM directory WHERE ${userWhere}`).bind(...exampleUserArgs,...parsed.tokens).first<{n:number}>(),db.prepare(`${directoryCte} SELECT id,username,occupation,position,company,bio,isExample FROM directory WHERE ${userWhere} ORDER BY updated_at DESC,id LIMIT ? OFFSET ?`).bind(...exampleUserArgs,...parsed.tokens,size,(page-1)*size).all()]);userTotal=total!.n;users=rows.results;
 }
 return json({articles,users,articleTotal,userTotal,page,size,query:q,field});
 }catch(error){console.error('Search query failed',error);return json({error:'搜索失败，请稍后重试'},503)}}
