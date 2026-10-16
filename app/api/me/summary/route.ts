import {env} from 'cloudflare:workers';
import {getUser} from '../../../auth';
import {privateJson as json,socialBody,socialError} from '../../../../lib/social';
import {summaryConfig,claimSummaryRetry,generateAndStoreSummary} from '../../../../lib/article-summary';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{
 const b=await socialBody(req),user=await getUser();if(!user)return json({error:'请先登录'},401);const id=Number(b.article);if(!Number.isSafeInteger(id)||id<1)return json({error:'文章无效'},400);
 const db=env.DB!,config=summaryConfig(env);if(!config)return json({error:'摘要服务暂未启用，请稍后再试'},503);
 const job=await claimSummaryRetry(db,id,user.userId);
 if(job)await generateAndStoreSummary(db,config,job);
 const post=await db.prepare('SELECT title,body,summary,summary_status FROM posts WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(id,user.userId).first<any>();
 if(!post)return json({error:'文章不存在或已删除'},404);
 return json({title:post.title,body:post.body,summary:post.summary_status==='ready'?post.summary:null,summaryStatus:post.summary_status});
 }catch(e){return socialError(e,'摘要暂时生成失败，请稍后重试')}}
