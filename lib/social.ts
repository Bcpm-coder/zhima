export const privateJson=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export const publicUserColumns="id,username,occupation,position,company,bio,created_at,CASE WHEN email_public=1 THEN email ELSE NULL END AS contactEmail";
export async function socialBody(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)throw Object.assign(new Error('请求来源无效'),{status:403});
 if(Number(req.headers.get('content-length')||0)>12000)throw Object.assign(new Error('内容过长'),{status:413});
 const raw=await req.text();if(raw.length>12000)throw Object.assign(new Error('内容过长'),{status:413});
 let b;try{b=JSON.parse(raw)}catch{throw Object.assign(new Error('请求格式无效'),{status:400})}
 if(!b||typeof b!=='object'||Array.isArray(b))throw Object.assign(new Error('请求格式无效'),{status:400});return b;
}
export function socialError(e:unknown,fallback:string){const x=e as Error&{status?:number};if(x.status)return privateJson({error:x.message},x.status);console.error(fallback,e);return privateJson({error:fallback},503)}
// Older articles predate the users table. Resolve their author without creating
// an account or exposing a private contact field from a public read request.
export async function publicProfile(db:any,id:string){
 const profile=await db.prepare(`SELECT ${publicUserColumns} FROM users WHERE id=?`).bind(id).first();if(profile)return profile;
 return db.prepare("SELECT p.user_id AS id,p.author AS username,'' AS occupation,'' AS position,'' AS company,'' AS bio,NULL AS contactEmail,(SELECT MIN(created_at) FROM posts WHERE user_id=p.user_id AND deleted_at IS NULL) AS created_at FROM posts p WHERE p.user_id=? AND p.deleted_at IS NULL ORDER BY p.id DESC LIMIT 1").bind(id).first();
}
export const publicPeople="WITH people AS (SELECT id,username,occupation,position,company,bio FROM users UNION ALL SELECT p.user_id,MAX(p.author),'','','','' FROM posts p LEFT JOIN users u ON u.id=p.user_id WHERE u.id IS NULL AND p.deleted_at IS NULL GROUP BY p.user_id)";
