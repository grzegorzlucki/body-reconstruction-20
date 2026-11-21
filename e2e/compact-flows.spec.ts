import { test, expect } from "@playwright/test";
test("injury catalog selection creates one monitored area and persists a single link",async({page})=>{
 await page.goto("./?view=profile&section=rehabilitation");
 await page.getByRole("button",{name:"Dodaj kontuzję",exact:true}).click();
 await page.getByLabel("Nazwa lub rozpoznanie").fill("Synthetic injury");
 const injury=page.locator(".injury-config").first();
 await injury.locator(".rehab-picker summary").click();
 const choice=injury.getByRole("button",{name:"Ścięgno rzepki · Kolano",exact:true});
 await choice.click(); await choice.click();
 const names=await page.locator('.rehab-site-config input').evaluateAll(inputs=>inputs.map(input=>(input as HTMLInputElement).value));
 expect(names.filter(name=>name==="Ścięgno rzepki")).toHaveLength(1);
 await page.getByRole("button",{name:"Zapisz ustawienia",exact:true}).click();
 await expect(page.getByRole("status").filter({hasText:"Ustawienia profilu zapisane"})).toBeVisible();
 await page.reload();
 const disclosure=page.locator(".config-disclosure").filter({hasText:"Synthetic injury"});
 await disclosure.locator("summary").first().click();
 await expect(disclosure.getByRole("checkbox",{name:"Ścięgno rzepki · Kolano",exact:true})).toBeChecked();
});
test("diary opens a form directly and workouts expose the historical editor",async({page})=>{
 await page.goto("./?view=diary");
 await expect(page.getByRole("heading",{name:"Nowy pomiar",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Nowy pomiar",exact:true})).toHaveCount(0);
 await page.goto("./?view=workout");
 await page.getByRole("button",{name:"Dodaj trening historyczny",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Dodaj trening historyczny",exact:true})).toBeVisible();
});
