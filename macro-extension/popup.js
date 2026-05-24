let macros = [];
let editingId = null;

// Carregar macros do armazenamento
function loadMacros() {
  chrome.storage.local.get('macros', (result) => {
    macros = result.macros || [];
    renderMacros();
  });
}

// Salvar macros no armazenamento
function saveMacros() {
  chrome.storage.local.set({ macros }, () => {
    loadMacros();
  });
}

// Adicionar nova macro
function addMacro() {
  const shortcut = document.getElementById('shortcut').value.trim();
  const name = document.getElementById('name').value.trim();
  const text = document.getElementById('rich-editor').innerHTML.trim();

  if (!shortcut || !name || !text) {
    alert('Preencha todos os campos!');
    return;
  }

  if (macros.some(m => m.shortcut === shortcut)) {
    alert('Este atalho já existe!');
    return;
  }

  const newMacro = {
    id: Date.now().toString(),
    shortcut,
    name,
    text
  };

  macros.push(newMacro);
  saveMacros();

  document.getElementById('shortcut').value = '';
  document.getElementById('name').value = '';
  document.getElementById('rich-editor').innerHTML = '';
}

// Edição de macro
function startEdit(id) {
  openTab('cadastrar');

  const macro = macros.find(m => m.id === id);
  if (!macro) return;

  editingId = id;

  document.getElementById('form-section').style.display = 'none';
  document.getElementById('edit-section').style.display = 'block';

  document.getElementById('edit-shortcut').value = macro.shortcut;
  document.getElementById('edit-name').value = macro.name;
  document.getElementById('edit-rich-editor').innerHTML = macro.text;
}

function updateMacro() {
  if (!editingId) return;

  const shortcut = document.getElementById('edit-shortcut').value.trim();
  const name = document.getElementById('edit-name').value.trim();
  const text = document.getElementById('edit-rich-editor').innerHTML.trim();

  if (!shortcut || !name || !text) {
    alert('Preencha todos os campos!');
    return;
  }

  if (macros.some(m => m.id !== editingId && m.shortcut === shortcut)) {
    alert('Este atalho já existe em outra macro!');
    return;
  }

  const index = macros.findIndex(m => m.id === editingId);

  macros[index] = {
    id: editingId,
    shortcut,
    name,
    text
  };

  saveMacros();
  cancelEdit();
}

function cancelEdit() {
  editingId = null;

  document.getElementById('form-section').style.display = 'block';
  document.getElementById('edit-section').style.display = 'none';

  document.getElementById('edit-shortcut').value = '';
  document.getElementById('edit-name').value = '';
  document.getElementById('edit-rich-editor').innerHTML = '';
}

// Renderizar lista de macros
function renderMacros() {
  const list = document.getElementById('macros-list');
  list.innerHTML = '';

  if (!macros.length) {
    list.innerHTML = '<p>Nenhuma macro encontrada</p>';
    return;
  }

  macros.forEach(macro => {
    const div = document.createElement('div');
    div.className = 'macro-item';

    div.innerHTML = `
      <strong>${macro.shortcut}</strong> - ${macro.name}<br>
      ${macro.text.substring(0, 50)}${macro.text.length > 50 ? '...' : ''}
      <button class="edit-btn" data-id="${macro.id}">Editar</button>
      <button class="delete-btn" data-id="${macro.id}">Excluir</button>
    `;

    list.appendChild(div);
  });
}

// Filtrar macros
function filterMacros() {
  const search = document.getElementById('search-input').value.toLowerCase();

  const filtered = macros.filter(m =>
    m.shortcut.toLowerCase().includes(search) ||
    m.name.toLowerCase().includes(search)
  );

  const list = document.getElementById('macros-list');
  list.innerHTML = '';

  if (!filtered.length) {
    list.innerHTML = '<p>Nenhuma macro encontrada</p>';
    return;
  }

  filtered.forEach(macro => {
    const div = document.createElement('div');
    div.className = 'macro-item';

    div.innerHTML = `
      <strong>${macro.shortcut}</strong> - ${macro.name}<br>
      ${macro.text.substring(0, 50)}${macro.text.length > 50 ? '...' : ''}
      <button class="edit-btn" data-id="${macro.id}">Editar</button>
      <button class="delete-btn" data-id="${macro.id}">Excluir</button>
    `;

    list.appendChild(div);
  });
}

// Deletar macro
function deleteMacro(id) {
  if (confirm('Deletar esta macro?')) {
    macros = macros.filter(m => m.id !== id);
    saveMacros();
  }
}

// Tab sistem
function openTab(tabName) {
  document.querySelectorAll('.tab-content')
    .forEach(t => t.classList.remove('active'));

  const activeTab = document.getElementById(tabName);
  if (activeTab) activeTab.classList.add('active');

  document.querySelectorAll('.tab-button')
    .forEach(btn => {
      btn.classList.remove('active');
      if (btn.id === `tab-${tabName}`) {
        btn.classList.add('active');
      }
    });
}

// função para Exportar Macros
function exportMacros() {
  if (!macros.length) {
    alert('Nenhuma macro para exportar.');
    return;
  }

  const data = JSON.stringify(macros, null, 2);

  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `macros-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

// função para Importar Macros
function importMacros(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);

      if (!Array.isArray(imported)) {
        alert('Arquivo inválido.');
        return;
      }

      const valid = imported.filter(m =>
        m.shortcut && m.name && m.text
      );

      if (!valid.length) {
        alert('Nenhuma macro válida encontrada.');
        return;
      }

      const normalized = valid.map(m => ({
        id: m.id || Date.now().toString() + Math.random(),
        shortcut: m.shortcut,
        name: m.name,
        text: m.text
      }));

      macros = [...macros, ...normalized];
      saveMacros();

      alert('Importação concluída!');
    } catch (err) {
      alert('Erro ao importar arquivo.');
    }
  };

  reader.readAsText(file);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadMacros();

  document.getElementById('add-macro-btn').addEventListener('click', addMacro);
  document.getElementById('update-macro-btn').addEventListener('click', updateMacro);
  document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
  document.getElementById('search-input').addEventListener('input', filterMacros);

  document.getElementById('tab-cadastrar').addEventListener('click', () => openTab('cadastrar'));
  document.getElementById('tab-visualizar').addEventListener('click', () => openTab('visualizar'));

  // eventos lista
  document.getElementById('macros-list').addEventListener('click', (e) => {
    const id = e.target.getAttribute('data-id');

    if (e.target.classList.contains('edit-btn')) startEdit(id);
    if (e.target.classList.contains('delete-btn')) deleteMacro(id);
  });

  // Exportar
  document.getElementById('export-btn').addEventListener('click', exportMacros);

  // Importar
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importMacros(file);

    e.target.value = '';
  });

  // Formatação
  document.getElementById('bold-btn').addEventListener('click', () => {
    document.getElementById('rich-editor')?.focus();
    document.execCommand('bold');
  });

  document.getElementById('italic-btn').addEventListener('click', () => {
    document.getElementById('rich-editor')?.focus();
    document.execCommand('italic');
  });

  document.getElementById('list-btn').addEventListener('click', () => {
    document.getElementById('rich-editor')?.focus();
    document.execCommand('insertUnorderedList');
  });
});