const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=async(p,m='GET',b)=>{let r,j;try{r=await fetch('/api/'+p,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});j=await r.json()}catch{throw new Error('Сервер не запущен. Выполните node server.js и откройте http://localhost:3000')}if(!r.ok)throw new Error(j.error||'Ошибка');return j};
let tt;const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('show'),3200)};
const run=f=>async(...a)=>{try{await f(...a)}catch(e){toast(e.message)}};
const EM={lesson:'📚',meeting:'🤝',deal:'💼',other:'⏰'};let me=null,mode='register';

/* ---------- 3D заголовок: слои с выдавливанием + реакция на мышь ---------- */
const titles=[...document.querySelectorAll('.t3d')].map(el=>{
  const n=el.classList.contains('big')?22:10,step=el.classList.contains('big')?2.4:1.6;
  for(let i=0;i<n;i++){const s=document.createElement('span');s.textContent=el.dataset.t;
    if(i===0)s.style.cssText='color:#fff;text-shadow:0 0 40px rgba(47,123,255,.8)';
    else{s.style.transform=`translateZ(${-i*step}px)`;s.style.color=`hsl(220,85%,${48-i*(34/n)}%)`}
    el.appendChild(s)}return el});
let mx=0,my=0;addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5});
const still=matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ---------- Three.js фон: аватарка, кольца, частицы ---------- */
const cv=$('#bg'),R=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});R.setPixelRatio(Math.min(devicePixelRatio,2));
const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(50,1,.1,100);cam.position.z=8;
const tex=new THREE.TextureLoader().load('avatar.png'),logo=new THREE.Group();
logo.add(new THREE.Mesh(new THREE.CircleGeometry(1.8,64),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide})));
const ring=new THREE.Mesh(new THREE.TorusGeometry(2.3,.025,16,120),new THREE.MeshBasicMaterial({color:0x2f7bff}));
const ring2=new THREE.Mesh(new THREE.TorusGeometry(2.7,.015,16,120),new THREE.MeshBasicMaterial({color:0x7fb0ff,transparent:true,opacity:.6}));
logo.add(ring,ring2);sc.add(logo);
const shapes=[];for(let i=0;i<9;i++){const m=new THREE.Mesh(i%2?new THREE.OctahedronGeometry(.35):new THREE.IcosahedronGeometry(.3),new THREE.MeshBasicMaterial({color:0x2f7bff,wireframe:true,transparent:true,opacity:.7}));
  m.position.set((Math.random()-.5)*16,(Math.random()-.5)*9,(Math.random()-.5)*6-1);m.userData.s=Math.random()+.3;sc.add(m);shapes.push(m)}
const pg=new THREE.BufferGeometry(),pa=new Float32Array(900);for(let i=0;i<900;i++)pa[i]=(Math.random()-.5)*(i%3===2?14:26);
pg.setAttribute('position',new THREE.BufferAttribute(pa,3));const pts=new THREE.Points(pg,new THREE.PointsMaterial({color:0x8fb8ff,size:.05}));sc.add(pts);
const size=()=>{R.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();
  const w=innerWidth>900;logo.position.set(w?4:0,w?0:2.2,0);logo.scale.setScalar(w?1:.5)};addEventListener('resize',size);size();
let t0=performance.now();
(function loop(){requestAnimationFrame(loop);const t=(performance.now()-t0)/1000,k=still?0:1;
  logo.rotation.y=Math.sin(t*.8)*.5*k+mx*.9;logo.rotation.x=my*.6;logo.position.y+=(Math.sin(t*1.2)*.0015)*k;
  ring.rotation.x=t*.6*k;ring2.rotation.y=t*.4*k;pts.rotation.y=t*.02*k;
  shapes.forEach(s=>{s.rotation.x+=.004*s.userData.s*k;s.rotation.y+=.006*s.userData.s*k});
  cam.position.x+=(mx*1.2-cam.position.x)*.05;cam.position.y+=(-my*.8-cam.position.y)*.05;cam.lookAt(0,0,0);R.render(sc,cam);
  const sway=Math.sin(t*.9)*12*k;
  titles.forEach((el,i)=>el.style.transform=`rotateY(${sway+mx*26}deg) rotateX(${-my*16+Math.cos(t*.7)*3*k}deg)`)})();
