import sharp from "sharp";
import { mkdir,writeFile,readFile } from "node:fs/promises";
import path from "node:path";
import { createHash,randomUUID } from "node:crypto";
import { AssessmentError } from "./repository";
import type { TestRepository } from "./test-repository";
import type { Asset } from "./test-model";

export function assetDirectory() {return process.env.SJT_ASSET_DIR??path.join(process.cwd(),"data/assets");}
export async function encodeImage(buffer:Buffer) {
  if(buffer.length>8_000_000)throw new AssessmentError("图片大小不能超过 8MB",413);
  try{
    const metadata=await sharp(buffer,{limitInputPixels:24_000_000,failOn:"error"}).metadata();
    if(!["jpeg","png","webp"].includes(metadata.format??"")||(metadata.pages??1)!==1)throw new AssessmentError("请选择单张 JPG、PNG 或 WebP 图片");
    const {data,info}=await sharp(buffer,{limitInputPixels:24_000_000,failOn:"error"}).rotate().resize({width:2560,height:1600,fit:"inside",withoutEnlargement:true}).webp({quality:86}).toBuffer({resolveWithObject:true});
    return {data,width:info.width,height:info.height,hash:createHash("sha256").update(data).digest("hex")};
  }catch(e){if(e instanceof AssessmentError)throw e;throw new AssessmentError("图片无法读取或像素过大，请换一张图片");}
}
export async function storeImage(repository:TestRepository,buffer:Buffer,alt:string):Promise<Asset> {
  if(alt.length>200)throw new AssessmentError("图片说明不超过 200 字");
  const image=await encodeImage(buffer);
  await mkdir(assetDirectory(),{recursive:true});
  const filename=path.join(assetDirectory(),image.hash+".webp");
  try{await writeFile(filename,image.data,{flag:"wx"});}catch(e){if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e;}
  const stored=await readImage({hash:image.hash});
  if(!stored.equals(image.data))throw new AssessmentError("图片存储检查失败",409);
  return repository.addAsset({id:randomUUID(),hash:image.hash,width:image.width,height:image.height,bytes:image.data.length,alt:alt.trim(),createdAt:new Date().toISOString()});
}
export async function readImage(asset:Pick<Asset,"hash">) {
  if(!/^[a-f0-9]{64}$/.test(asset.hash))throw new AssessmentError("图片标识不正确",409);
  try{
    const buffer=await readFile(/* turbopackIgnore: true */ path.join(assetDirectory(),asset.hash+".webp"));
    if(createHash("sha256").update(buffer).digest("hex")!==asset.hash)throw new AssessmentError("图片完整性检查失败",409);
    return buffer;
  }catch(e){if(e instanceof AssessmentError)throw e;throw new AssessmentError("图片文件不存在，请检查服务器存储",409);}
}
