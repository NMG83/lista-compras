/* Menu & Compras V2 — sem frameworks; RTDB + Auth, ou demonstração local isolada. */
(() => {
'use strict';
const cfg = window.MENU_COMPRAS_CONFIG || {};
const CATEGORIES = [
  ['Fruta e Legumes','♧','green'],['Carne','♧','pink'],['Peixe','♒','green'],
  ['Charcutaria','▤','pink'],['Laticínios','◉','green'],['Padaria','♨','orange'],
  ['Congelados','❄',''],['Conservas','▣',''],['Mercearia','♧','orange'],
  ['Bebidas','◌',''],['Higiene','✦','pink'],['Limpeza da Casa','◇',''],['Outros','⬡','']
];
const SUPERMARKETS = ['Indiferente','Continente','Pingo Doce','Lidl','Aldi','Mercadona','Auchan','Outro'];
const CATEGORY_NAMES = CATEGORIES.map(x => x[0]);
const $ = id => document.getElementById(id);
const escape = str => String(str ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = str => String(str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-PT').trim().replace(/\s+/g,' ');
const makeId = () => (globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2));
const dayISO = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const parseDay = iso => new Date(`${iso}T12:00:00`);
const shiftDate = (date, days) => {let d=new Date(date);d.setDate(d.getDate()+days);return d;};
const weekStart = (date) => shiftDate(new Date(date.getFullYear(),date.getMonth(),date.getDate(),12), -((date.getDay()+1)%7));
const blank = () => ({shoppingItems:{},meals:{},productPreferences:{},mealHistory:{}});
let state = {view:'shopping', demo:false, user:null, db:null, refs:[], data:blank(), week:weekStart(new Date()), hideDone:localStorage.getItem('mc_hide_done')==='true', authorized:false, busy:false};
let toastTimer;
function notify(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function setConnection(message,kind=''){$('connectionBadge').textContent=message;$('connectionBadge').className='connection '+kind;}
function showLogin(error=''){$('app').hidden=true;$('bottomNav').hidden=true;$('loginView').hidden=false;$('loginError').hidden=!error;$('loginError').textContent=error;}
function showApp(){ $('loginView').hidden=true;$('app').hidden=false;$('bottomNav').hidden=false;$('householdName').textContent=state.demo?'Demonstração':(cfg.householdName||'Família');$('logoutBtn').textContent=state.demo?'Fechar demo':'Sair';setConnection(state.demo?'Modo demonstração · apenas neste dispositivo':'A sincronizar…',state.demo?'warning':''); switchView(state.view); }
function switchView(view){state.view=view;$('shoppingView').hidden=view!=='shopping';$('mealsView').hidden=view!=='meals';$('screenTitle').textContent=view==='shopping'?'Compras':'Refeições';document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));render();}
function saveDemo(){if(state.demo)localStorage.setItem('mc_v2_demo',JSON.stringify(state.data));}
function demoStart(){state.demo=true;state.authorized=true;state.user={uid:'demo',email:'demo@local.invalid'};let stored=localStorage.getItem('mc_v2_demo');try{state.data=stored?JSON.parse(stored):blank();}catch{state.data=blank();}if(!stored){['atum','grão','café','pão','leite'].forEach(n=>{let id=makeId();state.data.shoppingItems[id]={name:n,category:inferCategory(n),supermarket:'Indiferente',completed:false,createdAt:Date.now(),completedAt:null,createdBy:'demo'};});saveDemo();}showApp();setConnection('Modo demonstração · não partilhado','warning');}
function dbRef(path){return state.db.ref(`households/${cfg.householdId||'familia'}/${path}`);}
async function write(path,value,operation='set'){
 if(state.demo){const parts=path.split('/');let parent=state.data;for(let i=0;i<parts.length-1;i++){parent[parts[i]]??={};parent=parent[parts[i]];}if(operation==='remove')delete parent[parts.at(-1)];else if(operation==='update')parent[parts.at(-1)]={...(parent[parts.at(-1)]||{}),...value};else parent[parts.at(-1)]=value;saveDemo();render();return;}
 if(!state.authorized)throw Error('Acesso não autorizado');
 const ref=dbRef(path);if(operation==='remove')return ref.remove();if(operation==='update')return ref.update(value);return ref.set(value);
}
function realSubscriptions(){
 state.refs.forEach(r=>r.off());state.refs=[];
 for(const collection of Object.keys(blank())){let ref=dbRef(collection);ref.on('value',snap=>{state.data[collection]=snap.val()||{};setConnection('Sincronizado · partilhado em tempo real');render();},err=>{setConnection('Erro de sincronização: '+err.message,'error');});state.refs.push(ref);}
}
function wordsCategory(name){
 const n=norm(name);
 const sets=[
 ['Fruta e Legumes', ['banana','maca','pera','laranja','tomate','alface','cebola','cenoura','batata','alho','abacate','limao','morango','pepino','brocol','couve','fruta','legume']],
 ['Carne',['bife','frango','hamburguer','carne','peru','porco','vaca','costeleta','salsicha fresca']],
 ['Peixe',['salmao','atum fresco','bacalhau','peixe','pescada','camarao','dourada','robalo','sardinha']],
 ['Charcutaria',['fiambre','presunto','chourico','mortadela','bacon','salame']],
 ['Laticínios',['leite','queijo','iogurte','manteiga','natas','requeijao','kefir']],
 ['Padaria',['pao','broa','croissant','bolacha de padaria','baguete']],
 ['Congelados',['gelado','congelad','ervilha congelad','pizza congelada']],
 ['Conservas',['atum','grao','feijao','milho','sardinha em lata','conserva']],
 ['Mercearia',['cafe','arroz','massa','azeite','farinha','acucar','sal','cereal','bolacha','chocolate','vinagre','oleo','especiaria','pimenta']],
 ['Bebidas',['agua','sumo','coca-cola','refrigerante','cerveja','vinho','cha frio']],
 ['Higiene',['champ','gel de banho','pasta de dentes','desodorizante','sabonete','papel higienico','escova de dentes']],
 ['Limpeza da Casa',['detergente','amaciador','lixivia','limpeza','esfregao','pastilhas maquina','saco do lixo','papel cozinha']]
 ];
 for(const [cat,words] of sets){if(words.some(w=>n===w||n.startsWith(w+' ')||n.includes(' '+w+' ')||n.startsWith(w)))return cat;}
 return 'Outros';
}
function preferenceFor(name){return state.data.productPreferences[norm(name).replace(/[.#$\[\]\/]/g,'_')]||null;}
function prefKey(name){return norm(name).replace(/[.#$\[\]\/]/g,'_').slice(0,100);}
function inferCategory(name){let pref=preferenceFor(name);return pref?.preferredCategory || wordsCategory(name);}
function inferSupermarket(name){return preferenceFor(name)?.preferredSupermarket||'Indiferente';}
function collectionItems(){return Object.entries(state.data.shoppingItems||{}).map(([id,v])=>({id,...v}));}
async function addItem(name, silent=false){const n=String(name||'').trim().slice(0,100);if(!n)return;const items=collectionItems();if(items.some(i=>!i.completed&&norm(i.name)===norm(n))){if(!silent)notify('Este produto já está na lista.');return;}
 let item={name:n,category:inferCategory(n),supermarket:inferSupermarket(n),completed:false,createdAt:Date.now(),completedAt:null,createdBy:state.user?.uid||'demo'};
 const id=makeId();await write('shoppingItems/'+id,item);if(!silent)notify('Produto adicionado.');
 // A classificação por IA não bloqueia a criação e nunca altera preferências manuais.
 if(!preferenceFor(n)&&!state.demo&&cfg.aiEnabled)classifyByAI(n,id,item.category).catch(()=>{});
}
async function classifyByAI(name,id,initialCategory){
 const result=await askAI('classify',{name,knownCategories:CATEGORY_NAMES});if(!result?.category || !CATEGORY_NAMES.includes(result.category))return;
 if(preferenceFor(name))return;const current=state.data.shoppingItems[id];if(!current||current.name!==name||current.category!==initialCategory)return;
 const changes={};if(result.category!==initialCategory)changes.category=result.category; if(SUPERMARKETS.includes(result.supermarket) && result.supermarket!=='Indiferente' && current.supermarket==='Indiferente')changes.supermarket=result.supermarket; if(Object.keys(changes).length)await write('shoppingItems/'+id,changes,'update');
}
async function patchItem(id,changes){return write('shoppingItems/'+id,changes,'update');}
function renderShopping(){let all=collectionItems();let groups=$('shoppingGroups');groups.replaceChildren();$('clearDoneBtn').hidden=!all.some(x=>x.completed);$('hideDoneBtn').textContent=state.hideDone?'◉  Mostrar concluídos':'◎  Ocultar concluídos';
 const visible=state.hideDone?all.filter(x=>!x.completed):all;$('shoppingEmpty').hidden=visible.length>0;$('shoppingEmpty').textContent=all.length?'Todos os produtos estão concluídos.':'Ainda não há produtos para comprar.';
 CATEGORIES.forEach(([cat,icon,color])=>{const items=visible.filter(i=>i.category===cat||(cat==='Outros'&&!CATEGORY_NAMES.includes(i.category))).sort((a,b)=>Number(a.completed)-Number(b.completed)||b.createdAt-a.createdAt);if(!items.length)return;
 const section=document.createElement('section');section.className='category-block';section.innerHTML=`<div class="category-head"><span class="category-icon">${escape(icon)}</span> <span>${escape(cat)}</span><span class="category-count">${items.length}</span></div><div class="category-list"></div>`;const list=section.querySelector('.category-list');
 items.forEach(i=>{const row=document.createElement('div');row.className='shopping-row';const displayCat=CATEGORIES.find(c=>c[0]===i.category)||CATEGORIES.at(-1);
 row.innerHTML=`<button class="circle-check ${i.completed?'checked':''}" type="button" aria-label="${i.completed?'Desmarcar':'Marcar como comprado'} ${escape(i.name)}">${i.completed?'✓':''}</button><button class="item-name ${i.completed?'done':''}" type="button" title="Editar produto">${escape(i.name)}</button><span class="cat-pill ${escape(displayCat[2])}" title="${escape(i.supermarket||'Indiferente')}">${escape(displayCat[1])} ${escape(displayCat[0])}</span><button type="button" class="delete-btn" title="Apagar ${escape(i.name)}" aria-label="Apagar ${escape(i.name)}">×</button>`;
 row.querySelector('.circle-check').onclick=()=>patchItem(i.id,{completed:!i.completed,completedAt:i.completed?null:Date.now()}).catch(showError);
 row.querySelector('.item-name').onclick=()=>editItemModal(i);
 row.querySelector('.delete-btn').onclick=()=>confirmModal('Eliminar produto?',`Queres remover “${i.name}” da lista?`,'Eliminar',()=>write('shoppingItems/'+i.id,null,'remove'));
 list.appendChild(row);});groups.appendChild(section);});
}
function renderMeals(){let monday=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];let start=state.week,end=shiftDate(start,6);let monthFmt=d=>d.toLocaleDateString('pt-PT',{month:'long'});$('weekLabel').textContent=start.getMonth()===end.getMonth()?`${start.getDate()} – ${end.getDate()} ${monthFmt(end)} ${end.getFullYear()}`:`${start.getDate()} ${monthFmt(start)} – ${end.getDate()} ${monthFmt(end)}`;let grid=$('mealGrid');grid.replaceChildren();
 for(let ix=0;ix<7;ix++){let date=shiftDate(start,ix);let iso=dayISO(date);let row=document.createElement('div');row.className='meal-day-row';let lbl=document.createElement('div');lbl.className='day-label'+(iso===dayISO(new Date())?' today':'');lbl.innerHTML=`<strong>${escape(monday[date.getDay()].replace(/^./,c=>c.toUpperCase()))}</strong><small>${date.toLocaleDateString('pt-PT',{day:'2-digit',month:'short'})}</small>`;row.appendChild(lbl);
 for(let type of ['lunch','dinner']){let m=state.data.meals[iso]?.[type]||null;let button=document.createElement('button');button.type='button';button.className='meal-card'+(!m?.mealName?' empty-meal':'')+(m?.eatingAtHome===false?' out':'');button.innerHTML=`<span class="meal-label">${type==='lunch'?'Almoço':'Jantar'}</span><span class="meal-value">${escape(m?.eatingAtHome===false?'Fora de casa':m?.mealName||'+ Escolher refeição')}</span>`;button.onclick=()=>editMealModal(iso,type);row.appendChild(button);}grid.appendChild(row);}
}
function render(){if($('app').hidden)return;renderShopping();renderMeals();}
function modal(title,body,buttons=[]){$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modalActions').replaceChildren();for(const {label,kind,action} of buttons){let b=document.createElement('button');b.textContent=label;b.className=kind==='primary'?'primary-btn': 'outline-btn';b.onclick=async()=>{try{await action();closeModal();}catch(err){showError(err);}};$('modalActions').appendChild(b);}$('modalOverlay').hidden=false;}
function closeModal(){$('modalOverlay').hidden=true;}
function confirmModal(title,message,confirmLabel,onConfirm){modal(title,`<p>${escape(message)}</p>`,[{label:'Cancelar',action:()=>{}},{label:confirmLabel,kind:'primary',action:onConfirm}]);}
function optionsHtml(items,selected){return items.map(n=>`<option value="${escape(n)}" ${n===selected?'selected':''}>${escape(n)}</option>`).join('');}
function editItemModal(item){modal('Editar produto',`<label for="editName">Produto</label><input id="editName" maxlength="100" value="${escape(item.name)}"><label for="editCategory">Categoria</label><select id="editCategory">${optionsHtml(CATEGORY_NAMES,item.category)}</select><label for="editShop">Supermercado preferido</label><select id="editShop">${optionsHtml(SUPERMARKETS,item.supermarket||'Indiferente')}</select><p>As alterações de categoria e supermercado serão lembradas para a próxima vez.</p>`,[{label:'Cancelar',action:()=>{}},{label:'Guardar',kind:'primary',action:async()=>{let name=$('editName').value.trim();let category=$('editCategory').value;let supermarket=$('editShop').value;if(!name)throw Error('Indica um produto.');await patchItem(item.id,{name,category,supermarket});let pref={productName:name,preferredCategory:category,preferredSupermarket:supermarket,lastUsed:Date.now()};await write('productPreferences/'+prefKey(name),pref);notify('Produto atualizado.');}}]);}
function mealAt(date,type){return state.data.meals[date]?.[type]||null;}
async function saveMeal(iso,type,mealName,eatingAtHome=true,notes=''){let name=String(mealName||'').trim().slice(0,150);let meal={date:iso,mealType:type,mealName:name,eatingAtHome,notes:String(notes||'').slice(0,500),updatedAt:Date.now()};await write(`meals/${iso}/${type}`,meal);if(name){let key=prefKey(name);await write(`mealHistory/${key}`,{mealName:name,lastUsed:Date.now()});}notify('Refeição guardada.');}
function editMealModal(iso,type){const old=mealAt(iso,type);const dateLabel=parseDay(iso).toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'});let history=Object.values(state.data.mealHistory||{}).filter(v=>v.mealName).sort((a,b)=>b.lastUsed-a.lastUsed).slice(0,12);
 modal(`${type==='lunch'?'Almoço':'Jantar'} · ${dateLabel}`,`<label for="mealName">Refeição</label><input id="mealName" maxlength="150" placeholder="Ex.: Bacalhau à Brás" value="${escape(old?.mealName||'')}"><div class="checkline"><input id="eatingHome" type="checkbox" ${old?.eatingAtHome===false?'':'checked'}><label for="eatingHome" style="margin:0">Vamos comer em casa</label></div><label for="mealNotes">Notas (opcional)</label><textarea id="mealNotes" maxlength="500" placeholder="Notas da refeição">${escape(old?.notes||'')}</textarea><div class="history-chips" id="mealHistoryChips"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px"><button type="button" id="copyMeal" class="outline-btn">Copiar para outro dia</button><button type="button" id="ingredientsMeal" class="outline-btn">Ingredientes → Compras</button><button type="button" id="deleteMeal" class="outline-btn">Apagar</button></div>`,[{label:'Cancelar',action:()=>{}},{label:'Guardar',kind:'primary',action:()=>saveMeal(iso,type,$('mealName').value,$('eatingHome').checked,$('mealNotes').value)}]);
 let chips=$('mealHistoryChips');history.forEach(h=>{let b=document.createElement('button');b.type='button';b.className='chip';b.textContent=h.mealName;b.onclick=()=>$('mealName').value=h.mealName;chips.appendChild(b);});
 $('deleteMeal').onclick=()=>confirmModal('Eliminar refeição?',`Apagar a refeição de ${dateLabel}?`,'Eliminar',()=>write(`meals/${iso}/${type}`,null,'remove'));
 $('copyMeal').onclick=()=>{let name=$('mealName').value.trim();if(!name)return notify('Indica primeiro uma refeição.');copyMealModal(name);};
 $('ingredientsMeal').onclick=()=>{let name=$('mealName').value.trim();if(!name)return notify('Indica primeiro uma refeição.');ingredientsModal(name);};
}
function copyMealModal(mealName){let date=dayISO(new Date());modal('Copiar refeição',`<p>Copiar “${escape(mealName)}” para:</p><label for="copyDate">Data</label><input id="copyDate" type="date" value="${date}"><label for="copyType">Refeição</label><select id="copyType"><option value="lunch">Almoço</option><option value="dinner">Jantar</option></select>`,[{label:'Cancelar',action:()=>{}},{label:'Copiar',kind:'primary',action:async()=>{let iso=$('copyDate').value,type=$('copyType').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))throw Error('Indica uma data válida.');if(mealAt(iso,type)&&!confirm('Já existe uma refeição nesse dia. Substituir?'))return;await saveMeal(iso,type,mealName);}}]);}
const LOCAL_RECIPES=[[/hamburguer/,['hambúrgueres','pão de hambúrguer','queijo','alface','tomate','cebola']],[/salada cesar/,['alface','frango','croutons','parmesão','molho César']],[/bacalhau a bras/,['bacalhau','batata palha','ovos','cebola','salsa','azeitonas']],[/massa/,['massa','tomate','alho','azeite']],[/sopa/,['cenoura','batata','cebola','courgette']],[/arroz de frango/,['frango','arroz','cebola','alho']]];
async function ingredientsModal(name){modal('Ingredientes para compras',`<p>A obter sugestões para “${escape(name)}”…</p>`,[{label:'Fechar',action:()=>{}}]);let suggested=[];let source='IA';try{if(!state.demo&&cfg.aiEnabled){let response=await askAI('ingredients',{mealName:name});suggested=(response.ingredients||[]).map(x=>String(x).slice(0,100));}}catch{}
 if(!suggested.length){let recipe=LOCAL_RECIPES.find(([r])=>r.test(norm(name)));suggested=recipe?recipe[1]:[];source='lista básica local';}
 if(!suggested.length){$('modalBody').innerHTML='<p>Não foi possível obter ingredientes. A IA requer configuração do Netlify. Podes adicioná-los manualmente na lista.</p>';return;}
 if($('modalOverlay').hidden || $('modalTitle').textContent!=='Ingredientes para compras')return;
 $('modalBody').innerHTML=`<p>Sugestão (${escape(source)}). Confirma os ingredientes antes de os adicionar.</p><div class="ingredient-list">${suggested.map((s,i)=>`<label><input type="checkbox" value="${i}" checked><span>${escape(s)}</span></label>`).join('')}</div>`;
 $('modalActions').replaceChildren();let close=document.createElement('button');close.className='outline-btn';close.textContent='Cancelar';close.onclick=closeModal;let add=document.createElement('button');add.className='primary-btn';add.textContent='Adicionar selecionados';add.onclick=async()=>{let idx=[...$('modalBody').querySelectorAll('input:checked')].map(i=>Number(i.value));try{for(let i of idx)await addItem(suggested[i],true);closeModal();notify(`${idx.length} ingredientes processados.`);switchView('shopping');}catch(e){showError(e);}};$('modalActions').append(close,add);
}
function showError(error){console.error(error);notify(error?.message||'Não foi possível concluir a operação.');}
async function askAI(mode,payload){if(state.demo)throw Error('A IA não está ativa na demonstração.');if(!cfg.aiEnabled)throw Error('Assistente desativado.');if(!state.user)throw Error('É necessário entrar na conta.');
 const token=await firebase.auth().currentUser.getIdToken();const response=await fetch('/.netlify/functions/ai',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+token},body:JSON.stringify({mode,payload})});if(!response.ok){const err=await response.json().catch(()=>({error:'Serviço indisponível'}));throw Error(err.error||'A IA não está disponível.');}return response.json();}
function chatAdd(text,who='assistant'){let node=document.createElement('div');node.className='chat-bubble '+who;node.textContent=text;$('chatMessages').appendChild(node);$('chatMessages').scrollTop=$('chatMessages').scrollHeight;}
async function sendChat(e){e.preventDefault();let message=$('chatInput').value.trim();if(!message)return;$('chatInput').value='';chatAdd(message,'user');const send=$('chatForm').querySelector('button[type=submit]');send.disabled=true;
 try{if(state.demo){let match=message.match(/^adiciona (.+)$/i);if(match){let items=match[1].split(/,|\s+e\s+/i).map(s=>s.trim());chatAdd('Posso propor a adição de '+items.join(', ')+'. Confirma a operação.');showProposedActions(items.map(name=>({type:'add_item',name})));return;}throw Error('Na demonstração, experimenta “Adiciona leite e bananas”. Para respostas reais, configura o serviço de IA.');}
 let shopping=collectionItems().slice(0,120).map(i=>({id:i.id,name:i.name,completed:i.completed,category:i.category}));let meals=[];for(let k=0;k<7;k++){let date=dayISO(shiftDate(state.week,k));for(let type of ['lunch','dinner']){let m=mealAt(date,type);if(m)meals.push({date,type,mealName:m.mealName,eatingAtHome:m.eatingAtHome});}}
 let res=await askAI('assistant',{message,view:state.view,shopping,meals,weekStart:dayISO(state.week),categories:CATEGORY_NAMES});chatAdd(res.reply||'Aqui está a minha proposta.');if(res.actions?.length)showProposedActions(res.actions);
 }catch(err){chatAdd(err.message||'Não foi possível contactar a IA.');}finally{send.disabled=false;}}
function describeAction(a){switch(a.type){case 'add_item':return `Adicionar “${a.name}”`;case 'remove_item':return `Remover “${a.name}”`;case 'complete_item':return `Marcar “${a.name}” como comprado`;case 'set_meal':return `Definir ${a.typeMeal==='lunch'?'almoço':'jantar'} de ${a.date}: ${a.mealName||'Fora de casa'}`;case 'clear_meal':return `Apagar refeição de ${a.date}`;case 'swap_meals':return `Trocar refeições entre ${a.date} e ${a.otherDate}`;default:return 'Ação não reconhecida';}}
function showProposedActions(actions){let preview=$('aiPending');preview.replaceChildren();let div=document.createElement('div');div.className='action-preview';div.appendChild(document.createTextNode(`${actions.length} ação(ões) proposta(s):`));let ul=document.createElement('ul');actions.forEach(a=>{let li=document.createElement('li');li.textContent=describeAction(a);ul.appendChild(li);});div.appendChild(ul);let row=document.createElement('div');row.style.display='flex';row.style.gap='8px';let confirmButton=document.createElement('button');confirmButton.className='primary-btn';confirmButton.textContent='Confirmar ações';confirmButton.onclick=async()=>{confirmButton.disabled=true;let done=0;try{for(const a of actions.slice(0,25)){await runProposedAction(a);done++;}chatAdd(`Aplicadas ${done} ações.`);preview.replaceChildren();}catch(err){showError(err);chatAdd(`Aplicadas ${done} ações antes do erro. Confirma o estado atual da lista.`);}finally{confirmButton.disabled=false;}};let cancel=document.createElement('button');cancel.className='outline-btn';cancel.textContent='Cancelar';cancel.onclick=()=>preview.replaceChildren();row.append(confirmButton,cancel);div.appendChild(row);preview.appendChild(div);}
async function runProposedAction(a){const name=String(a.name||'').trim();let existing=collectionItems().find(i=>norm(i.name)===norm(name));if(a.type==='add_item'){if(name)await addItem(name,true);return;}if(a.type==='remove_item'){if(existing)await write('shoppingItems/'+existing.id,null,'remove');return;}if(a.type==='complete_item'){if(existing)await patchItem(existing.id,{completed:true,completedAt:Date.now()});return;}
 const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'');const typ=t=>t==='lunch'||t==='dinner';if(a.type==='set_meal'&&validDate(a.date)&&typ(a.typeMeal)){await saveMeal(a.date,a.typeMeal,a.mealName||'',a.eatingAtHome!==false);return;}if(a.type==='clear_meal'&&validDate(a.date)&&typ(a.typeMeal)){await write(`meals/${a.date}/${a.typeMeal}`,null,'remove');return;}
 if(a.type==='swap_meals'&&validDate(a.date)&&validDate(a.otherDate)&&typ(a.typeMeal)&&typ(a.otherTypeMeal)){let first=mealAt(a.date,a.typeMeal),second=mealAt(a.otherDate,a.otherTypeMeal);if(second)await saveMeal(a.date,a.typeMeal,second.mealName,second.eatingAtHome,second.notes);else await write(`meals/${a.date}/${a.typeMeal}`,null,'remove');if(first)await saveMeal(a.otherDate,a.otherTypeMeal,first.mealName,first.eatingAtHome,first.notes);else await write(`meals/${a.otherDate}/${a.otherTypeMeal}`,null,'remove');}}
async function login(e){e.preventDefault();let btn=$('loginBtn');btn.disabled=true;$('loginError').hidden=true;try{await firebase.auth().signInWithEmailAndPassword($('email').value.trim(),$('password').value);}catch(err){showLogin('Não foi possível entrar. Verifica o email e a palavra-passe.');}finally{btn.disabled=false;}}
async function logout(){if(state.demo){state.demo=false;state.authorized=false;state.user=null;state.data=blank();showLogin();return;}state.refs.forEach(r=>r.off());state.refs=[];state.authorized=false;await firebase.auth().signOut();}
async function authChanged(user){state.refs.forEach(r=>r.off());state.refs=[];state.data=blank();state.authorized=false;state.user=user;if(!user){showLogin();return;}try{const allowed=await dbRef('members/'+user.uid).once('value');if(allowed.val()!==true){await firebase.auth().signOut();showLogin('Esta conta não tem autorização para aceder à família.');return;}state.authorized=true;showApp();realSubscriptions();}catch(err){showLogin('Sem acesso autorizado. Verifica as regras da base de dados e a ligação à Internet.');}}
function attachEvents(){document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));$('demoBtn').onclick=demoStart;$('logoutBtn').onclick=logout;$('loginForm').onsubmit=login;
 $('addForm').onsubmit=async e=>{e.preventDefault();let inp=$('newItem');let n=inp.value.trim();if(!n)return;inp.value='';try{await addItem(n);}catch(err){inp.value=n;showError(err);}};
 $('hideDoneBtn').onclick=()=>{state.hideDone=!state.hideDone;localStorage.setItem('mc_hide_done',String(state.hideDone));renderShopping();};$('clearDoneBtn').onclick=()=>{const ids=collectionItems().filter(i=>i.completed).map(i=>i.id);confirmModal('Limpar concluídos?',`Eliminar definitivamente ${ids.length} produto(s) já comprado(s)?`,'Limpar',async()=>{for(let id of ids)await write('shoppingItems/'+id,null,'remove');notify('Produtos concluídos eliminados.');});};
 $('prevWeek').onclick=()=>{state.week=shiftDate(state.week,-7);renderMeals();};$('nextWeek').onclick=()=>{state.week=shiftDate(state.week,7);renderMeals();};$('thisWeek').onclick=()=>{state.week=weekStart(new Date());renderMeals();};
 $('closeModal').onclick=closeModal;$('modalOverlay').onclick=e=>{if(e.target===$('modalOverlay'))closeModal();};document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();$('aiPanel').hidden=true;}});
 $('aiButton').onclick=()=>{$('aiPanel').hidden=false;$('chatInput').focus();};$('closeAI').onclick=()=>$('aiPanel').hidden=true;$('chatForm').onsubmit=sendChat;
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)$('micBtn').hidden=true;else $('micBtn').onclick=()=>{let r=new SR();r.lang='pt-PT';r.onresult=e=>{$('chatInput').value=e.results[0][0].transcript;$('chatInput').focus();};r.onerror=()=>notify('Ditado indisponível neste dispositivo.');r.start();};
 $('resetPassword').onclick=async()=>{let email=$('email').value.trim();if(!email)return notify('Introduz o email da conta.');try{await firebase.auth().sendPasswordResetEmail(email);notify('Se a conta existir, receberás instruções por email.');}catch{notify('Não foi possível enviar o email.');}};
}
function init(){attachEvents();$('demoArea').hidden=cfg.allowDemo===false;if(!cfg.firebase?.apiKey || !cfg.firebase?.databaseURL || !cfg.firebase?.authDomain || !cfg.firebase?.projectId){showLogin();$('loginError').textContent='Firebase ainda não configurado. Podes experimentar a demonstração.';$('loginError').hidden=false;$('loginForm').querySelector('button').disabled=true;$('resetPassword').hidden=true;return;}
 try{firebase.initializeApp(cfg.firebase);state.db=firebase.database();firebase.auth().onAuthStateChanged(authChanged,()=>showLogin('Erro ao validar a sessão.'));}catch(err){showLogin('Configuração Firebase inválida.');}}
init();
})();
