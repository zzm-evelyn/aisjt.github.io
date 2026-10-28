# SJT公开演示部署

完整平台的 app/、components/、lib/、API及施测功能全部保留。本次新增 apps/public-demo，是独立的静态演示入口。不要用根项目的构建输出部署演示。

## 演示范围

使用已有 synthetic_placeholder 校园4题案例的白名单内容：故事、事件、题干及选项。无模型API，无正式施测，无服务端或浏览器持久存储；刷新清空本页选择。回放是已有结果展示，不是实时生成，不输出心理测评分数。

## GitHub Pages（推荐，无需服务器）

1. 用GitHub Desktop克隆 zzm-evelyn/aisjt.github.io 到新的本地目录。
2. 将本修复包全部文件合并覆盖到克隆目录，保留仓库.git和原CNAME；不要删除仓库原有文件。核对提交列表没有数据库、data/runs、data/demo、.local或密钥。
3. Commit并Push到main。本包只修复代码及新增演示，不修改任何DNS记录。
4. 仓库 Settings → Pages → Build and deployment → Source 从 Deploy from a branch 改为 GitHub Actions。
5. 保留Custom domain为bfsjt.site，不重新修改阿里云解析。
6. Actions → Build and deploy public SJT demo → Run workflow，等待build和deploy均成功。
7. 打开 https://bfsjt.site/。HTTP返回200还不够，应看到“让情景成为测验的起点”，并能回放、体验四题。

使用用户提供的现有自定义域名根路径。若改用默认project Pages的/aisjt.github.io/子路径，需要另外设置Next basePath，不能直接复用本配置。

工作流从 apps/public-demo 独立 npm ci，检查测试、lint、构建、类型、产物边界，再仅上传 out。不会安装或运行根平台API，不需要管理员密码或任何API Key。

## Vercel备选

Import同一仓库，Root Directory设为 apps/public-demo，Framework为Next.js，Build Command为npm run build，Output Directory为out，Node为24.x。不填写数据库或模型密钥。先使用自动分配的预览域名验证，无需修改生产DNS。部署到正式域名前另外确认。

本地SQLite写入、管理员会话数据库、用户回答及上传图片不能直接依赖Vercel Functions的本地文件系统持久保存。Next API路由可以在Vercel运行，但原平台存储实现需要另行改造。

## 本地复验

```powershell
Set-Location '你的仓库克隆目录\apps\public-demo'
npm ci
npm test
npm run lint
npm run build
npm run typecheck
npm run audit:export
```

独立静态产物在 apps/public-demo/out，也可上传到其他静态托管平台。不要把 node_modules、.next、out 或构建日志当作源代码提交。

## 完整平台边界

根目录完整平台仍需三份私有JSON作为现有构建依赖，这些文件没有加入公开修复包：
- data/demo/university-placeholder.json
- data/runs/university-echoes-2.0.json
- data/runs/university-single-scenarios.json

演示自己的 lib/case.json 是独立白名单合成示例，不依赖这三份私有文件。完整平台若要部署正式后台，仍需单独准备私有输入、数据库、图片和认证配置。公开演示构建通过不等于完整后台已完成云端适配。
