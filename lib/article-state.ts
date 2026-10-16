// Read all per-article interaction data in one database round trip.
export async function articleState(db:any,id:number,user:{userId:string}|null,seed?:{likes:number;views:number}){
 const uid=user?.userId||'';
 const row=await db.prepare(`SELECT
 (SELECT user_id FROM posts WHERE id=? AND deleted_at IS NULL) AS owner,
 (SELECT COUNT(*) FROM likes WHERE post_id=?) AS likes,
 COALESCE((SELECT count FROM views WHERE post_id=?),0) AS views,
 EXISTS(SELECT 1 FROM likes WHERE user_id=? AND post_id=?) AS liked,
 EXISTS(SELECT 1 FROM bookmarks WHERE user_id=? AND post_id=?) AS saved`).bind(id,id,id,uid,id,uid,id).first();
 if(!seed&&!row?.owner)return null;
 return {authenticated:!!user,canEdit:!!user&&!seed&&row.owner===uid,likes:(seed?.likes||0)+row.likes,views:(seed?.views||0)+row.views,liked:!!user&&!!row.liked,saved:!!user&&!!row.saved};
}
