import {EVENT_COLOURS} from './calendar-colours.js?v=20261122-approved-calendar';
export {EVENT_COLOURS};
export const calendarDateKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
export function validCalendarDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(new Date(value+'T12:00:00').getTime())&&calendarDateKey(new Date(value+'T12:00:00'))===value;}
export function eventColour(type){return EVENT_COLOURS[type]||EVENT_COLOURS.event;}
export function formatCalendarRange(event){
 if(event.time_tbd)return 'Time to be arranged';if(event.all_day)return 'All day';
 const format=value=>BTSFormatTime(new Date(value));
 const start=format(event.start_time);return start+(event.end_time?' - '+format(event.end_time):' · End time to be arranged');
}
export function normaliseCalendarRows(rows,members,productions){
 const people=new Map(members.map(p=>[p.id,p])),allowed=new Set(productions.map(p=>p.id)),events=new Map();
 for(const row of Array.isArray(rows)?rows:[]){
  if(!people.has(row.profile_id)||!allowed.has(row.production_id)||!row.id||!Number.isFinite(new Date(row.start_time).getTime()))continue;
  const end=row.end_time&&new Date(row.end_time)>new Date(row.start_time)?row.end_time:null;
  const id=String(row.id),existing=events.get(id);const person=people.get(row.profile_id);
  if(existing){if(!existing.members.some(p=>p.id===person.id))existing.members.push({...person,call_status:row.call_status});continue;}
  events.set(id,{id,title:String(row.title||'Production event'),event_type:String(row.event_type||'event').toLowerCase(),production_id:row.production_id,production:String(row.production||productions.find(p=>p.id===row.production_id)?.title||'Production'),start_time:row.start_time,end_time:end,all_day:row.all_day===true,time_tbd:row.time_tbd===true,venue:String(row.venue||''),address:String(row.address||''),arrive_note:String(row.arrive_note||''),bring_note:String(row.bring_note||''),know_note:String(row.know_note||''),members:[{...person,call_status:row.call_status}]});
 }
 return [...events.values()];
}
