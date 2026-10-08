/* Uses DOM text/value setters for database content. */
async function loadManagement(main) {
  main.innerHTML = `<h2 class="page-title">Gestión de AODASE PETS</h2>
    <p>Cuentas, negocios del mapa y catálogo de equipo del mundo.</p>
    <div class="detail-card"><h3>Cuenta e inventario</h3><label>Usuario</label><select id="manage-user" class="filter-select"></select>
    <form id="manage-password"><div class="form-group"><label>Nueva contraseña del usuario</label><input id="manage-new-password" type="password" minlength="8" maxlength="100" autocomplete="new-password" required></div><button class="btn btn-primary">Guardar contraseña</button></form>
    <h3>Ítems del mundo</h3><p>El catálogo muestra equipo existente. Entregar y retirar modifica el inventario del usuario elegido.</p><select id="manage-item" class="filter-select"></select><button id="manage-grant" class="btn btn-primary">Entregar ítem</button><button id="manage-remove" class="btn btn-danger">Retirar ítem</button><p id="manage-inventory"></p></div>
    <div class="detail-card"><h3>Editar negocio del mundo</h3><select id="manage-store" class="filter-select"></select>
    <form id="manage-business"><div class="form-group"><label>Nombre</label><input name="name" required maxlength="120"></div><div class="form-group"><label>Nombre dentro del mundo</label><input name="game_name" maxlength="120"></div><div class="form-group"><label>Descripción</label><textarea name="description"></textarea></div><div class="form-group"><label>Horario</label><input name="hours"></div><div class="form-group"><label>Latitud</label><input name="lat" type="number" step="any" min="-90" max="90"></div><div class="form-group"><label>Longitud</label><input name="lng" type="number" step="any" min="-180" max="180"></div><label><input name="active" type="checkbox"> Negocio activo</label><br><button class="btn btn-primary">Guardar negocio</button></form></div>`;
  const element = id => main.querySelector('#' + id);
  const option = (select, value, label) => { const el = document.createElement('option'); el.value = value; el.textContent = label; select.append(el); };
  try {
    const [users, items, stores] = await Promise.all([api('/users'), api('/items'), api('/stores')]);
    for (const u of users.users) option(element('manage-user'), u.phone, u.phone);
    for (const i of items.items) option(element('manage-item'), i.id, `${i.name} · ${i.slot} · +${i.bonus} ${i.stat}`);
    for (const s of stores.stores) option(element('manage-store'), s.id, s.name);
    async function inventory() {
      if (!element('manage-user').value) { element('manage-inventory').textContent = 'No hay usuarios registrados.'; return; }
      const data = await api('/users/' + encodeURIComponent(element('manage-user').value));
      element('manage-inventory').textContent = 'Inventario: ' + ((data.profile?.world?.items || []).map(id => items.items.find(i => i.id === id)?.name || id).join(', ') || 'Vacío');
    }
    element('manage-user').onchange = () => inventory().catch(e => toast(e.message, 'error'));
    const run = async (button, work) => { button.disabled = true; try { await work(); toast('Cambios guardados'); } catch(e) { toast(e.message, 'error'); } finally { button.disabled = false; } };
    element('manage-password').onsubmit = e => { e.preventDefault(); const button=e.submitter; void run(button, async()=>{if(!element('manage-user').value)throw Error('Selecciona un usuario.');await api('/users/'+encodeURIComponent(element('manage-user').value)+'/account',{method:'PATCH',body:JSON.stringify({password:element('manage-new-password').value})});element('manage-new-password').value='';}); };
    for (const action of ['grant','remove']) element('manage-'+action).onclick = e => { void run(e.currentTarget,async()=>{await api('/users/'+encodeURIComponent(element('manage-user').value)+'/items',{method:'POST',body:JSON.stringify({item:element('manage-item').value,action})});await inventory();}); };
    function business() {
      const store=stores.stores.find(s=>s.id===element('manage-store').value);
      const form=element('manage-business');
      form.hidden=!store;
      if(!store)return;
      for(const name of ['name','game_name','description','hours','lat','lng']) form.elements[name].value=store[name] ?? '';
      form.elements.active.checked=!!store.active;
    }
    element('manage-store').onchange=business;
    element('manage-business').onsubmit=e=>{e.preventDefault();const button=e.submitter;void run(button,async()=>{const form=e.currentTarget;const values={};for(const name of ['name','game_name','description','hours'])values[name]=form.elements[name].value.trim();for(const name of ['lat','lng'])values[name]=form.elements[name].value===''?null:Number(form.elements[name].value);values.active=form.elements.active.checked;await api('/stores/'+encodeURIComponent(element('manage-store').value),{method:'PATCH',body:JSON.stringify(values)});Object.assign(stores.stores.find(s=>s.id===element('manage-store').value),values);});};
    business();await inventory();
  } catch(e) { toast(e.message, 'error'); }
}
