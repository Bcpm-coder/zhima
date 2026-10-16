import {env} from 'cloudflare:workers';
export type Profile={id:string;provider:string;username:string;email:string|null;email_public:number;occupation:string;position:string;company:string;bio:string;created_at:number;updated_at:number};
export async function ensureProfile(identity:{userId:string;fullName:string|null;provider:string}){
 const db=env.DB!;let p=await db.prepare('SELECT * FROM users WHERE id=?').bind(identity.userId).first<Profile>();
 if(!p){const now=Date.now();let name=(identity.fullName||'开发者').trim().replace(/[\x00-\x1f\x7f<>]/g,'').slice(0,32);if([...name].length<2)name='开发者';await db.prepare('INSERT OR IGNORE INTO users (id,provider,username,email,bio,created_at,updated_at) VALUES (?,?,?,NULL,?,?,?)').bind(identity.userId,identity.provider,name,'',now,now).run();p=await db.prepare('SELECT * FROM users WHERE id=?').bind(identity.userId).first<Profile>()}
 if(!p)throw new Error('Unable to load user profile');return p;
}
