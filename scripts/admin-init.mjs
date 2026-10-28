import { randomBytes,scryptSync } from "node:crypto";
import { mkdirSync,writeFileSync,existsSync,chmodSync } from "node:fs";
import path from "node:path";
const folder=path.join(process.cwd(),".local");
const config=process.env.SJT_ADMIN_CONFIG_PATH??path.join(folder,"admin-auth.json");
if(existsSync(config)){console.error("管理员已初始化，未覆盖现有账户。");process.exitCode=1;}
else {
  mkdirSync(folder,{recursive:true});mkdirSync(path.dirname(config),{recursive:true});
  const password=randomBytes(24).toString("base64url"),salt=randomBytes(16).toString("hex");
  writeFileSync(config,JSON.stringify({salt,hash:scryptSync(password,salt,64).toString("hex")}),{flag:"wx",mode:0o600});
  const credentialPath=path.join(folder,"管理员初始密码.txt");
  writeFileSync(credentialPath,"管理员初始密码（仅本机保存，请妥善保管）\n"+password+"\n",{flag:"wx",mode:0o600});
  try{chmodSync(config,0o600);chmodSync(credentialPath,0o600);}catch{}
  console.log("管理员已初始化；密码仅写入 .local/管理员初始密码.txt，未输出到终端。");
}
