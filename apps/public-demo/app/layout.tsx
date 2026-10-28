import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import './globals.css';
export const metadata:Metadata={title:'情景判断测验生成平台 · 公开演示',description:'查看既有合成案例、回放开发流程并体验四题情景判断。无实时模型调用，不收集正式研究数据。'};
export default function Layout({children}:{children:ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}
