import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
const root='out',files=[];
function walk(dir){for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory())walk(p);else files.push(p);}}
walk(root);
for(const required of ['index.html','.nojekyll','CNAME'])if(!files.includes(join(root,required)))throw new Error(`缺少静态部署文件 ${required}`);
const forbidden=/candidate_scoring_key|expert_confirmed_scoring_key|review_reports|university-echoes-2\.0|university-single-scenarios|sjt_admin_session|sk-[a-zA-Z0-9]{24,}/;
for(const file of files){if(/\.(json|js|html|txt|map)$/.test(file)&&forbidden.test(readFileSync(file,'utf8')))throw new Error(`产物包含禁止公开的标记：${file}`);if(/\.(sqlite|db|pem)$/.test(file))throw new Error(`产物含私有文件：${file}`);}
if(readFileSync(join(root,'CNAME'),'utf8').trim()!=='bfsjt.site')throw new Error('域名文件不匹配');
console.log(JSON.stringify({ok:true,files:files.length,bytes:files.reduce((sum,p)=>sum+statSync(p).size,0),scope:'static export only'}));
