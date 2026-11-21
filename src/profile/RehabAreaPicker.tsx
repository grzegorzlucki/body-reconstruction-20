import { useState } from "react";
import { ui } from "../i18n/config";
import { rehabCatalog } from "../rehabCatalog";
export function RehabAreaPicker({ onChoose, disabled }: {onChoose:(area:readonly [string,string,string])=>void;disabled:boolean}) {
 const [query,setQuery]=useState("");
 const [open,setOpen]=useState(false);
 const [name,setName]=useState(""), [body,setBody]=useState("");
 return <details className="rehab-picker" open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary>{ui("Wybierz z katalogu obszarów")}</summary>{open && <>
 <label>{ui("Szukaj obszaru")}<input type="search" value={query} onChange={event=>setQuery(event.target.value)} disabled={disabled}/></label>
 <div className="rehab-picker-options">{rehabCatalog.filter(area=>`${ui(area[1])} ${ui(area[2])}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(area=><button key={area[0]} type="button" className="secondary" disabled={disabled} onClick={()=>onChoose(area)}>{ui(area[1])} · {ui(area[2])}</button>)}</div>
 <div className="grid two"><label>{ui("Własny obszar")}<input maxLength={100} value={name} onChange={event=>setName(event.target.value)} disabled={disabled}/></label><label>{ui("Część ciała")}<input maxLength={100} value={body} onChange={event=>setBody(event.target.value)} disabled={disabled}/></label></div>
 <button type="button" className="secondary" disabled={disabled || !name.trim() || !body.trim()} onClick={()=>{onChoose([crypto.randomUUID(),name.trim(),body.trim()]);setName("");setBody("");}}>{ui("Dodaj własny obszar")}</button>
 </>}</details>;
}
