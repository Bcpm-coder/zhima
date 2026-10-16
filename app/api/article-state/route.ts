import {env} from 'cloudflare:workers';
import {getUser} from '../../auth';
import seeds from '../../seeds.json';
import {articleState} from '../../../lib/article-state';
export const dynamic='force-dynamic';
export async function GET(req:Request){const headers={'Cache-Control':'private, no-store'};try{
 const id=Number(new URL(req.url).searchParams.get('id'));if(!Number.isSafeInteger(id)||id<1)return Response.json({error:'文章无效'},{status:400,headers});
 const state=await articleState(env.DB!,id,await getUser(),seeds.find(s=>s.id===id));
 return state?Response.json(state,{headers}):Response.json({error:'文章不存在或已删除'},{status:404,headers});
 }catch{return Response.json({error:'文章状态加载失败'},{status:503,headers})}}
