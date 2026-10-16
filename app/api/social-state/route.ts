import {env} from 'cloudflare:workers';
import {getUser,githubReady} from '../../auth';
import {privateJson as json,socialError} from '../../../lib/social';
export const dynamic='force-dynamic';
export async function GET(){try{const viewer=await getUser();const counts=viewer?await env.DB!.prepare('SELECT (SELECT COUNT(*) FROM messages WHERE recipient_id=? AND read_at IS NULL) AS unread,(SELECT COUNT(*) FROM notifications WHERE recipient_id=? AND read_at IS NULL) AS notifications').bind(viewer.userId,viewer.userId).first<{unread:number;notifications:number}>():null;return json({notifications:counts?.notifications||0,viewerId:viewer?.userId||null,name:viewer?.fullName||null,unread:counts?.unread||0,githubEnabled:githubReady()})}catch(e){return socialError(e,'消息状态加载失败')}}
