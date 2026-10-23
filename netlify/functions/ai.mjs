/** Netlify Function — verificação obrigatória do Firebase ID Token e pertença à família. */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

const json = (obj, status=200) => new Response(JSON.stringify(obj),{
 status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});
function initAdmin(){
 if(!getApps().length){
  const projectId=process.env.FIREBASE_PROJECT_ID;
  const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
  const databaseURL=process.env.FIREBASE_DATABASE_URL;
  if(!projectId||!clientEmail||!privateKey||!databaseURL)throw Error('Firebase Admin não configurado');
  initializeApp({credential:cert({projectId,clientEmail,privateKey}),databaseURL});
 }
}
const schema = (properties, required=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
const s={type:'string'};const actionSchema=schema({
 type:{type:'string',enum:['add_item','remove_item','complete_item','set_meal','clear_meal','swap_meals']},
 name:s,date:s,typeMeal:{type:'string',enum:['lunch','dinner']},otherDate:s,
 otherTypeMeal:{type:'string',enum:['lunch','dinner']},mealName:s,eatingAtHome:{type:'boolean'}
});
const specs={
 classify:{name:'category_result',schema:schema({category:s,supermarket:s}),instructions:'És um classificador de artigos de supermercado em Portugal. Escolhe uma única categoria exata da lista fornecida. Se houver dúvida, devolve Outros. Escolhe o supermercado apenas se o nome do artigo mencionar expressamente Continente, Pingo Doce, Lidl, Aldi, Mercadona ou Auchan; caso contrário usa Indiferente. Devolve apenas JSON.'},
 ingredients:{name:'ingredients_result',schema:schema({ingredients:{type:'array',items:s}}),instructions:'És um assistente de cozinha portuguesa. A partir do prato, lista os principais ingredientes que a família poderá precisar de comprar, no máximo 18, sem quantidades e sem repetir. Devolve JSON.'},
 assistant:{name:'assistant_result',schema:schema({reply:s,actions:{type:'array',items:actionSchema}}),instructions:'És um assistente familiar de refeições e compras, em português de Portugal. Responde com um resumo útil e ações concretas em JSON. Só propõe operações explicitamente pedidas. Nunca alteres refeições existentes sem uma instrução clara. Para sugestões vagas sobre o menu, preenche apenas espaços vazios da semana, não sobrescrevendo refeições. Usa apenas os seis tipos de ação permitidos, com todos os campos preenchidos (strings vazias para campos que não se aplicam, eatingAtHome true por defeito). Usa datas ISO YYYY-MM-DD e typeMeal/otherTypeMeal lunch ou dinner. Para pedidos apenas informativos devolve actions: []. Para remover ou completar produtos, usa exatamente o nome da lista recebida. No máximo 20 ações.'}
};

export default async function handler(request){
 if(request.method!=='POST')return json({error:'Método não permitido'},405);
 try{
  if(!process.env.OPENAI_API_KEY)return json({error:'A IA ainda não está configurada no Netlify.'},503);
  initAdmin();
  const authHeader=request.headers.get('authorization')||'';
  if(!authHeader.startsWith('Bearer '))return json({error:'Autenticação necessária'},401);
  const token=authHeader.slice(7);
  const decoded=await getAuth().verifyIdToken(token,true);
  const householdId=process.env.HOUSEHOLD_ID||'familia';
  if(!/^[a-zA-Z0-9_-]{1,60}$/.test(householdId))return json({error:'Configuração familiar inválida'},500);
  const membership=await getDatabase().ref(`households/${householdId}/members/${decoded.uid}`).get();
  if(membership.val()!==true)return json({error:'Conta não autorizada'},403);
  const body=await request.json();
  const mode=body?.mode,payload=body?.payload;
  if(!specs[mode]||!payload||typeof payload!=='object')return json({error:'Pedido inválido'},400);
  if(JSON.stringify(payload).length>16000)return json({error:'Pedido demasiado grande'},413);
  const spec=specs[mode];
  const openAIResponse=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',headers:{'authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'content-type':'application/json'},
    body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4o-mini',store:false,max_output_tokens:1500,
       instructions:spec.instructions,
       input:JSON.stringify(payload),
       text:{format:{type:'json_schema',name:spec.name,strict:true,schema:spec.schema}}})
  });
  const ai=await openAIResponse.json();
  if(!openAIResponse.ok){console.error('OpenAI',ai?.error?.type,ai?.error?.code);return json({error:'O serviço de IA não conseguiu processar o pedido.'},502);}
  const raw=ai.output?.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('')||ai.output_text;
  if(!raw)return json({error:'Resposta vazia da IA'},502);
  const result=JSON.parse(raw);
  if(mode==='classify'){let valid=Array.isArray(payload.knownCategories)?payload.knownCategories:[];if(!valid.includes(result.category))result.category='Outros';}
  if(mode==='ingredients')result.ingredients=(result.ingredients||[]).filter(x=>typeof x==='string'&&x.length<100).slice(0,18);
  if(mode==='assistant')result.actions=(result.actions||[]).filter(a=>a&&typeof a.type==='string').slice(0,20);
  return json(result);
 }catch(error){console.error('AI handler',error?.message);return json({error:'Não foi possível completar o pedido. Verifica a configuração e tenta novamente.'},500);}
}
