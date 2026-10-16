// No GitHub access tokens are persisted or returned to the browser.
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
export async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
export async function challenge(verifier:string){return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
export function readCookie(raw:string|null,name:string){return (raw||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||null}
export async function githubIdentity(config:{clientId:string;secret:string;redirectUri:string},code:string,verifier:string,fetcher:typeof fetch=fetch){
 const tokenResponse=await fetcher('https://github.com/login/oauth/access_token',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.secret,redirect_uri:config.redirectUri,code,code_verifier:verifier}),signal:AbortSignal.timeout(15000)});
 if(!tokenResponse.ok)throw new Error('GitHub token exchange failed');const token=await tokenResponse.json() as {access_token?:string;error?:string};if(token.error||!token.access_token)throw new Error('GitHub rejected authorization');
 const profileResponse=await fetcher('https://api.github.com/user',{headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+token.access_token,'User-Agent':'DevNote-Community','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000)});
 if(!profileResponse.ok)throw new Error('GitHub identity request failed');const profile=await profileResponse.json() as {id?:number;login?:string;name?:string};
 if(!Number.isSafeInteger(profile.id)||!profile.id||typeof profile.login!=='string'||!profile.login)throw new Error('Invalid GitHub identity');
 return {userId:'github:'+profile.id,displayName:(profile.name||profile.login).slice(0,100)};
}
