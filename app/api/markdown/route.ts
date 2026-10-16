import {renderMarkdown} from '../../../lib/markdown';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const headers={'Cache-Control':'no-store'};if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'请求来源无效'},{status:403,headers});
 if(Number(req.headers.get('content-length')||0)>150000)return Response.json({error:'文档过长'},{status:413,headers});
 try{const raw=await req.text();if(raw.length>100000)return Response.json({error:'文档过长'},{status:413,headers});const b=JSON.parse(raw);if(!b||typeof b.source!=='string'||b.source.length>30000)return Response.json({error:'Markdown 正文最多 30000 字'},{status:400,headers});return Response.json({html:renderMarkdown(b.source)},{headers})}catch{return Response.json({error:'预览失败，请检查文档格式'},{status:400,headers})}
}
