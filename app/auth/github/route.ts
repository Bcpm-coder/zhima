import {env} from 'cloudflare:workers';
import {githubReady,githubCallback,cookie} from '../../auth';
import {randomToken,hash,challenge} from '../../../lib/github-oauth';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 if(!githubReady())return new Response('GitHub 登录尚未配置，请返回首页使用 ChatGPT 登录。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 try{
 const origin=new URL(req.url).origin;const state=randomToken(),verifier=randomToken();const now=Date.now();
 await env.DB!.batch([env.DB!.prepare('DELETE FROM github_oauth_states WHERE expires_at<?').bind(now),env.DB!.prepare('DELETE FROM github_sessions WHERE expires_at<?').bind(now),env.DB!.prepare('INSERT INTO github_oauth_states (state_hash,verifier,expires_at) VALUES (?,?,?)').bind(await hash(state),verifier,now+600000)]);
 const url=new URL('https://github.com/login/oauth/authorize');url.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID!,redirect_uri:githubCallback(origin),state,scope:'',code_challenge:await challenge(verifier),code_challenge_method:'S256',prompt:'select_account'}).toString();
 return new Response(null,{status:302,headers:{'Location':url.toString(),'Set-Cookie':cookie(origin,'oauth',state,600),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }catch{return new Response('暂时无法开始 GitHub 登录，请稍后重试。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}})}
}
