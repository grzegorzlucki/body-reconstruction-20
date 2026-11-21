import { expect,it } from "vitest";
import { linkRehabArea,rehabCatalog } from "./rehabCatalog";
import { profileSettingsSchema } from "./domain";
const settings=()=>profileSettingsSchema.parse({name:"Test",weeklyGoal:2,checkInTime:"08:00",rehabSites:[{id:"achilles",name:"Achilles",bodyArea:"Staw skokowy",position:0,active:false,archived:false}],painContexts:[],injuries:[{id:"injury",name:"Test",side:"left",startedOn:"2026-01-01",status:"active",siteIds:["achilles"],note:"",position:0}]});
it("reuses an area and links it once even when chosen repeatedly",()=>{
 const once=linkRehabArea(settings(),rehabCatalog[0],"injury"); const twice=linkRehabArea(once,rehabCatalog[0],"injury");
 expect(twice.rehabSites).toHaveLength(1); expect(twice.rehabSites[0].active).toBe(true); expect(twice.injuries[0].siteIds).toEqual(["achilles"]);
});
it("adds a newly selected area to monitoring and the injury in the same draft",()=>{
 const value=linkRehabArea(settings(),rehabCatalog[3],"injury"); expect(value.rehabSites).toHaveLength(2); expect(value.injuries[0].siteIds).toEqual(["achilles","patellar"]);
 expect(profileSettingsSchema.safeParse(settings()).success).toBe(true);
});
