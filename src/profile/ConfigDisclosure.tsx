import { useState, type ReactNode } from "react";
export function ConfigDisclosure({ title, initialOpen, children }: {title:string;initialOpen:boolean;children:ReactNode}) {
 const [expanded,setExpanded]=useState(initialOpen);
 return <details className="config-disclosure" open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}><summary>{title}</summary>{expanded && children}</details>;
}
