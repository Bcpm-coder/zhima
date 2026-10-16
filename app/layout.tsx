import type { Metadata } from 'next';
export const metadata:Metadata={title:'知码 · 开发者社区',description:'分享技术，记录成长的中文开发者社区'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
