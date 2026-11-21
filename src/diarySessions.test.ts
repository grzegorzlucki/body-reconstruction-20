import { expect, it } from "vitest";
import { diarySessions } from "./diarySessions";
import { newSession } from "./domain";
it("includes today, yesterday, overnight and the selected historic relationship",()=>{
 const now=new Date(2026,10,21,12);
 const make=(id:string,date:number,hour=10)=>({...newSession({},new Date(2026,10,date,hour).toISOString()),id,ended:new Date(2026,10,date,hour+1).toISOString()});
 const rows=[make("today",21),make("yesterday",20),make("old",18),make("future",22),{...make("overnight",19,23),ended:new Date(2026,10,20,1).toISOString()}];
 expect(diarySessions(rows,"",now).map(s=>s.id)).toEqual(["today","yesterday","overnight"]);
 expect(diarySessions(rows,"old",now).some(s=>s.id==="old")).toBe(true);
});
