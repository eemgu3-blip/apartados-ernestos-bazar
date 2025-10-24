
import { jsPDF } from "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

const STORAGE_KEY = "ernestos_apartados_v1";
const installBtn = document.getElementById('installBtn');
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'inline-block';
});

installBtn.onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.style.display = 'none';
};

function uid(){ return Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4) }

function load(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }catch(e){return []} }
function save(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }

const nameEl = document.getElementById('name');
const saleIdEl = document.getElementById('saleId');
const phoneEl = document.getElementById('phone');
const productEl = document.getElementById('product');
const costEl = document.getElementById('cost');
const depositEl = document.getElementById('deposit');
const durationEl = document.getElementById('duration');
const locationEl = document.getElementById('location');
const boxEl = document.getElementById('box');
const bagEl = document.getElementById('bagColor');
const createBtn = document.getElementById('createBtn');
const clearBtn = document.getElementById('clearForm');
const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');

let items = load();
renderList();

createBtn.addEventListener('click', ()=>{
  const name = nameEl.value.trim();
  const saleId = saleIdEl.value.trim() || uid();
  const phone = phoneEl.value.trim();
  const product = productEl.value.trim();
  const cost = parseFloat((costEl.value || '0').replace(',', '.')) || 0;
  const deposit = parseFloat((depositEl.value || '0').replace(',', '.')) || 0;
  const duration = parseInt(durationEl.value || '15');
  const location = locationEl.value.trim();
  const box = boxEl.value.trim();
  const bag = bagEl.value.trim();
  if(!name || !product || cost<=0){ alert('Nombre, producto y costo son obligatorios'); return }
  const item = {
    id: uid(),
    saleId,
    name,
    phone,
    product,
    productCost: cost,
    depositRequiredPercent:30,
    depositTaken: deposit,
    startDate: new Date().toISOString(),
    durationDays: duration,
    location,
    boxNumber: box,
    bagColor: bag,
    payments: [],
    status: 'active'
  };
  items.unshift(item);
  save(items);
  renderList();
  clearForm();
});

clearBtn.addEventListener('click', clearForm);
searchEl.addEventListener('input', renderList);

function clearForm(){
  [nameEl,saleIdEl,phoneEl,productEl,costEl,depositEl,locationEl,boxEl,bagEl].forEach(i=>i.value='');
  durationEl.value = '15';
}

function computePaid(item){
  const payments = item.payments || [];
  const totalPayments = payments.reduce((s,p)=>s+(p.amount||0),0);
  return (item.depositTaken||0) + totalPayments;
}

function computeRemaining(item){
  return Math.max(0, (item.productCost||0) - computePaid(item));
}

function renderList(){
  listEl.innerHTML='';
  const q = (searchEl.value || '').toLowerCase();
  const filtered = items.filter(i=>{
    if(!q) return true;
    return [i.name, i.saleId, i.phone, i.location, i.boxNumber, i.bagColor, i.product].some(f=> (f||'').toString().toLowerCase().includes(q));
  });
  filtered.forEach(i=>{
    const tpl = document.getElementById('itemTpl').content.cloneNode(true);
    tpl.querySelector('.item-title').textContent = i.name + ' • ' + i.product;
    tpl.querySelector('.item-sub').textContent = `Venta: ${i.saleId} • Tel: ${i.phone} • Vence: ${new Date(i.startDate).toLocaleDateString()} +${i.durationDays}d`;
    tpl.querySelector('.item-amount').textContent = '$' + computeRemaining(i).toFixed(2);
    const editBtn = tpl.querySelector('.edit');
    const payBtn = tpl.querySelector('.pay');
    const ticketBtn = tpl.querySelector('.ticket');
    const smsBtn = tpl.querySelector('.sms');
    const waBtn = tpl.querySelector('.wa');
    const cancelBtn = tpl.querySelector('.cancel');

    editBtn.onclick = ()=> editItem(i.id);
    payBtn.onclick = ()=> addPaymentPrompt(i.id);
    ticketBtn.onclick = ()=> shareTicket(i.id);
    smsBtn.onclick = ()=> sendSMS(i.id);
    waBtn.onclick = ()=> sendWhatsApp(i.id);
    cancelBtn.onclick = ()=> { if(confirm('Cancelar apartado?')){ cancelItem(i.id) } };

    listEl.appendChild(tpl);
  });
}

function findItem(id){ return items.find(x=>x.id===id) }
function saveAndRefresh(){ save(items); renderList(); }

function editItem(id){
  const it = findItem(id);
  if(!it) return;
  const name = prompt('Nombre', it.name); if(name===null) return;
  it.name = name;
  const product = prompt('Producto', it.product); if(product===null) return;
  it.product = product;
  const cost = parseFloat(prompt('Costo', it.productCost)); if(isNaN(cost)) return;
  it.productCost = cost;
  it.location = prompt('Lugar', it.location||'') || '';
  it.boxNumber = prompt('Número de caja', it.boxNumber||'') || '';
  it.bagColor = prompt('Color de la bolsa', it.bagColor||'') || '';
  saveAndRefresh();
}

function addPaymentPrompt(id){
  const it = findItem(id);
  if(!it) return;
  const val = prompt('Monto de abono (número)');
  if(!val) return;
  const amt = parseFloat(val.replace(',', '.'));
  if(isNaN(amt) || amt<=0) return alert('Monto inválido');
  it.payments = it.payments||[];
  it.payments.push({id: uid(), date: new Date().toISOString(), amount: amt});
  saveAndRefresh();
  alert('Abono agregado');
}

function cancelItem(id){
  const it = findItem(id);
  if(!it) return;
  it.status = 'cancelled';
  saveAndRefresh();
}

function shareTicket(id){
  const it = findItem(id);
  if(!it) return;
  const text = ticketText(it);
  try{
    const doc = new jsPDF({unit:'pt', format:[300,400]});
    doc.setFontSize(14); doc.text("Ernesto's Bazar",20,30);
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(text, 260);
    doc.text(lines,20,60);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${it.saleId}_ticket.pdf`; a.click();
    URL.revokeObjectURL(url);
  }catch(e){
    navigator.clipboard.writeText(text).then(()=>alert('Texto del ticket copiado al portapapeles'));
  }
}

function ticketText(it){
  const paid = computePaid(it).toFixed(2);
  const remaining = computeRemaining(it).toFixed(2);
  const due = new Date(it.startDate); due.setDate(due.getDate() + it.durationDays);
  let s = `Ernesto's Bazar - APARTADO\n`;
  s+= `Cliente: ${it.name}\n`;
  s+= `Venta: ${it.saleId}\n`;
  s+= `Tel: ${it.phone}\n`;
  s+= `Producto: ${it.product}\n`;
  s+= `Costo: $${it.productCost.toFixed(2)}\n`;
  s+= `Pagado: $${paid}\n`;
  s+= `Restante: $${remaining}\n`;
  s+= `Vence: ${due.toLocaleDateString()}\n`;
  s+= `Lugar: ${it.location} • Caja: ${it.boxNumber}\n`;
  s+= `Bolsa: ${it.bagColor}\n\n`;
  s+= `Tenga en cuenta: Apartados normales 15 días; en mueble 30 días.\nGracias por su preferencia.`;
  return s;
}

function sendSMS(id){
  const it = findItem(id);
  if(!it) return;
  const text = ticketText(it);
  const encoded = encodeURIComponent(text);
  window.location.href = `sms:${it.phone}?&body=${encoded}`;
}

function sendWhatsApp(id){
  const it = findItem(id);
  if(!it) return;
  const text = ticketText(it);
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
