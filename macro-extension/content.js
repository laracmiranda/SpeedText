const monitoredElements = new WeakSet(); // evita duplicar listeners no mesmo elemento

let activeSuggestions = null;            // dropdown atual de sugestões
let currentInput = null;                 // input ativo atual
let currentSuggestions = [];            // lista atual de sugestões
let selectedIndex = -1;                 // índice selecionado no dropdown

const inputState = new WeakMap();       // controla estado por input
let cachedMacros = [];                  // cache local das macros

const htmlParser = document.createElement('div'); // reutilizado para evitar recriação

// Seletores
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

// Helpers

// Verifica se o navegador está em dark mode
function isDarkMode() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Temas para light e dark mode
function getThemeColors() {
  const dark = isDarkMode();

  return dark
    ? {
        background: '#1e1e1e',
        border: '#343434',
        text: '#f5f5f5',
        secondary: '#a1a1aa',
        hover: '#2b2b2b',
        selected: '#312f42',
        primary: '#6063fa',
        shadow: `
          0 10px 30px rgba(0,0,0,0.45),
          0 2px 8px rgba(0,0,0,0.30)
        `
      }
    : {
        background: '#ffffff',
        border: '#d7d7d7',
        text: '#111111',
        secondary: '#666666',
        hover: '#f5f5f5',
        selected: '#f3f4ff',
        primary: '#0400ff',
        shadow: `
          0 10px 30px rgba(0,0,0,0.12),
          0 2px 8px rgba(0,0,0,0.08)
        `
      };
}

//Cache
async function loadMacrosCache() {
  const result = await chrome.storage.sync.get('macros');
  cachedMacros = result.macros || [];
}

// atualiza cache automaticamente quando macros mudam
chrome.storage.onChanged?.addListener((changes, area) => {

  if (area === 'sync' && changes.macros) {
    cachedMacros = changes.macros.newValue || [];

    // atualiza sugestões abertas em tempo real
    if (currentInput) {
      const value = getElementValue(currentInput);
      const lastIndex = value.lastIndexOf('\\');

      if (lastIndex !== -1) {
        const prefix = value
          .substring(lastIndex)
          .split(/\s+/)[0];

        currentSuggestions = cachedMacros
          .filter(m =>
            m.shortcut?.toLowerCase()
              .startsWith(prefix.toLowerCase())
          )
          .slice(0, 10);

        if (currentSuggestions.length) {
          selectedIndex = 0;
          showSuggestions(
            currentSuggestions,
            currentInput,
            prefix
          );
        } else {
          hideSuggestions();
        }
      }
    }
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

//Mostra as sugestões de macros no input area da página web
function showSuggestions(list, inputEl, prefix) {
  hideSuggestions(false);
  const rect = inputEl.getBoundingClientRect();
  const MAX_HEIGHT = 220;
  const SPACING = 6;
  const theme = getThemeColors();
  activeSuggestions = document.createElement('div');
  activeSuggestions.id = 'macro-suggestions-dropdown';

  activeSuggestions.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    z-index: 2147483647;
    background: ${theme.background};
    border: 1px solid ${theme.border};
    border-radius: 12px;
    max-height: ${MAX_HEIGHT}px;
    overflow-y: auto;
    min-width: ${Math.max(rect.width, 260)}px;
    box-shadow: ${theme.shadow};
    font-family: Inter, Arial, sans-serif;
    font-size: 13px;
    color: ${theme.text};
    backdrop-filter: blur(10px);
    opacity: 0;
    pointer-events: none;
    transition:
      opacity .12s ease,
      transform .12s ease;
  `;

  // Renderiza lista
  activeSuggestions.innerHTML = list.map((m, i) => {

    const preview = htmlToPlainText(m.text || '')
      .replace(/\n/g, ' ')
      .slice(0, 70);

    return `
      <div
        class="item"
        data-i="${i}"
        style="
          padding: 10px 12px;
          cursor: pointer;
          border-bottom: 1px solid ${theme.border};
          transition:
            background .12s ease,
            color .12s ease;
        "
      >

        <div
          style="
            font-weight: 600;
            color: ${theme.primary};
            margin-bottom: 2px;
          "
        >
          ${m.shortcut}
        </div>

        <div
          style="
            font-size: 12px;
            color: ${theme.secondary};
            line-height: 1.4;
          "
        >
          ${m.name} — ${preview}
        </div>

      </div>
    `;
  }).join('');

  document.body.appendChild(activeSuggestions);

  // altura REAL do dropdown
  const dropdownHeight = activeSuggestions.offsetHeight;

  // espaço disponível
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  // decide direção
  const shouldOpenUp =
    spaceBelow < dropdownHeight &&
    spaceAbove > spaceBelow;

  // posição FINAL
  const topPosition = shouldOpenUp
    ? rect.top - dropdownHeight - SPACING
    : rect.bottom + SPACING;

  activeSuggestions.style.top = `${topPosition}px`;

  // animação suave
  activeSuggestions.style.transform = shouldOpenUp
    ? 'translateY(4px)'
    : 'translateY(-4px)';

  requestAnimationFrame(() => {
    activeSuggestions.style.opacity = '1';
    activeSuggestions.style.pointerEvents = 'auto';
    activeSuggestions.style.transform = 'translateY(0)';
  });

  // Eventos
  activeSuggestions.querySelectorAll('.item')
    .forEach((el, i) => {

      el.onclick = () => {
        applySuggestion(
          list[i],
          inputEl,
          prefix
        );
        hideSuggestions();
      };

      el.onmouseenter = () => {
        selectedIndex = i;
        updateSelection();
      };
    });

  updateSelection();
}

// Atualizar a seleção visual das macros
function updateSelection() {

  if (!activeSuggestions) return;
  const theme = getThemeColors();

  const items =
    activeSuggestions.querySelectorAll('.item');

  items.forEach((el, i) => {
    const active = i === selectedIndex;
    el.style.background = active
      ? theme.selected
      : theme.background;

    el.style.color = theme.text;

    if (active) {
      el.scrollIntoView({
        block: 'nearest'
      });
    }
  });
}

// Atualizar tema em tempo real
window.matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => {

    if (
      activeSuggestions &&
      currentInput &&
      currentSuggestions.length
    ) {

      showSuggestions(
        currentSuggestions,
        currentInput,
        inputState.get(currentInput)?.lastPrefix || ''
      );
    }
  });

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