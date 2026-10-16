import {markdownCss} from '../../lib/markdown-style';
export function GET(){return new Response(markdownCss,{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'public, max-age=300'}})}
