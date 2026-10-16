import {marked} from 'marked';
import sanitizeHtml from 'sanitize-html';
export function renderMarkdown(source:string){
 const html=marked.parse(source.replace(/^\uFEFF/,''),{gfm:true,breaks:false,async:false}) as string;
 return sanitizeHtml(html,{allowedTags:['h1','h2','h3','h4','h5','h6','p','br','hr','blockquote','ul','ol','li','strong','em','del','s','pre','code','a','img','table','thead','tbody','tr','th','td','input','span'],allowedAttributes:{a:['href','title','target','rel'],img:['src','alt','title'],code:['class'],input:['type','checked','disabled'],th:['align'],td:['align']},allowedSchemes:['https','http','mailto'],allowProtocolRelative:false,transformTags:{a:(_tag,attrs)=>({tagName:'a',attribs:{...attrs,target:'_blank',rel:'noopener noreferrer'}}),input:(_tag,attrs)=>({tagName:'input',attribs:{type:'checkbox',disabled:'',...(Object.hasOwn(attrs,'checked')?{checked:''}:{})}})}});
}
