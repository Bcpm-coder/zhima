import {env} from 'cloudflare:workers';
import {githubReady,githubCallback,cookie,cookieName} from '../../../auth';
import {readCookie,hash,randomToken,githubIdentity} from '../../../../lib/github-oauth';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const url=new URL(req.url),origin=url.origin;
 const fail=(message:string,status=400)=>new Response(message+' 返回首页重试。',{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':cookie(origin,'oauth','',0)}});
 if(!githubReady())return fail('GitHub 登录尚未配置。',503);
 const state=url.searchParams.get('state'),code=url.searchParams.get('code');
 if(!state||!/^[a-f0-9]{64}$/.test(state)||state!==readCookie(req.headers.get('cookie'),cookieName(origin,'oauth')))return fail('登录校验失败。');
 try{
 const flow=await env.DB!.prepare('DELETE FROM github_oauth_states WHERE state_hash=? AND expires_at>? RETURNING verifier').bind(await hash(state),Date.now()).first<{verifier:string}>();
 if(!flow)return fail('登录请求已过期或已使用。');
 if(url.searchParams.has('error')||!code||code.length>1024)return fail('GitHub 授权未完成。');
 const identity=await githubIdentity({clientId:env.GITHUB_CLIENT_ID!,secret:env.GITHUB_CLIENT_SECRET!,redirectUri:githubCallback(origin)},code,flow.verifier);
 const session=randomToken();await env.DB!.prepare('INSERT INTO github_sessions (token_hash,user_id,display_name,expires_at) VALUES (?,?,?,?)').bind(await hash(session),identity.userId,identity.displayName,Date.now()+7*86400000).run();
 const h=new Headers({'Location':'/','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});h.append('Set-Cookie',cookie(origin,'oauth','',0));h.append('Set-Cookie',cookie(origin,'session',session,7*86400));return new Response(null,{status:303,headers:h});
 }catch{return fail('GitHub 登录失败，请稍后重试。',502)}
}
