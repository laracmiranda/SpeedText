/*
 * SpeedText
 * Copyright (C) 2026 Lara Miranda
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License v2.0.
 */

const Icons = {
  bold: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M7 5h6a4 4 0 0 1 0 8H7z" stroke="currentColor" stroke-width="2"/>
      <path d="M7 13h7a4 4 0 0 1 0 8H7z" stroke="currentColor" stroke-width="2"/>
    </svg>
  `,
  italic: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M19 4h-9" stroke="currentColor" stroke-width="2"/>
      <path d="M14 20H5" stroke="currentColor" stroke-width="2"/>
      <path d="M15 4L9 20" stroke="currentColor" stroke-width="2"/>
    </svg>
  `,
  list: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M8 6h13" stroke="currentColor" stroke-width="2"/>
      <path d="M8 12h13" stroke="currentColor" stroke-width="2"/>
      <path d="M8 18h13" stroke="currentColor" stroke-width="2"/>
      <circle cx="4" cy="6" r="1" fill="currentColor"/>
      <circle cx="4" cy="12" r="1" fill="currentColor"/>
      <circle cx="4" cy="18" r="1" fill="currentColor"/>
    </svg>
  `,
  edit: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 20h9" stroke="currentColor" stroke-width="2"/>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="currentColor" stroke-width="2"/>
    </svg>
  `,
  trash: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18" stroke="currentColor" stroke-width="2"/>
      <path d="M8 6V4h8v2" stroke="currentColor" stroke-width="2"/>
      <path d="M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2"/>
    </svg>
  `
};

let macros = [];
let editingId = null;

// Carregar macros do armazenamento
function loadMacros() {
  chrome.storage.sync.get('macros', (result) => {
    macros = result.macros || [];
    renderMacros();
  });
}

// Salvar macros no armazenamento
function saveMacros() {
  chrome.storage.sync.set({ macros }, () => {
    loadMacros();
  });
}

// Adicionar nova macro
function addMacro() {

  const rawShortcut = document.getElementById('shortcut')
    .value
    .trim()
    .replace(/^\\+/, '');

  const shortcut = '\\' + rawShortcut;

  const name = document.getElementById('name').value.trim();

  const text = document.getElementById('rich-editor').innerHTML.trim();

  if (!rawShortcut || !name || !text) {
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

  document.getElementById('edit-shortcut').value = macro.shortcut.replace(/^\\/, '');
  document.getElementById('edit-name').value = macro.name;
  document.getElementById('edit-rich-editor').innerHTML = macro.text;
}

//Atualizar Macro
function updateMacro() {

  if (!editingId) return;

  const rawShortcut = document.getElementById('edit-shortcut')
    .value
    .trim()
    .replace(/^\\+/, '');

  const shortcut = '\\' + rawShortcut;

  const name = document.getElementById('edit-name').value.trim();

  const text = document.getElementById('edit-rich-editor').innerHTML.trim();

  if (!rawShortcut || !name || !text) {
    alert('Preencha todos os campos!');
    return;
  }

  if (
    macros.some(
      m => m.id !== editingId && m.shortcut === shortcut
    )
  ) {
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

// Cancelar Edição
function cancelEdit() {
  editingId = null;

  document.getElementById('form-section').style.display = 'block';
  document.getElementById('edit-section').style.display = 'none';

  document.getElementById('edit-shortcut').value = '';
  document.getElementById('edit-name').value = '';
  document.getElementById('edit-rich-editor').innerHTML = '';
}

// Renderizar lista de macros
function renderMacroList(listData) {

  const list = document.getElementById('macros-list');
  const empty = document.getElementById('empty-state');
  const counter = document.getElementById('macro-count');

  list.innerHTML = '';

  counter.textContent = macros.length;

  if (!listData.length) {

    const searching =
      document.getElementById('search-input')
      .value
      .trim()
      .length > 0;

    empty.innerHTML = searching
      ? `
        <div class="empty-icon">👻</div>
        <h3>Nenhuma macro encontrada</h3>
        <p>Tente buscar por outro nome ou atalho.</p>
      `
      : `
        <div class="empty-icon">👻</div>
        <h3>Nenhuma macro ainda</h3>
        <p>Crie sua primeira na aba “Criar”.</p>
      `;

    empty.style.display = 'block';

    return;
  }

  empty.style.display = 'none';

  listData.forEach(macro => {

    const item = document.createElement('div');

    item.className = 'macro-item';

    item.innerHTML = `
      <div class="macro-info">

        <div class="macro-name">
          ${macro.name}
        </div>

        <span class="macro-shortcut">
          ${macro.shortcut}
        </span>

      </div>

      <div class="macro-buttons">

        <button
          class="icon-action edit-btn"
          data-id="${macro.id}"
          title="Editar"
        >
          ${Icons.edit}
        </button>

        <button
          class="icon-action delete-btn"
          data-id="${macro.id}"
          title="Excluir"
        >
          ${Icons.trash}
        </button>

      </div>
    `;

    list.appendChild(item);
  });
}

// Renderizar lista de macros
function renderMacros() {
  renderMacroList(macros);
}

// Filtrar macros
function filterMacros() {

  const search = document
    .getElementById('search-input')
    .value
    .toLowerCase();

  const filtered = macros.filter(m =>
    m.shortcut.toLowerCase().includes(search) ||
    m.name.toLowerCase().includes(search)
  );

  renderMacroList(filtered);
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

function replaceMacro(item) {
  const index = macros.findIndex(m => m.shortcut === item.imported.shortcut);

  const newMacro = {
    id: Date.now().toString() + Math.random(),
    ...item.imported
  };

  if (index !== -1) {
    macros[index] = newMacro;
  } else {
    macros.push(newMacro);
  }
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

      const valid = imported.filter(m => m.shortcut && m.name && m.text);

      if (!valid.length) {
        alert('Nenhuma macro válida encontrada.');
        return;
      }

      const mode = confirm(
        'OK = MESCLAR (manter existentes)\nCancelar = SUBSTITUIR TUDO'
      );

      // Substituir tudo
      if (!mode) {
        const confirmReplace = confirm(
          'Isso vai APAGAR todas as macros atuais. Continuar?'
        );

        if (!confirmReplace) return;

        macros = valid.map(m => ({
          id: Date.now().toString() + Math.random(),
          shortcut: m.shortcut,
          name: m.name,
          text: m.text
        }));

        saveMacros();
        alert('Macros substituídas com sucesso!');
        return;
      }

      // Mesclar e detectar duplicidade de macros
      let duplicates = [];

      valid.forEach(importedMacro => {
        const existing = macros.find(m => m.shortcut === importedMacro.shortcut);

        if (existing) {
          duplicates.push({
            imported: importedMacro,
            existing
          });
        } else {
          macros.push({
            id: Date.now().toString() + Math.random(),
            ...importedMacro
          });
        }
      });

      // Se não houver conflitos
      if (!duplicates.length) {
        saveMacros();
        alert('Importação concluída sem conflitos!');
        return;
      }

      // Resolver duplicados
      resolveDuplicates(duplicates);

    } catch (err) {
      alert('Erro ao importar arquivo.');
    }
  };

  reader.readAsText(file);
}

function resolveDuplicates(duplicates) {
  let skipAll = false;
  let overwriteAll = false;

  duplicates.forEach((item, index) => {
    if (skipAll) return;

    if (overwriteAll) {
      replaceMacro(item);
      return;
    }

    const action = prompt(
      `Conflito detectado:\n\nShortcut: ${item.imported.shortcut}\n\nDigite:\n1 = Substituir\n2 = Pular\n3 = Substituir TODOS\n4 = Pular TODOS`
    );

    switch (action) {
      case '1':
        replaceMacro(item);
        break;

      case '2':
        break;

      case '3':
        overwriteAll = true;
        replaceMacro(item);
        break;

      case '4':
        skipAll = true;
        break;

      default:
        break;
    }
  });

  saveMacros();
  alert('Importação concluída com resolução de conflitos.');
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

  document.getElementById('bold-btn').innerHTML = Icons.bold;
  document.getElementById('italic-btn').innerHTML = Icons.italic;
  document.getElementById('list-btn').innerHTML = Icons.list;

  document.getElementById('edit-bold-btn').innerHTML = Icons.bold;
  document.getElementById('edit-italic-btn').innerHTML = Icons.italic;
  document.getElementById('edit-list-btn').innerHTML = Icons.list;

  // Eventos Lista

  // Editar
  document.getElementById('macros-list').addEventListener('click', (e) => {

    const editButton = e.target.closest('.edit-btn');
    const deleteButton = e.target.closest('.delete-btn');

    if (editButton) {
      startEdit(editButton.dataset.id);
    }

    if (deleteButton) {
      deleteMacro(deleteButton.dataset.id);
    }
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
  function setupEditorToolbar({
    editorId,
    boldBtnId,
    italicBtnId,
    listBtnId
  }) {

    const editor = document.getElementById(editorId);

    const boldBtn = document.getElementById(boldBtnId);
    const italicBtn = document.getElementById(italicBtnId);
    const listBtn = document.getElementById(listBtnId);

    // Bold
    boldBtn?.addEventListener('click', () => {
      editor.focus();
      document.execCommand('bold');
    });

    // Italic
    italicBtn?.addEventListener('click', () => {
      editor.focus();
      document.execCommand('italic');
    });

    // Lista
    listBtn?.addEventListener('click', () => {
      editor.focus();
      document.execCommand('insertUnorderedList');
    });

    // Limpeza de <br>
    editor?.addEventListener('input', () => {

      if (
        editor.innerHTML === '<br>' ||
        editor.innerHTML === '<div><br></div>'
      ) {
        editor.innerHTML = '';
      }
    });
  }
  // Toolbar Criar
  setupEditorToolbar({
    editorId: 'rich-editor',
    boldBtnId: 'bold-btn',
    italicBtnId: 'italic-btn',
    listBtnId: 'list-btn'
  });

  // Toolbar Editar
  setupEditorToolbar({
    editorId: 'edit-rich-editor',
    boldBtnId: 'edit-bold-btn',
    italicBtnId: 'edit-italic-btn',
    listBtnId: 'edit-list-btn'
  });
});