/* наклон карточек */
document.addEventListener('pointermove',e=>{const c=e.target.closest?.('.card');if(!c||innerWidth<700)return;const r=c.getBoundingClientRect();
  c.style.transform=`rotateY(${((e.clientX-r.left)/r.width-.5)*6}deg) rotateX(${-((e.clientY-r.top)/r.height-.5)*6}deg)`});
document.addEventListener('pointerout',e=>{const c=e.target.closest?.('.card');if(c)c.style.transform=''});

/* ---------- Авторизация ---------- */
const dlg=$('#dlg');
const setMode=m=>{mode=m;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  $('#an').style.display=m==='register'?'':'none';$('#asub').textContent=m==='register'?'Создать аккаунт':'Войти';$('#aerr').textContent=''};
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>setMode(b.dataset.m));
$('#close').onclick=()=>dlg.close();
$('#authBtn').onclick=async()=>{if(me){await api('logout','POST');me=null;render();toast('Вы вышли')}else{setMode('login');dlg.showModal()}};
$('#cta').onclick=()=>{if(me)$('#app').scrollIntoView();else{setMode('register');dlg.showModal()}};
$('#af').onsubmit=async e=>{e.preventDefault();try{me=await api(mode,'POST',{name:$('#an').value,email:$('#ae').value,password:$('#ap').value});dlg.close();render();$('#app').scrollIntoView();toast('Добро пожаловать!')}catch(x){$('#aerr').textContent=x.message}};

/* ---------- Кабинет ---------- */
function render(){
  $('#app').hidden=!me;$('#authBtn').textContent=me?'Выйти':'Войти';$('#cta').textContent=me?'Перейти в кабинет':'Подключить бота';if(!me)return;
  $('#uname').textContent=me.name;
  const s1=$('#s1'),s2=$('#s2');s1.textContent=me.hasBot?'@'+me.botName:'не подключён';s1.classList.toggle('on',me.hasBot);
  s2.textContent=me.chatId?'ID '+me.chatId:'не выбран';s2.classList.toggle('on',!!me.chatId);if(me.chatId)$('#chatId').value=me.chatId;
  $('#list').innerHTML=me.reminders.length?me.reminders.map((r,i)=>`<li class="${r.sent?'sent':''}" style="animation-delay:${i*60}ms"><span class="e">${EM[r.type]}</span><div class="m"><b>${esc(r.title)}</b><small>${new Date(r.time).toLocaleString('ru-RU',{dateStyle:'medium',timeStyle:'short'})}${r.before?' · за '+r.before+' мин':''}${r.sent?' · отправлено ✓':''}</small></div><button data-id="${r.id}" aria-label="Удалить">×</button></li>`).join(''):'<li class="empty">Пока пусто — добавьте первое напоминание</li>'}
$('#list').onclick=run(async e=>{const id=e.target.dataset?.id;if(id){me=await api('del/'+id,'POST');render()}});
$('#saveBot').onclick=run(async()=>{me=await api('bot','POST',{token:$('#token').value});$('#token').value='';render();toast('Бот подключён: @'+me.botName)});
$('#find').onclick=run(async()=>{const {chats}=await api('findchat','POST');const box=$('#chats');
  box.innerHTML=chats.length?chats.map(c=>`<button data-id="${c.id}">${esc(c.title)}<small>${c.id} · ${c.type}</small></button>`).join(''):'<p>Ничего не найдено. Напишите боту /start и повторите поиск.</p>'});
$('#chats').onclick=run(async e=>{const b=e.target.closest('button');if(!b)return;me=await api('chat','POST',{chatId:b.dataset.id});render();toast('Chat ID сохранён')});
$('#saveChat').onclick=run(async()=>{me=await api('chat','POST',{chatId:$('#chatId').value});render();toast('Chat ID сохранён')});
$('#test').onclick=run(async()=>{await api('test','POST');toast('Тест отправлен — проверьте Telegram')});
$('#rf').onsubmit=run(async e=>{e.preventDefault();if(!me.chatId)return toast('Сначала выберите Chat ID');
  me=await api('reminders','POST',{title:$('#rt').value,type:$('#rtype').value,time:new Date($('#rtime').value).toISOString(),before:$('#rbefore').value,tz:Intl.DateTimeFormat().resolvedOptions().timeZone});
  $('#rt').value='';render();toast('Напоминание добавлено')});
api('me').then(u=>{me=u;render()}).catch(()=>{});
