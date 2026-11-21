import type { ProfileSettings } from "./domain";
export const rehabCatalog = [
 ["achilles","Achilles","Staw skokowy"],["pht","PHT","Tył uda"],["quadriceps","Czworogłowy","Przód uda"],
 ["patellar","Ścięgno rzepki","Kolano"],["plantar","Rozcięgno podeszwowe","Stopa"],["tibialis-posterior","Ścięgno piszczelowego tylnego","Staw skokowy"],
 ["peroneal","Ścięgna strzałkowe","Staw skokowy"],["adductors","Przywodziciele","Pachwina"],["gluteal","Ścięgna pośladkowe","Biodro"],
 ["iliopsoas","Zginacze biodra","Biodro"],["rotator-cuff","Stożek rotatorów","Bark"],["biceps","Ścięgno bicepsa","Bark"],
 ["triceps","Ścięgno tricepsa","Łokieć"],["wrist-extensors","Prostowniki nadgarstka","Łokieć"],["wrist-flexors","Zginacze nadgarstka","Łokieć"],
 ["wrist","Nadgarstek i dłoń","Nadgarstek"],["neck","Okolica szyjna","Kręgosłup"],["lower-back","Okolica lędźwiowa","Kręgosłup"],
] as const;
export function linkRehabArea(settings: ProfileSettings, area: readonly [string,string,string], injuryId?: string): ProfileSettings {
 const normalized=(value:string)=>value.normalize("NFKC").trim().toLowerCase();
 const existing=settings.rehabSites.find(site=>site.id===area[0] || (normalized(site.name)===normalized(area[1]) && normalized(site.bodyArea)===normalized(area[2])));
 const id=existing?.id ?? area[0];
 if(!existing && settings.rehabSites.length>=50) return settings;
 const position=settings.rehabSites.filter(site=>!site.archived).length;
 return {...settings,rehabSites: existing ? settings.rehabSites.map(site=>site.id===id ? {...site,active:true,archived:false,position:site.archived?position:site.position}:site) : [...settings.rehabSites,{id,name:area[1],bodyArea:area[2],position,active:true,archived:false}],
 injuries:settings.injuries.map(injury=>injury.id===injuryId ? {...injury,siteIds:[...new Set([...injury.siteIds,id])]}:injury)};
}
