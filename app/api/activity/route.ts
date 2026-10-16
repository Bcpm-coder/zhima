import {env} from 'cloudflare:workers';
import {publicProfile,privateJson as json,socialError} from '../../../lib/social';
import {activity,chinaDay} from '../../../lib/analytics';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const url=new URL(req.url),id=url.searchParams.get('id')||'',current=Number(chinaDay().slice(0,4)),year=Number(url.searchParams.get('year')||current);if(!id||id.length>200||!Number.isInteger(year)||year<2000||year>current)return json({error:'日历参数无效'},400);if(!await publicProfile(env.DB!,id))return json({error:'用户不存在'},404);return json(await activity(env.DB!,id,year))}catch(e){return socialError(e,'分享日历加载失败')}}
