/* Migração não destrutiva de /lista (V1) para /households/familia/shoppingItems.
  Executar localmente (NUNCA no navegador), com credenciais administrativas via
  GOOGLE_APPLICATION_CREDENTIALS e FIREBASE_DATABASE_URL. */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
const url = process.env.FIREBASE_DATABASE_URL;
if(!url || !process.env.GOOGLE_APPLICATION_CREDENTIALS){
  console.error('Define FIREBASE_DATABASE_URL e GOOGLE_APPLICATION_CREDENTIALS (ficheiro privado fora do repositório).');process.exit(1);
}
const app=initializeApp({credential:applicationDefault(),databaseURL:url});
const db=getDatabase(app);const householdId=process.env.HOUSEHOLD_ID||'familia';
const source=(await db.ref('/lista').get()).val()||{};
const entries=Object.entries(source);
let migrated=0,skipped=0;
for(const [legacyId, item] of entries){
 const name=String(item?.nome||'').trim().slice(0,100);
 if(!name){skipped++;continue;}
 const id=legacyId.replace(/[.#$\[\]/]/g,'_');
 const dest=db.ref(`households/${householdId}/shoppingItems/${id}`);
 if((await dest.get()).exists()){skipped++;continue;}
 await dest.set({name,category:'Outros',supermarket:'Indiferente',completed:Boolean(item.feito),createdAt:Number(item.addedAt)||Date.now(),completedAt:Number(item.doneAt)||null,createdBy:'migracao_v1'});
 migrated++;
}
console.log(`Migração concluída: ${migrated} artigos migrados, ${skipped} ignorados. A lista V1 não foi apagada.`);
process.exit(0);