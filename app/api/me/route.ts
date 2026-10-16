import {env} from 'cloudflare:workers';
import {getUser} from '../../auth';
import {validateProfile} from '../../../lib/profile-validation';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){try{const user=await getUser();if(!user)return json({error:'请先登录'},401);const db=env.DB!;const [posts,bookmarks,likes,postCount]=await Promise.all([db.prepare('SELECT id,title,category,created_at FROM posts WHERE user_id=? AND deleted_at IS NULL ORDER BY id DESC LIMIT 100').bind(user.userId).all(),db.prepare('SELECT COUNT(*) AS count FROM bookmarks WHERE user_id=?').bind(user.userId).first(),db.prepare('SELECT COUNT(*) AS count FROM likes WHERE user_id=?').bind(user.userId).first(),db.prepare('SELECT COUNT(*) AS count FROM posts WHERE user_id=? AND deleted_at IS NULL').bind(user.userId).first<{count:number}>()]);return json({profile:user.profile,posts:posts.results,stats:{posts:postCount?.count||0,bookmarks,likes}})}catch{return json({error:'资料加载失败，请稍后重试'},503)}}
export async function PATCH(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'请求来源无效'},403);
 const user=await getUser();if(!user)return json({error:'请先登录'},401);
 if(Number(req.headers.get('content-length')||0)>5000)return json({error:'资料过长'},413);const raw=await req.text();if(raw.length>5000)return json({error:'资料过长'},413);
 let profile;try{profile=validateProfile(JSON.parse(raw))}catch(e){return json({error:e instanceof Error?e.message:'资料无效'},400)}
 profile.email_public=profile.email?(profile.email_public??user.profile.email_public):0;
 profile.occupation??=user.profile.occupation;profile.position??=user.profile.position;profile.company??=user.profile.company;
 await env.DB!.prepare('UPDATE users SET username=?,email=?,bio=?,email_public=?,occupation=?,position=?,company=?,updated_at=? WHERE id=?').bind(profile.username,profile.email,profile.bio,profile.email_public,profile.occupation,profile.position,profile.company,Date.now(),user.userId).run();
 return json({ok:true,profile:{...user.profile,...profile,updated_at:Date.now()}});
 }catch{return json({error:'保存失败，请稍后重试'},500)}}
