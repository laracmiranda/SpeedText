const monitoredElements = new WeakSet(); // evita duplicar listeners no mesmo elemento

let activeSuggestions = null;            // dropdown atual de sugestões
let currentInput = null;                 // input ativo atual
let currentSuggestions = [];            // lista atual de sugestões
let selectedIndex = -1;                 // índice selecionado no dropdown

const inputState = new WeakMap();       // controla estado por input
let cachedMacros = [];                  // cache local das macros

const htmlParser = document.createElement('div'); // reutilizado para evitar recriação

//Seletores
// elementos editáveis suportados pela extensão
const EDITABLE_SELECTORS = `
  input[type="text"],
  input[type="search"],
  input[type="email"],
  input[type="url"],
  input:not([type]),
  textarea,
  [contenteditable="true"],
  [role="textbox"]
`;

//Cache
async function loadMacrosCache() {
  const result = await chrome.storage.local.get('macros');
  cachedMacros = result.macros || [];
}

// atualiza cache automaticamente quando macros mudam
chrome.storage.onChanged?.addListener((changes, area) => {
  if (area === 'local' && changes.macros) {
    cachedMacros = changes.macros.newValue || [];
  }
});

//Captura elementos editáveis da página (inputs, textareas, contenteditables)
function getEditableElements(root = document) {
  const elements = [];

  try {
    root.querySelectorAll?.(EDITABLE_SELECTORS).forEach(el => {
      if (!el.disabled && el.offsetParent !== null) {
        elements.push(el);
      }
    });
  } catch (_) {}

  // suporte a iframes (mantido por compatibilidade com apps complexos)
  document.querySelectorAll('iframe').forEach(iframe => {
    try {
      const doc = iframe.contentDocument;
      if (!doc || doc.readyState !== 'complete') return;

      doc.querySelectorAll(EDITABLE_SELECTORS).forEach(el => {
        if (!el.disabled && el.offsetParent !== null) {
          elements.push(el);
        }
      });
    } catch (_) {
      // iframe sem acesso é ignorado
    }
  });

  return elements;
}

//Helpers
function getElementValue(el) {
  // retorna texto atual do elemento
  return (el.value || el.textContent || el.innerText || '').trim();
}

function escapeRegExp(str) {
  // evita erro em regex com caracteres especiais
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

//Realiza conversão de html para texto dependendo do input do site
function htmlToPlainText(html) {
  htmlParser.innerHTML = html;

  // converte <br> em quebra de linha
  htmlParser.querySelectorAll('br').forEach(br => br.replaceWith('\n'));

  // adiciona bullet em listas
  htmlParser.querySelectorAll('li').forEach(li => {
    li.innerHTML = `• ${li.innerHTML}`;
  });

  let text = htmlParser.innerText || htmlParser.textContent || '';

  // remove excesso de quebras de linha
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

//Identifica o tipo de input
function isPlainTextElement(el) {
  // define se deve tratar como texto puro ou rich text
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    !el.isContentEditable
  );
}

//Define valor do elemento
function setElementValue(el, value) {
  const plain = htmlToPlainText(value);

  // input/textarea padrão
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    el.value = plain;

    // move cursor para o final
    if (el.setSelectionRange) {
      el.setSelectionRange(el.value.length, el.value.length);
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // contenteditable (editores ricos)
  if (el.isContentEditable) {
    el.focus();
    el.innerHTML = '';

    const temp = document.createElement('div');
    temp.innerHTML = value;

    while (temp.firstChild) {
      el.appendChild(temp.firstChild);
    }

    const range = document.createRange();
    const sel = window.getSelection();

    range.selectNodeContents(el);
    range.collapse(false);

    sel.removeAllRanges();
    sel.addRange(range);

    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: plain
    }));

    return;
  }

  // fallback seguro
  el.textContent = plain;
  el.focus();
}
//Monitoramento do Input
function monitorInput(el) {
  if (monitoredElements.has(el)) return;
  monitoredElements.add(el);

  // captura digitação/alterações
  const handleInput = (e) => {
    const target = e.target || e.srcElement;
    currentInput = target;

    const value = getElementValue(target);
    if (!value) return hideSuggestions();

    const lastIndex = value.lastIndexOf('\\');
    if (lastIndex === -1) return hideSuggestions();

    const prefix = value.substring(lastIndex).split(/\s+/)[0];

    const state = inputState.get(target) || {};

    // evita reprocessar mesma entrada
    if (state.lastPrefix === prefix && state.lastValue === value) return;

    state.lastPrefix = prefix;
    state.lastValue = value;
    inputState.set(target, state);

    // filtra macros do cache
    currentSuggestions = cachedMacros
      .filter(m =>
        m.shortcut?.toLowerCase().startsWith(prefix.toLowerCase())
      )
      .slice(0, 10);

    if (!currentSuggestions.length) return hideSuggestions();

    selectedIndex = 0;
    showSuggestions(currentSuggestions, target, prefix);
  };

  // navegação do teclado no dropdown
  const handleKeydown = (e) => {
    if (!activeSuggestions || currentInput !== e.target) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
        updateSelection();
        break;

      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection();
        break;

      case 'Tab':
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();

        if (selectedIndex >= 0) {
          applySuggestion(
            currentSuggestions[selectedIndex],
            currentInput,
            inputState.get(currentInput)?.lastPrefix || ''
          );
        }
        break;

      case 'Escape':
        hideSuggestions();
        break;
    }
  };

  el.addEventListener('input', handleInput);
  el.addEventListener('keyup', handleInput);
  el.addEventListener('paste', handleInput);
  el.addEventListener('keydown', handleKeydown);
}

