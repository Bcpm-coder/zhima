import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {getChatGPTUser} from './chatgpt-auth';
import {ensureProfile} from './user-profile';
import {hash,readCookie} from '../lib/github-oauth';
export const githubReady=()=>!!(env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET);
export const githubCallback=(origin:string)=>origin+'/auth/github/callback';
export function cookieName(origin:string,kind:'session'|'oauth'){return (new URL(origin).protocol==='https:'?'__Host-':'')+'devnote-gh-'+kind}
export function cookie(origin:string,kind:'session'|'oauth',value:string,maxAge:number){return `${cookieName(origin,kind)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(origin).protocol==='https:'?'; Secure':''}`}
async function getIdentity(){
 if(githubReady()){
  const h=await headers();const raw=h.get('cookie');const token=readCookie(raw,'__Host-devnote-gh-session')||readCookie(raw,'devnote-gh-session');
  if(token&&/^[a-f0-9]{64}$/.test(token)){
   const s=await env.DB!.prepare('SELECT user_id,display_name FROM github_sessions WHERE token_hash=? AND expires_at>?').bind(await hash(token),Date.now()).first<{user_id:string;display_name:string}>();
   if(s)return {userId:s.user_id,fullName:s.display_name,provider:'github'};
  }
 }
 const u=await getChatGPTUser();return u?{userId:u.userId,fullName:u.fullName,provider:'chatgpt'}:null;
}

export async function getUser(){const identity=await getIdentity();if(!identity)return null;const profile=await ensureProfile(identity);return {...identity,fullName:profile.username,profile};}
