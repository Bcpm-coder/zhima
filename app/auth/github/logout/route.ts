import {env} from 'cloudflare:workers';
import {cookie,cookieName} from '../../../auth';
import {hash,readCookie} from '../../../../lib/github-oauth';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const origin=new URL(req.url).origin;if(req.headers.get('origin')!==origin)return new Response(null,{status:403});
 const token=readCookie(req.headers.get('cookie'),cookieName(origin,'session'));
 if(token&&/^[a-f0-9]{64}$/.test(token))await env.DB!.prepare('DELETE FROM github_sessions WHERE token_hash=?').bind(await hash(token)).run();
 return Response.json({ok:true},{headers:{'Set-Cookie':cookie(origin,'session','',0),'Cache-Control':'no-store'}});
}