//Monitoramento de eventos
setInterval(() => {
  const el = document.activeElement;

  if (!el) return;

  const isEditable =
    el.matches?.(EDITABLE_SELECTORS) || el.isContentEditable;

  if (isEditable && !monitoredElements.has(el)) {
    monitorInput(el);
  }
}, 500);

//Mostra as sugestões de macros no input
function showSuggestions(list, inputEl, prefix) {
  hideSuggestions(false);

  const rect = inputEl.getBoundingClientRect();

  activeSuggestions = document.createElement('div');
  activeSuggestions.id = 'macro-suggestions-dropdown';

  activeSuggestions.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.bottom + window.scrollY + 5}px;
    z-index: 2147483647;
    background: white;
    border: 1px solid #007bff;
    border-radius: 6px;
    max-height: 200px;
    overflow-y: auto;
    min-width: ${Math.max(rect.width, 200)}px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: Arial;
    font-size: 14px;
  `;

  // renderiza lista de sugestões
  activeSuggestions.innerHTML = list.map((m, i) => {
    const preview = (m.text || '').slice(0, 50);

    return `
      <div class="item" data-i="${i}"
        style="padding:8px;cursor:pointer;border-bottom:1px solid #eee">
        <b>${m.shortcut}</b><br>
        <small>${m.name} - ${preview}</small>
      </div>
    `;
  }).join('');

  // clique e hover nas sugestões
  activeSuggestions.querySelectorAll('.item').forEach((el, i) => {
    el.onclick = () => {
      applySuggestion(list[i], inputEl, prefix);
      hideSuggestions();
    };

    el.onmouseenter = () => {
      selectedIndex = i;
      updateSelection();
    };
  });

  // scroll do mouse no dropdown
  activeSuggestions.addEventListener('wheel', (e) => {
    e.preventDefault();

    selectedIndex += e.deltaY > 0 ? 1 : -1;
    selectedIndex = Math.max(0, Math.min(selectedIndex, currentSuggestions.length - 1));

    updateSelection();
  }, { passive: false });

  document.body.appendChild(activeSuggestions);
  updateSelection();
}

// Atualizar a seleção visual das macros
function updateSelection() {
  if (!activeSuggestions) return;

  const items = activeSuggestions.querySelectorAll('.item');

  items.forEach((el, i) => {
    const active = i === selectedIndex;

    el.style.background = active ? '#e3f2fd' : 'white';
    el.style.color = active ? '#007bff' : '#000';

    if (active) el.scrollIntoView({ block: 'nearest' });
  });
}

// Aplicar macro
function applySuggestion(macro, input, prefix) {
  const value = getElementValue(input);

  const regex = new RegExp(escapeRegExp(prefix) + '\\s*$', 'i');

  const content = isPlainTextElement(input)
    ? htmlToPlainText(macro.text)
    : macro.text;

  setElementValue(input, value.replace(regex, content));

  hideSuggestions();
}

// Esconder UI da macro no input
function hideSuggestions(reset = true) {
  if (activeSuggestions) {
    activeSuggestions.remove();
    activeSuggestions = null;
  }

  if (reset) {
    currentSuggestions = [];
    selectedIndex = -1;
  }
}


// Eventos Globais
document.addEventListener('click', (e) => {
  if (activeSuggestions && !activeSuggestions.contains(e.target)) {
    hideSuggestions();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideSuggestions();
});

//Init
async function init() {
  await loadMacrosCache();

  const elements = getEditableElements();
  elements.forEach(monitorInput);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;

        if (node.matches?.(EDITABLE_SELECTORS)) {
          monitorInput(node);
        }

        node.querySelectorAll?.(EDITABLE_SELECTORS)
          .forEach(monitorInput);

        node.shadowRoot?.querySelectorAll?.(EDITABLE_SELECTORS)
          .forEach(monitorInput);
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}