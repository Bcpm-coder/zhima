import seeds from '../app/seeds.json';
export const commentIdValid=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s);
export const clientIdValid=(s:unknown):s is string=>typeof s==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(s);
export const discussionError=(message:string,status=400)=>Object.assign(new Error(message),{status});
export async function discussionArticle(db:any,id:number){
 const post=await db.prepare('SELECT id,user_id,title FROM posts WHERE id=? AND deleted_at IS NULL').bind(id).first();if(post)return post;
 const seed=seeds.find(s=>s.id===id);return seed?{id:seed.id,user_id:null,title:seed.title}:null;
}
export const commentColumns=`c.id,c.post_id,c.user_id,c.parent_id,c.reply_to_id,CASE WHEN c.deleted_at IS NULL THEN c.body ELSE '' END AS body,c.created_at,c.deleted_at,COALESCE(u.username,(SELECT author FROM posts WHERE user_id=c.user_id ORDER BY id DESC LIMIT 1),'开发者') AS username,CASE WHEN target.deleted_at IS NULL THEN COALESCE(tu.username,'开发者') ELSE '已删除的评论' END AS reply_name`;
export const commentJoins='LEFT JOIN users u ON u.id=c.user_id LEFT JOIN comments target ON target.id=c.reply_to_id LEFT JOIN users tu ON tu.id=target.user_id';
export const publicComment=(r:any,viewer:string|null)=>({...r,canDelete:!r.deleted_at&&r.user_id===viewer});
export async function addComment(db:any,viewer:string,input:any){
 const postId=Number(input.article),body=typeof input.body==='string'?input.body.trim():'',replyTo=input.replyTo||null;
 if(!Number.isSafeInteger(postId)||postId<1||!body||body.length>2000||!clientIdValid(input.clientId)||replyTo&&!commentIdValid(replyTo))throw discussionError('请输入 1–2000 字评论，并选择有效文章');
 const post=await discussionArticle(db,postId);if(!post)throw discussionError('文章不存在或已删除',404);
 const previous=await db.prepare('SELECT * FROM comments WHERE user_id=? AND client_id=?').bind(viewer,input.clientId).first();
 if(previous){if(previous.post_id!==postId||previous.body!==body||previous.reply_to_id!==replyTo||previous.deleted_at)throw discussionError('此评论已提交，请刷新后重试',409);return previous}
 const target=replyTo?await db.prepare('SELECT id,user_id,parent_id FROM comments WHERE id=? AND post_id=? AND deleted_at IS NULL').bind(replyTo,postId).first():null;
 if(replyTo&&!target)throw discussionError('回复的评论已删除或不属于这篇文章',404);
 const root=target?(target.parent_id||target.id):null,id=crypto.randomUUID(),now=Date.now(),isSeed=post.user_id===null?1:0;
 const recipients=new Map<string,string>();if(post.user_id&&post.user_id!==viewer)recipients.set(post.user_id,'comment');if(target&&target.user_id!==viewer)recipients.set(target.user_id,'reply');
 // INSERT and notices share a transaction. Unique submission IDs make a network
 // retry idempotent; notification rows only come from the actual accepted row.
 const statements=[db.prepare(`INSERT OR IGNORE INTO comments (id,post_id,user_id,parent_id,reply_to_id,body,created_at,client_id) SELECT ?,?,?,?,?,?,?,? WHERE (?=1 OR EXISTS(SELECT 1 FROM posts WHERE id=? AND deleted_at IS NULL)) AND (? IS NULL OR EXISTS(SELECT 1 FROM comments WHERE id=? AND post_id=? AND deleted_at IS NULL)) AND (SELECT COUNT(*) FROM comments WHERE user_id=? AND created_at>?)<10`).bind(id,postId,viewer,root,replyTo,body,now,input.clientId,isSeed,postId,replyTo,replyTo,postId,viewer,now-60000)];
 for(const [recipient,kind] of recipients)statements.push(db.prepare(`INSERT OR IGNORE INTO notifications (recipient_id,actor_id,kind,post_id,comment_id,created_at,event_key) SELECT ?,?,?,post_id,id,created_at,'comment:'||id FROM comments WHERE user_id=? AND client_id=? AND post_id=? AND body=? AND reply_to_id IS ? AND deleted_at IS NULL`).bind(recipient,viewer,kind,viewer,input.clientId,postId,body,replyTo));
 await db.batch(statements);
 const comment=await db.prepare('SELECT * FROM comments WHERE user_id=? AND client_id=?').bind(viewer,input.clientId).first();
 if(!comment){if(!await discussionArticle(db,postId))throw discussionError('文章已删除',404);if(replyTo&&!await db.prepare('SELECT id FROM comments WHERE id=? AND deleted_at IS NULL').bind(replyTo).first())throw discussionError('该评论已删除',404);throw discussionError('评论过于频繁，请稍后重试',429)}
 if(comment.body!==body||comment.post_id!==postId||comment.reply_to_id!==replyTo)throw discussionError('此评论已提交，请刷新后重试',409);
 return comment;
}
