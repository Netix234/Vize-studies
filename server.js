const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,DB=path.join(__dirname,'data.json'),PUB=path.join(__dirname,'public');
let db={users:[],sessions:{}};try{db=JSON.parse(fs.readFileSync(DB,'utf8'))}catch{}
const save=()=>fs.writeFileSync(DB,JSON.stringify(db,null,1));
const hash=(p,s)=>crypto.scryptSync(p,s,32).toString('hex');
const id=()=>crypto.randomBytes(12).toString('hex');
const MIME={'.html':'text/html;charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const tg=async(t,m,b)=>{const r=await fetch(`https://api.telegram.org/bot${t}/${m}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})});return r.json()};
const EMO={lesson:'📚',meeting:'🤝',deal:'💼',other:'⏰'};
const fail=(res,c,e)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e}))};
const ok=(res,o,h={})=>{res.writeHead(200,{'Content-Type':'application/json',...h});res.end(JSON.stringify(o))};
const body=req=>new Promise(r=>{let d='';req.on('data',c=>{d+=c;if(d.length>1e5)req.destroy()});req.on('end',()=>{try{r(JSON.parse(d||'{}'))}catch{r({})}})});
const pub=u=>({name:u.name,email:u.email,botName:u.botName||null,hasBot:!!u.token,chatId:u.chatId||null,reminders:u.reminders.sort((a,b)=>a.time.localeCompare(b.time))});
const text=r=>`${EMO[r.type]||'⏰'} ${r.title}\n🕐 Начало в ${new Date(r.time).toLocaleTimeString('ru-RU',{timeZone:r.tz||'UTC',hour:'2-digit',minute:'2-digit'})}`+(r.before?` (через ${r.before} мин)`:' — уже сейчас!');

async function api(req,res,p){
  const sid=(req.headers.cookie||'').match(/sid=([a-f0-9]+)/)?.[1];
  const user=db.users.find(u=>u.id===db.sessions[sid]);
  const b=req.method==='GET'?{}:await body(req);
  if(p==='register'){
    const email=String(b.email||'').trim().toLowerCase(),name=String(b.name||'').trim().slice(0,40);
    if(!name||!/^\S+@\S+\.\S+$/.test(email))return fail(res,400,'Введите имя и корректный email');
    if(String(b.password||'').length<6)return fail(res,400,'Пароль — минимум 6 символов');
    if(db.users.some(u=>u.email===email))return fail(res,400,'Этот email уже зарегистрирован');
    const salt=id(),u={id:id(),name,email,salt,pass:hash(b.password,salt),reminders:[]};db.users.push(u);
    const s=id();db.sessions[s]=u.id;save();return ok(res,pub(u),{'Set-Cookie':`sid=${s};HttpOnly;SameSite=Lax;Path=/;Max-Age=2592000`});
  }
  if(p==='login'){
    const u=db.users.find(u=>u.email===String(b.email||'').trim().toLowerCase());
    if(!u||hash(String(b.password||''),u.salt)!==u.pass)return fail(res,401,'Неверный email или пароль');
    const s=id();db.sessions[s]=u.id;save();return ok(res,pub(u),{'Set-Cookie':`sid=${s};HttpOnly;SameSite=Lax;Path=/;Max-Age=2592000`});
  }
  if(!user)return fail(res,401,'Нужно войти');
  if(p==='me')return ok(res,pub(user));
  if(p==='logout'){delete db.sessions[sid];save();return ok(res,{},{'Set-Cookie':'sid=;Path=/;Max-Age=0'})}
  if(p==='bot'){
    const t=String(b.token||'').trim(),r=await tg(t,'getMe').catch(()=>null);
    if(!r||!r.ok)return fail(res,400,'Токен не подошёл. Скопируйте его из @BotFather');
    user.token=t;user.botName=r.result.username;delete user.chatId;save();return ok(res,pub(user));
  }
  if(!user.token&&p!=='x')return fail(res,400,'Сначала подключите бота');
  if(p==='findchat'){
    const r=await tg(user.token,'getUpdates',{limit:100}).catch(()=>null);
    if(!r||!r.ok)return fail(res,400,r?.description||'Telegram не отвечает');
    const m=new Map();
    for(const u of r.result){const c=(u.message||u.my_chat_member||u.channel_post||u.edited_message||{}).chat;
      if(c)m.set(c.id,{id:c.id,title:c.title||[c.first_name,c.last_name].filter(Boolean).join(' ')||c.username||String(c.id),type:c.type})}
    return ok(res,{chats:[...m.values()]});
  }
  if(p==='chat'){user.chatId=String(b.chatId||'').trim();save();return ok(res,pub(user))}
  if(p==='test'){
    if(!user.chatId)return fail(res,400,'Сначала выберите Chat ID');
    const r=await tg(user.token,'sendMessage',{chat_id:user.chatId,text:'✅ Vize Studies на связи! Напоминания будут приходить сюда.'}).catch(()=>null);
    return r&&r.ok?ok(res,{}):fail(res,400,r?.description||'Не удалось отправить');
  }
  if(p==='reminders'){
    const t=new Date(b.time);if(!String(b.title||'').trim()||isNaN(t))return fail(res,400,'Укажите название и время');
    user.reminders.push({id:id(),title:String(b.title).trim().slice(0,120),type:EMO[b.type]?b.type:'other',time:t.toISOString(),before:Math.max(0,Math.min(1440,+b.before||0)),tz:String(b.tz||'UTC'),sent:false});
    save();return ok(res,pub(user));
  }
  if(p.startsWith('del/')){user.reminders=user.reminders.filter(r=>r.id!==p.slice(4));save();return ok(res,pub(user))}
  fail(res,404,'Не найдено');
}
http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,'http://x');
    if(u.pathname.startsWith('/api/'))return await api(req,res,u.pathname.slice(5));
    let f=path.normalize(path.join(PUB,u.pathname==='/'?'index.html':u.pathname));
    if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('404')}
    res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);
  }catch(e){console.error(e);fail(res,500,'Ошибка сервера')}
}).listen(PORT,()=>console.log(`Vize Studies: http://localhost:${PORT}`));
// Планировщик: проверка каждые 15 секунд.
// За 5 минут до начала бот присылает сообщение каждую минуту, в момент начала — финальное.
setInterval(async()=>{
  const now=Date.now();let dirty=false;
  for(const u of db.users){if(!u.token||!u.chatId)continue;
    const send=t=>tg(u.token,'sendMessage',{chat_id:u.chatId,text:t}).then(x=>x&&x.ok).catch(()=>false);
    for(const r of u.reminders){
      if(r.done===undefined&&r.sent){r.done=true;dirty=true}
      const t=new Date(r.time).getTime();
      if(!r.sent&&r.before>5&&now>=t-r.before*6e4){r.sent=true;dirty=true;if(!await send(text(r))&&now-t<36e5)r.sent=false}
      if(r.done)continue;
      if(now-t>36e5){r.done=r.sent=true;dirty=true;continue}
      if(now>=t-5*6e4){
        const left=Math.ceil((t-now)/6e4);
        if(r.lastKey!==left){
          const msg=left>0?`🔔 ${EMO[r.type]||'⏰'} ${r.title}\nНачинается через ${left} мин!`:`🚀 ${EMO[r.type]||'⏰'} ${r.title}\nНачинается прямо сейчас!`;
          if(await send(msg)){r.lastKey=left;dirty=true;if(left<=0){r.done=r.sent=true}}
        }
      }
    }}
  if(dirty)save();
},15000);
