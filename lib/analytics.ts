export const DAY=86400000;
export const chinaDay=(timestamp=Date.now())=>new Date(timestamp+8*3600000).toISOString().slice(0,10);
export const dayStart=(day:string)=>Date.parse(day+'T00:00:00+08:00');
export const addDays=(day:string,n:number)=>chinaDay(dayStart(day)+n*DAY);
export function trackingStart(db:any,now=Date.now()){return db.prepare("INSERT OR IGNORE INTO analytics_state (key,value) VALUES ('startedAt',?)").bind(now)}
export function articleMetric(db:any,id:number,field:'views'|'likes'|'unlikes'|'saves'|'unsaves',condition='',args:unknown[]=[]){
 return db.prepare(`INSERT INTO article_daily (user_id,post_id,day,${field}) SELECT user_id,id,?,1 FROM posts WHERE id=? ${field==='unlikes'||field==='unsaves'?'':'AND deleted_at IS NULL'} ${condition} ON CONFLICT(user_id,post_id,day) DO UPDATE SET ${field}=${field}+1`).bind(chinaDay(),id,...args);
}
export function followMetric(db:any,owner:string,follower:string,adding:boolean){const column=adding?'added':'removed';return db.prepare(`INSERT INTO follower_daily (user_id,day,${column}) SELECT ?,?,1 WHERE ${adding?'NOT ':''}EXISTS (SELECT 1 FROM follows WHERE follower_id=? AND following_id=?) ON CONFLICT(user_id,day) DO UPDATE SET ${column}=${column}+1`).bind(owner,chinaDay(),follower,owner)}
export async function activity(db:any,id:string,year:number){
 const today=chinaDay(),start=year+'-01-01',end=year+'-12-31';
 const rows=await db.prepare("SELECT date(created_at/1000,'unixepoch','+8 hours') AS day,COUNT(*) AS count FROM posts WHERE user_id=? AND deleted_at IS NULL AND created_at>=? AND created_at<? GROUP BY day ORDER BY day").bind(id,dayStart(start),dayStart((year+1)+'-01-01')).all();
 const first=await db.prepare('SELECT MIN(created_at) AS n FROM posts WHERE user_id=? AND deleted_at IS NULL').bind(id).first();
 const map=new Map<string,number>(rows.results.map((r:any)=>[r.day,r.count]));let activeDays=0,total=0,longest=0,streak=0;const days=[];
 for(let day=start;day<=end;day=addDays(day,1)){const future=day>today,count=future?0:map.get(day)||0;days.push({day,count,future});total+=count;if(count){activeDays++;streak++;longest=Math.max(longest,streak)}else streak=0}
 let current=0,cursor=map.get(today)?today:addDays(today,-1);if(year===Number(today.slice(0,4)))while(cursor>=start&&(map.get(cursor)||0)>0){current++;cursor=addDays(cursor,-1)}
 return {year,today,days,total,activeDays,longestStreak:longest,currentStreak:current,firstYear:first?.n?Number(chinaDay(first.n).slice(0,4)):Number(today.slice(0,4)),lastYear:Number(today.slice(0,4))};
}
