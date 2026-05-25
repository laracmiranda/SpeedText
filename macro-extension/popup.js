/*
 * SpeedText
 * Copyright (C) 2026 Lara Miranda
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License v2.0.
 */

const $ = (id) => document.getElementById(id);

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

/* =========================
   Helpers
========================= */

function generateId() {
  return crypto.randomUUID();
}

function escapeHTML(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* =========================
   Storage
========================= */

function loadMacros() {
  chrome.storage.sync.get('macros', (result) => {
    macros = result.macros || [];
    renderMacros();
  });
}

function saveMacros() {
  chrome.storage.sync.set({ macros }, () => {
    renderMacros();
  });
}

/* =========================
   Toasts
========================= */

function showToast({
  title = '',
  message = '',
  type = 'info',
  duration = 3000
}) {

  const container = $('toast-container');

  if (container.children.length >= 4) {
    container.firstChild.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  toast.innerHTML = `
    <div class="toast-title">
      ${escapeHTML(title)}
    </div>

    <div class="toast-message">
      ${escapeHTML(message)}
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';

    setTimeout(() => {
      toast.remove();
    }, 180);

  }, duration);
}

/* =========================
   Tabs
========================= */

function openTab(tabName) {

  document.querySelectorAll('.tab-content')
    .forEach(tab => tab.classList.remove('active'));

  document.querySelectorAll('.tab-button')
    .forEach(btn => btn.classList.remove('active'));

  $(tabName)?.classList.add('active');
  $(`tab-${tabName}`)?.classList.add('active');
}

/* =========================
   Modal
========================= */

function openModal({
  title,
  content,
  actions = []
}) {

  const overlay = $('modal-overlay');

  $('modal-title').textContent = title;
  $('modal-body').innerHTML = content;

  const actionsEl = $('modal-actions');
  actionsEl.innerHTML = '';

  actions.forEach(action => {

    const btn = document.createElement('button');

    btn.textContent = action.label;
    btn.className = action.className || 'secondary-btn';

    btn.addEventListener('click', () => {
      action.onClick?.();
    });

    actionsEl.appendChild(btn);
  });

  overlay.classList.remove('hidden');
}

function closeModal() {
  $('modal-overlay').classList.add('hidden');
}

/* =========================
   Macro CRUD
========================= */

function addMacro() {

  const rawShortcut = $('shortcut')
    .value
    .trim()
    .replace(/^\\+/, '');

  const shortcut = '\\' + rawShortcut;

  const name = $('name').value.trim();
  const text = $('rich-editor').innerHTML.trim();

  if (!rawShortcut || !name || !text) {

    showToast({
      title: 'Campos obrigatórios',
      message: 'Preencha todos os campos da macro.',
      type: 'error'
    });

    return;
  }

  if (macros.some(m => m.shortcut === shortcut)) {

    showToast({
      title: 'Atalho duplicado',
      message: 'Já existe uma macro usando este shortcut.',
      type: 'error'
    });

    return;
  }

  macros.push({
    id: generateId(),
    shortcut,
    name,
    text
  });

  saveMacros();

  $('shortcut').value = '';
  $('name').value = '';
  $('rich-editor').innerHTML = '';

  showToast({
    title: 'Macro criada',
    message: 'Macro adicionada com sucesso.',
    type: 'success'
  });
}

function startEdit(id) {

  openTab('cadastrar');

  const macro = macros.find(m => m.id === id);

  if (!macro) return;

  editingId = id;

  $('form-section').style.display = 'none';
  $('edit-section').style.display = 'block';

  $('edit-shortcut').value =
    macro.shortcut.replace(/^\\/, '');

  $('edit-name').value = macro.name;
  $('edit-rich-editor').innerHTML = macro.text;
}

function updateMacro() {

  if (!editingId) return;

  const rawShortcut = $('edit-shortcut')
    .value
    .trim()
    .replace(/^\\+/, '');

  const shortcut = '\\' + rawShortcut;

  const name = $('edit-name').value.trim();
  const text = $('edit-rich-editor').innerHTML.trim();

  if (!rawShortcut || !name || !text) {

    showToast({
      title: 'Campos obrigatórios',
      message: 'Preencha todos os campos da macro.',
      type: 'error'
    });

    return;
  }

  const duplicated =
    macros.some(
      m =>
        m.id !== editingId &&
        m.shortcut === shortcut
    );

  if (duplicated) {

    showToast({
      title: 'Atalho duplicado',
      message: 'Já existe outra macro com este shortcut.',
      type: 'error'
    });

    return;
  }

  const index =
    macros.findIndex(m => m.id === editingId);

  if (index === -1) return;

  macros[index] = {
    id: editingId,
    shortcut,
    name,
    text
  };

  saveMacros();
  cancelEdit();

  showToast({
    title: 'Macro atualizada',
    message: 'Alterações salvas com sucesso.',
    type: 'success'
  });
}

function cancelEdit() {

  editingId = null;

  $('form-section').style.display = 'block';
  $('edit-section').style.display = 'none';

  $('edit-shortcut').value = '';
  $('edit-name').value = '';
  $('edit-rich-editor').innerHTML = '';
}

function deleteMacro(id) {

  const macro = macros.find(m => m.id === id);

  if (!macro) return;

  openModal({
    title: 'Excluir macro',

    content: `
      <p>
        Deseja realmente excluir
        <strong>${escapeHTML(macro.name)}</strong>?
      </p>
    `,

    actions: [
      {
        label: 'Cancelar',
        className: 'secondary-btn',
        onClick: closeModal
      },

      {
        label: 'Excluir',
        className: 'primary-btn',

        onClick: () => {

          macros =
            macros.filter(m => m.id !== id);

          saveMacros();
          closeModal();

          showToast({
            title: 'Macro excluída',
            message: 'Macro removida com sucesso.',
            type: 'success'
          });
        }
      }
    ]
  });
}

/* =========================
   Renderização
========================= */

function renderMacros() {
  renderMacroList(macros);
}

function renderMacroList(listData) {

  const list = $('macros-list');
  const empty = $('empty-state');
  const counter = $('macro-count');

  list.innerHTML = '';

  counter.textContent =
    listData.length === macros.length
      ? macros.length
      : `${listData.length}/${macros.length}`;

  if (!listData.length) {

    const searching =
      $('search-input')
        .value
        .trim()
        .length > 0;

    empty.innerHTML = searching
      ? `
        <div class="empty-icon">👻</div>
        <h3>Nenhuma macro encontrada</h3>
        <p>Tente buscar outro nome ou atalho.</p>
      `
      : `
        <div class="empty-icon">👻</div>
        <h3>Nenhuma macro ainda</h3>
        <p>Crie sua primeira macro.</p>
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
          ${escapeHTML(macro.name)}
        </div>

        <span class="macro-shortcut">
          ${escapeHTML(macro.shortcut)}
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

function filterMacros() {

  const search =
    $('search-input')
      .value
      .toLowerCase();

  const filtered =
    macros.filter(m =>
      m.shortcut.toLowerCase().includes(search) ||
      m.name.toLowerCase().includes(search)
    );

  renderMacroList(filtered);
}

/* =========================
   Importação / Exportação
========================= */

function exportMacros() {

  if (!macros.length) {

    showToast({
      title: 'Nada para exportar',
      message: 'Nenhuma macro cadastrada.',
      type: 'error'
    });

    return;
  }

  const data =
    JSON.stringify(macros, null, 2);

  const blob =
    new Blob([data], {
      type: 'application/json'
    });

  const url =
    URL.createObjectURL(blob);

  const a = document.createElement('a');

  a.href = url;
  a.download = `macros-${Date.now()}.json`;

  a.click();

  URL.revokeObjectURL(url);

  showToast({
    title: 'Exportação concluída',
    message: 'Arquivo exportado com sucesso.',
    type: 'success'
  });
}

function importMacros(file) {

  const reader = new FileReader();

  reader.onload = (e) => {

    try {

      const imported =
        JSON.parse(e.target.result);

      if (!Array.isArray(imported)) {

        showToast({
          title: 'Arquivo inválido',
          message: 'O JSON informado é inválido.',
          type: 'error'
        });

        return;
      }

      const valid =
        imported.filter(m =>
          m.shortcut &&
          m.name &&
          m.text
        );

      if (!valid.length) {

        showToast({
          title: 'Nenhuma macro válida',
          message: 'O arquivo não contém macros válidas.',
          type: 'error'
        });

        return;
      }

      showImportModeModal(valid);

    } catch (err) {

      showToast({
        title: 'Erro na importação',
        message: 'Falha ao ler o arquivo.',
        type: 'error'
      });
    }
  };

  reader.readAsText(file);
}

function showImportModeModal(validMacros) {

  openModal({
    title: 'Importar macros',

    content: `
      <p class="modal-text">
        Como deseja importar as macros?
      </p>

      <div class="import-options">

        <button
          id="merge-import-btn"
          class="secondary-btn modal-option-btn"
        >
          Mesclar macros
        </button>

        <button
          id="replace-import-btn"
          class="primary-btn modal-option-btn"
        >
          Substituir tudo
        </button>

      </div>
    `,

    actions: [
      {
        label: 'Cancelar',
        className: 'secondary-btn',
        onClick: closeModal
      }
    ]
  });

  requestAnimationFrame(() => {

    $('merge-import-btn')
      ?.addEventListener('click', () => {

        closeModal();
        mergeImportedMacros(validMacros);
      });

    $('replace-import-btn')
      ?.addEventListener('click', () => {

        macros = validMacros.map(m => ({
          id: generateId(),
          ...m
        }));

        saveMacros();
        closeModal();

        showToast({
          title: 'Importação concluída',
          message: 'Macros substituídas com sucesso.',
          type: 'success'
        });
      });
  });
}

function mergeImportedMacros(validMacros) {

  const duplicates = [];

  validMacros.forEach(importedMacro => {

    const existing =
      macros.find(
        m => m.shortcut === importedMacro.shortcut
      );

    if (existing) {

      duplicates.push({
        existing,
        imported: importedMacro
      });

      return;
    }

    macros.push({
      id: generateId(),
      ...importedMacro
    });
  });

  if (!duplicates.length) {

    saveMacros();

    showToast({
      title: 'Importação concluída',
      message: 'Macros importadas sem conflitos.',
      type: 'success'
    });

    return;
  }

  resolveDuplicatesModal(duplicates);
}

function replaceMacro(item) {

  const index =
    macros.findIndex(
      m => m.shortcut === item.imported.shortcut
    );

  const newMacro = {
    id: generateId(),
    ...item.imported
  };

  if (index !== -1) {
    macros[index] = newMacro;
  } else {
    macros.push(newMacro);
  }
}

function resolveDuplicatesModal(duplicates) {

  let current = 0;

  function nextConflict() {

    if (current >= duplicates.length) {

      saveMacros();

      showToast({
        title: 'Importação concluída',
        message: 'Conflitos resolvidos com sucesso.',
        type: 'success'
      });

      closeModal();

      return;
    }

    const item = duplicates[current];

    openModal({
      title: 'Conflito de macro',

      content: `
        <div class="conflict-box">

          <p>
            O atalho
            <strong>
              ${escapeHTML(item.imported.shortcut)}
            </strong>
            já existe.
          </p>

          <div class="conflict-preview">

            <div class="conflict-column">
              <span>Atual</span>
              <strong>
                ${escapeHTML(item.existing.name)}
              </strong>
            </div>

            <div class="conflict-column">
              <span>Importada</span>
              <strong>
                ${escapeHTML(item.imported.name)}
              </strong>
            </div>

          </div>

        </div>
      `,

      actions: [

        {
          label: 'Pular',
          className: 'secondary-btn',

          onClick: () => {
            current++;
            nextConflict();
          }
        },

        {
          label: 'Substituir',
          className: 'primary-btn',

          onClick: () => {
            replaceMacro(item);
            current++;
            nextConflict();
          }
        }
      ]
    });
  }

  nextConflict();
}

/* =========================
   Toolbar
========================= */

function setupEditorToolbar({
  editorId,
  boldBtnId,
  italicBtnId,
  listBtnId
}) {

  const editor = $(editorId);

  const boldBtn = $(boldBtnId);
  const italicBtn = $(italicBtnId);
  const listBtn = $(listBtnId);

  boldBtn?.addEventListener('click', () => {
    editor.focus();
    document.execCommand('bold');
  });

  italicBtn?.addEventListener('click', () => {
    editor.focus();
    document.execCommand('italic');
  });

  listBtn?.addEventListener('click', () => {
    editor.focus();
    document.execCommand('insertUnorderedList');
  });

  editor?.addEventListener('input', () => {

    if (
      editor.innerHTML === '<br>' ||
      editor.innerHTML === '<div><br></div>'
    ) {
      editor.innerHTML = '';
    }
  });
}

/* =========================
   Init
========================= */

document.addEventListener('DOMContentLoaded', () => {

  loadMacros();

  $('add-macro-btn')
    .addEventListener('click', addMacro);

  $('update-macro-btn')
    .addEventListener('click', updateMacro);

  $('cancel-edit-btn')
    .addEventListener('click', cancelEdit);

  $('search-input')
    .addEventListener('input', filterMacros);

  $('tab-cadastrar')
    .addEventListener('click', () => {
      openTab('cadastrar');
    });

  $('tab-visualizar')
    .addEventListener('click', () => {
      openTab('visualizar');
    });

  $('bold-btn').innerHTML = Icons.bold;
  $('italic-btn').innerHTML = Icons.italic;
  $('list-btn').innerHTML = Icons.list;

  $('edit-bold-btn').innerHTML = Icons.bold;
  $('edit-italic-btn').innerHTML = Icons.italic;
  $('edit-list-btn').innerHTML = Icons.list;

  $('macros-list')
    .addEventListener('click', (e) => {

      const editButton =
        e.target.closest('.edit-btn');

      const deleteButton =
        e.target.closest('.delete-btn');

      if (editButton) {
        startEdit(editButton.dataset.id);
      }

      if (deleteButton) {
        deleteMacro(deleteButton.dataset.id);
      }
    });

  $('export-btn')
    .addEventListener('click', exportMacros);

  $('import-btn')
    .addEventListener('click', () => {
      $('import-file').click();
    });

  $('import-file')
    .addEventListener('change', (e) => {

      const file = e.target.files[0];

      if (file) {
        importMacros(file);
      }

      e.target.value = '';
    });

  setupEditorToolbar({
    editorId: 'rich-editor',
    boldBtnId: 'bold-btn',
    italicBtnId: 'italic-btn',
    listBtnId: 'list-btn'
  });

  setupEditorToolbar({
    editorId: 'edit-rich-editor',
    boldBtnId: 'edit-bold-btn',
    italicBtnId: 'edit-italic-btn',
    listBtnId: 'edit-list-btn'
  });
});