const KEY='encuestas';
function readAll(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ return []; } }
function writeAll(arr){ localStorage.setItem(KEY, JSON.stringify(arr)); }
function toCSV(rows){ if(!rows.length) return ''; const headers=Object.keys(rows[0]); const escape=v=>`"${String(v??'').replace(/"/g,'""')}"`; return [headers.join(','),...rows.map(r=>headers.map(h=>escape(r[h])).join(','))].join('\n'); }
function fromCSV(text){ 
  const [head,...lines]=text.split(/\r?\n/).filter(Boolean); 
  const headers=head.split(',').map(h=>h.replace(/^\"|\"$/g,'')); 
  return lines.map(line=>{ 
    const cols=line.match(/\"(?:[^\"]|\"\")*\"|[^,]+/g)||[]; 
    const values=cols.map(c=>c.replace(/^\"|\"$/g,'').replace(/\"\"/g,'"')); 
    const obj={}; 
    headers.forEach((h,i)=>obj[h]=values[i]??''); 
    return obj; 
  }); 
}
// Serialize any form into a flat object.
function serializeForm(form){
  const data = {};
  const groups = new Map(); // name -> array for checkboxes
  const els = form.querySelectorAll('input, select, textarea');
  els.forEach(el=>{
    const { name, type } = el;
    if(!name) return;
    if(type === 'checkbox'){
      if(!groups.has(name)) groups.set(name, []);
      if(el.checked) groups.get(name).push(el.value);
      return;
    }
    if(type === 'radio'){
      if(el.checked) data[name] = el.value;
      return;
    }
    let val = el.value;
    if(type === 'number') val = val === '' ? '' : Number(val);
    data[name] = val;
  });
  // flatten checkbox groups as pipe-separated values
  for(const [name, arr] of groups.entries()){
    data[name] = arr.join('|');
  }
  // timestamp
  if(!('ts' in data)) data.ts = new Date().toISOString();
  return data;
}

const formEncuestaEl = document.getElementById('formEncuesta');
if (formEncuestaEl) formEncuestaEl.addEventListener('submit', (e)=>{
  e.preventDefault();
  const row = serializeForm(e.target);
  const all = readAll(); all.push(row); writeAll(all);
  e.target.reset(); alert('¡Gracias! Respuesta registrada.');
});

document.getElementById('ocupacion').addEventListener('change', function() {
  const otroField = document.getElementById('ocupacion_otro');
  if (this.value === 'Otro') {
    otroField.style.display = 'block';
    otroField.required = true;
  } else {
    otroField.style.display = 'none';
    otroField.required = false;
    otroField.value = '';
  }
});