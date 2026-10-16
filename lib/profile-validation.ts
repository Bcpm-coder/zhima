export function validateProfile(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('资料格式无效');
 const b=input as Record<string,unknown>;if(Object.keys(b).some(k=>!['username','email','bio','emailPublic','occupation','position','company'].includes(k)))throw new Error('包含不允许修改的字段');
 if(typeof b.username!=='string'||typeof b.email!=='string'||typeof b.bio!=='string')throw new Error('请完整填写资料');
 if(b.emailPublic!==undefined&&typeof b.emailPublic!=='boolean')throw new Error('邮箱展示设置无效');
 const username=b.username.trim(),email=b.email.trim(),bio=b.bio.trim();
 if([...username].length<2||[...username].length>32||/[\x00-\x1f\x7f<>]/.test(username))throw new Error('用户名需为 2–32 个字符，不能包含控制字符或尖括号');
 if(email&&(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)))throw new Error('请输入有效的邮箱地址');
 if([...bio].length>160)throw new Error('个人简介最多 160 个字符');
 const career=(key:string,label:string)=>{if(b[key]===undefined)return undefined;if(typeof b[key]!=='string')throw new Error(label+'格式无效');const value=(b[key] as string).trim();if([...value].length>64||/[\x00-\x1f\x7f<>]/.test(value))throw new Error(label+'最多 64 个字符，不能包含控制字符或尖括号');return value;};
 return {occupation:career('occupation','职业方向'),position:career('position','职位'),company:career('company','公司 / 组织'),username,email:email||null,bio,email_public:b.emailPublic===undefined?undefined:b.emailPublic?1:0};
}
