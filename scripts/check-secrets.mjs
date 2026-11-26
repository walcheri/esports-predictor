import { execFileSync } from 'node:child_process';
import { readFileSync,statSync } from 'node:fs';
const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const failed=[];
for(const path of paths){
 if(statSync(path).size>2_000_000)continue;
 const content=readFileSync(path,'utf8');
 let secret=/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/.test(content)||/\bgsk_[a-zA-Z0-9]{30,}\b/.test(content);
 for(const match of content.matchAll(/eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){
  try{if(JSON.parse(Buffer.from(match[1],'base64url').toString()).role==='service_role')secret=true;}catch{/* not a valid JWT */}
 }
 if(secret)failed.push(path);
}
if(failed.length){console.error('Potential secrets in files (values redacted):',failed.join(', '));process.exitCode=1;}
else console.log('PASS: tracked/review files checked for private keys, Groq keys and service-role JWTs. Opaque provider secrets require manual review.');
