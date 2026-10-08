async function editRecord(type, id) {
  try {
    const data = type === 'invoices' ? { invoice: (window._invoices || []).find(i => String(i.id) === String(id)) } : await api('/' + type + '/' + encodeURIComponent(id));
    const record = type === 'users' ? data.user : type === 'stores' ? data.store : data.invoice;
    if (!record) throw Error('Registro no encontrado.');
    const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
    const card = document.createElement('div'); card.className = 'modal'; overlay.append(card);
    const title = document.createElement('h3'); title.textContent = 'Editar ' + {users:'usuario',stores:'tienda',invoices:'factura'}[type]; card.append(title);
    const form = document.createElement('form'); card.append(form);
    const fields = {};
    function field(key, label, value, inputType = 'text') {
      const group=document.createElement('div');group.className='form-group';const caption=document.createElement('label');caption.textContent=label;
      const input=document.createElement('input');input.type=inputType;input.value=value ?? '';caption.append(input);group.append(caption);form.append(group);fields[key]=input;return input;
    }
    if (type === 'users') {
      const phone=field('phone','Teléfono de acceso',record.phone);phone.readOnly=true;
      field('password','Nueva contraseña (opcional)','', 'password').autocomplete='new-password';
      if(data.profile) {
        const coins=field('coins','Monedas del mundo',data.profile.world?.coins || 0,'number');coins.min='0';coins.max='10000000';coins.step='1';
        for(const [index,pet] of (data.profile.characters?.characters || []).entries()) { const name=field('pet-'+index,'Nombre de mascota · '+pet.id,pet.name);name.required=true;name.maxLength=50;name.dataset.pet=pet.id; }
      }
    } else if (type === 'stores') {
      for(const [key,label] of [['name','Nombre'],['game_name','Nombre en el mundo'],['category','Categoría'],['description','Descripción'],['short_description','Descripción corta'],['hours','Horario']]) field(key,label,record[key]);
      fields.name.required=true;
      for(const key of ['lat','lng'])field(key,key==='lat'?'Latitud':'Longitud',record[key],'number').step='any';
      field('active','Tienda activa','', 'checkbox').checked=!!record.active;
    } else {
      field('code','Código',record.code).readOnly=true;
      field('campaign_id','Campaña',record.campaign_id).maxLength=100;
      const metadata=JSON.parse(record.metadata || '{}');field('note','Nota administrativa',metadata.admin_note || '').maxLength=2000;
      const label=document.createElement('label');label.textContent='Estado';const select=document.createElement('select');select.className='filter-select';
      for(const status of record.status==='REDEEMED'?['REDEEMED']:['AVAILABLE','CANCELLED','EXPIRED']){const option=document.createElement('option');option.value=status;option.textContent=status;select.append(option);}select.value=record.status;fields.status=select;label.append(select);form.append(label);
      const note=document.createElement('p');note.textContent='Editar o eliminar no revierte premios ya entregados. Las facturas canjeadas no pueden reabrirse.';form.append(note);
    }
    const error=document.createElement('p');error.setAttribute('role','alert');form.append(error);
    const actions=document.createElement('div');actions.className='modal-actions';form.append(actions);
    const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Cancelar';cancel.onclick=()=>overlay.remove();actions.append(cancel);
    const save=document.createElement('button');save.type='submit';save.className='btn btn-primary';save.textContent='Guardar cambios';actions.append(save);
    form.onsubmit=async e=>{
      e.preventDefault();save.disabled=true;error.textContent='';
      try {
        const body={};
        if(type==='users'){
          if(fields.password.value)body.password=fields.password.value;
          if(fields.coins)body.coins=Number(fields.coins.value);
          body.petNames=Object.values(fields).filter(f=>f.dataset?.pet).map(f=>({id:f.dataset.pet,name:f.value.trim()}));
          if(!data.profile)delete body.petNames;
        } else if(type==='stores') {
          for(const key of ['name','game_name','category','description','short_description','hours'])body[key]=fields[key].value.trim();
          for(const key of ['lat','lng'])body[key]=fields[key].value===''?null:Number(fields[key].value);
          body.active=fields.active.checked;
        } else {body.campaign_id=fields.campaign_id.value;body.note=fields.note.value;body.status=fields.status.value;}
        await api('/'+type+'/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(body)});
        overlay.remove();currentView=type;render();toast('Cambios guardados');
      } catch(e){error.textContent=e.message;save.disabled=false;}
    };
    document.body.append(overlay);
  } catch(e) { toast(e.message,'error'); }
}

async function deleteInvoice(id) {
  if(!await confirmDialog('¿Eliminar esta factura del listado? Se conserva su registro para evitar repetir el canje. Los premios entregados se mantienen.'))return;
  try {await api('/invoices/'+encodeURIComponent(id),{method:'DELETE'});currentView='invoices';render();toast('Factura eliminada del listado');}catch(e){toast(e.message,'error');}
}
