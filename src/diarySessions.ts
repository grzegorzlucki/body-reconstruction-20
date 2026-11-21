import type { Session } from "./domain";
export function diarySessions(sessions: Session[], selectedId: string, now = new Date()) {
  const start = new Date(now); start.setHours(0,0,0,0); start.setDate(start.getDate()-1);
  const end = new Date(now); end.setHours(0,0,0,0); end.setDate(end.getDate()+1);
  return sessions.filter(session => session.id === selectedId ||
    (Date.parse(session.started) < end.getTime() && Date.parse(session.ended ?? now.toISOString()) >= start.getTime()))
    .sort((a,b)=>Date.parse(b.started)-Date.parse(a.started));
}
