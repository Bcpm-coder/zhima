import {env} from 'cloudflare:workers';
import {getUser} from '../../../auth';
import {privateJson as json,socialBody,socialError} from '../../../../lib/social';
import {chinaDay,dayStart,addDays} from '../../../../lib/analytics';
export const dynamic='force-dynamic';
const target='zzssUEOTucTYjV8Eas0ASSoLPtzZS2yLAVaCIZjjUytUIOIzc1Y2BM';
const batch='analytics-demo-2026-v1';
const topics=[
 ['把需求拆成可验证的小任务','开发工具','需求拆解','先写下输入、输出与成功条件，再决定实现方式。','把“优化搜索”拆成关键词输入、结果排序、无结果提示三个任务。逐项完成后分别检查空值、重复提交和异常反馈。'],
 ['接口分页的边界检查','后端','分页','分页不仅要处理下一页，还要定义数据变化后的行为。','用稳定的时间与 ID 组合排序；删除最后一条记录后将页码限制到有效范围。检查第一页、最后一页以及越界页。'],
 ['给 Markdown 阅读页留出呼吸感','前端','Markdown','正文宽度、行高与代码块的溢出处理影响阅读体验。','先限制正文最大宽度，再为标题设置一致间距。长代码采用横向滚动，图片不超出容器，手机端保持足够边距。'],
 ['让收藏成为可回顾的知识库','阅读','知识管理','收藏文章时记录用途，回看时才容易找到下一步。','每周挑三篇收藏，写一句适用场景，再把其中一个方法用到当前项目。收藏数量与实际掌握程度应分开看待。'],
 ['排查一次慢查询的顺序','后端','数据库','先定位真正耗时的查询，再讨论索引。','记录条件、返回行数与耗时，查看执行计划。比较加索引前后的扫描范围，并评估写入成本，避免为所有字段建立索引。'],
 ['用小样本检查 AI 输出','人工智能','评估','固定一组代表性问题，比反复试一个提示更容易发现退步。','准备常规问题、信息不足的问题和容易混淆的问题。保存预期行为，每次修改提示后用同一组案例比较结果。']
];
export async function POST(req:Request){try{
 const b=await socialBody(req),u=await getUser();if(!u)return json({error:'请先登录'},401);if(u.userId!==target)return json({error:'此示例批次仅适用于指定账号'},403);if(!['add','remove'].includes(b.action))return json({error:'操作无效'},400);const db=env.DB!;
 if(b.action==='remove'){
 // Only remove untouched demo records; an edited example is retained as user content.
 const owned="SELECT id FROM posts WHERE user_id=? AND legacy_id LIKE 'analytics-demo-2026-v1:%' AND updated_at IS NULL";
 await db.batch([db.prepare('DELETE FROM bookmarks WHERE user_id=? AND example_batch=?').bind(u.userId,batch),...['notifications','comments','article_daily','bookmarks','likes','views'].map(t=>db.prepare(`DELETE FROM ${t} WHERE post_id IN (${owned})`).bind(u.userId)),db.prepare(`DELETE FROM posts WHERE id IN (${owned})`).bind(u.userId)]);return json({ok:true});
 }
 const profile=await db.prepare('SELECT username FROM users WHERE id=?').bind(u.userId).first<{username:string}>();const today=chinaDay(),statements=[];
 for(let i=0;i<18;i++){
  const [title,cat,tag,intro,practice]=topics[i%6],phase=Math.floor(i/6)+1,offset=[86,81,77,73,68,64,58,53,49,43,38,34,28,23,18,12,7,2][i],created=dayStart(addDays(today,-offset))+10*3600000,legacy=batch+':'+i;
  const body=`> 示例文章：这是为数据中心演示生成的内容，发布日期为模拟日期，不代表真实历史创作。\n\n# ${title} · 第 ${phase} 次练习\n\n${intro}\n\n## 实践记录\n\n${practice}\n\n## 本次关注点\n\n${['先建立最小可运行示例，记录最初的假设与实际结果。','补上异常与边界情况，比较修改前后的行为差异。','整理可复用的检查步骤，并注明仍然存在的限制。'][phase-1]}\n\n## 复盘清单\n\n- 目标是否能用一个具体结果验证？\n- 输入为空或出现异常时是否有清晰反馈？\n- 下次遇到相同问题，第一步应该做什么？\n\n这篇内容仅用于观察发布频率、收藏时间分布与日历效果，可在数据中心清理本批示例。`;
  statements.push(db.prepare('INSERT OR IGNORE INTO posts (user_id,title,body,category,author,created_at,legacy_id,tags,format) VALUES (?,?,?,?,?,?,?,?,?)').bind(u.userId,'【示例】'+title+' · '+phase,body,cat,profile?.username||u.fullName||'开发者',created,legacy,JSON.stringify(['示例数据',tag]),'markdown'));
  if(i%3!==1)statements.push(db.prepare('INSERT OR IGNORE INTO bookmarks (user_id,post_id,created_at,example_batch) SELECT ?,id,?,? FROM posts WHERE user_id=? AND legacy_id=? AND deleted_at IS NULL').bind(u.userId,created+(i%3+1)*3600000,batch,u.userId,legacy));
 }
 await db.batch(statements);return json({ok:true,articles:18,bookmarks:12});
 }catch(e){return socialError(e,'示例内容保存失败')}}
