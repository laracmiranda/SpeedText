/*
 * SpeedText
 * Copyright (C) 2026 Lara Miranda
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License v2.0.
 */

const monitoredElements = new WeakSet(); // evita duplicar listeners no mesmo elemento

let activeSuggestions = null;            // dropdown atual de sugestões
let currentInput = null;                 // input ativo atual
let currentSuggestions = [];            // lista atual de sugestões
let selectedIndex = -1;                 // índice selecionado no dropdown

const inputState = new WeakMap();       // controla estado por input
let cachedMacros = [];                  // cache local das macros

const htmlParser = document.createElement('div'); // reutilizado para evitar recriação

// Tipos de elementos editáveis suportados pela extensão
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

// -- Tema --

// Verifica se o navegador está em dark mode
const DARK_MODE_QUERY = window.matchMedia(
  '(prefers-color-scheme: dark)'
);

// Temas para light e dark mode
function getThemeColors() {
  const dark = DARK_MODE_QUERY.matches;

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

// -- Cache --
async function loadMacrosCache() {
  const { macros = [] } =
    await chrome.storage.sync.get('macros');

  cachedMacros = macros;
}

// Atualiza macros em tempo real quando são editadas na extensão, e atualiza sugestões abertas
chrome.storage.onChanged?.addListener((changes, area) => {

  if (area !== 'sync' || !changes.macros) return;

  cachedMacros = changes.macros.newValue || [];

  if (!currentInput) return;

  updateSuggestions(currentInput);
});

// -- Helpers --

// Retorna o valor atual do elemento, seja ele um input, textarea ou contenteditable
function getElementValue(el) {
  return (
    el.value ||
    el.textContent ||
    el.innerText ||
    ''
  ).trim();
}

// Evita erros em regex com caracteres especiais
function escapeRegExp(str) {
  return str.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

// Converte HTML para texto puro
function htmlToPlainText(html) {
  htmlParser.innerHTML = html;

  htmlParser
    .querySelectorAll('br')
    .forEach(br => br.replaceWith('\n'));

  htmlParser
    .querySelectorAll('li')
    .forEach(li => {
      li.innerHTML = `• ${li.innerHTML}`;
    });

  return (
    htmlParser.innerText ||
    htmlParser.textContent ||
    ''
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Define se o elemento deve ser tratado como texto puro ou rich text
function isPlainTextElement(el) {
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    !el.isContentEditable
  );
}

// -- Inputs --

// Define o valor do elemento, tratando adequadamente inputs simples e contenteditables
function setElementValue(el, value) {
  const plain = htmlToPlainText(value);

  // input/textarea
  if (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA'
  ) {

    el.value = plain;

    // move cursor para o final
    el.setSelectionRange?.(
      el.value.length,
      el.value.length
    );

    // dispara eventos para notificar mudanças
    el.dispatchEvent(
      new Event('input', { bubbles: true })
    );

    el.dispatchEvent(
      new Event('change', { bubbles: true })
    );

    return;
  }

  // contenteditable (rich text)
  if (el.isContentEditable) {

    el.focus();
    el.innerHTML = '';

    const temp = document.createElement('div');
    temp.innerHTML = value;

    while (temp.firstChild) {
      el.appendChild(temp.firstChild);
    }

    const range = document.createRange();
    const selection = window.getSelection();

    range.selectNodeContents(el);
    range.collapse(false);

    selection.removeAllRanges();
    selection.addRange(range);

    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: plain
    }));

    return;
  }

  el.textContent = plain;
  el.focus();
}

// Retorna todos os elementos editáveis na página, incluindo iframes
function getEditableElements(root = document) {

  const elements = [];

  try {

    root.querySelectorAll?.(
      EDITABLE_SELECTORS
    ).forEach(el => {

      if (
        !el.disabled &&
        el.offsetParent !== null
      ) {
        elements.push(el);
      }
    });

  } catch (_) {}

  // suporte iframe
  document.querySelectorAll('iframe')
    .forEach(iframe => {

      try {

        const doc = iframe.contentDocument;

        if (
          !doc ||
          doc.readyState !== 'complete'
        ) return;

        doc.querySelectorAll(
          EDITABLE_SELECTORS
        ).forEach(el => {

          if (
            !el.disabled &&
            el.offsetParent !== null
          ) {
            elements.push(el);
          }
        });

      } catch (_) {}
    });

  return elements;
}

// Retorna todos os elementos editáveis na página, incluindo iframes, com tratamento de erros para iframes sem acesso
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

// -- Funcionamento --

// Atualiza sugestões com base no input atual, evitando processamento duplicado
function updateSuggestions(target) {
  currentInput = target;
  const value = getElementValue(target);

  if (!value) {
    hideSuggestions();
    return;
  }

  const lastIndex = value.lastIndexOf('\\');

  if (lastIndex === -1) {
    hideSuggestions();
    return;
  }

  const prefix = value
    .substring(lastIndex)
    .split(/\s+/)[0];

  const state = inputState.get(target) || {};

  // evita processamento duplicado
  if (
    state.lastPrefix === prefix &&
    state.lastValue === value
  ) {
    return;
  }

  inputState.set(target, {
    lastPrefix: prefix,
    lastValue: value
  });

  currentSuggestions = cachedMacros
    .filter(m =>
      m.shortcut
        ?.toLowerCase()
        .startsWith(prefix.toLowerCase())
    )
    .slice(0, 10);

  if (!currentSuggestions.length) {
    hideSuggestions();
    return;
  }

  selectedIndex = 0;

  showSuggestions(
    currentSuggestions,
    target,
    prefix
  );
}

// Exibe o dropdown de sugestões posicionado próximo ao input
function showSuggestions(list, inputEl, prefix) {
  hideSuggestions(false);

  const rect = inputEl.getBoundingClientRect();
  const MAX_HEIGHT = 220;
  const SPACING = 6;
  const theme = getThemeColors();

  activeSuggestions = document.createElement('div');

  activeSuggestions.id =
    'macro-suggestions-dropdown';

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

  // calcula direção
  const dropdownHeight =
    activeSuggestions.offsetHeight;

  const spaceBelow =
    window.innerHeight - rect.bottom;

  const spaceAbove = rect.top;

  const shouldOpenUp =
    spaceBelow < dropdownHeight &&
    spaceAbove > spaceBelow;

  activeSuggestions.style.top = shouldOpenUp
    ? `${rect.top - dropdownHeight - SPACING}px`
    : `${rect.bottom + SPACING}px`;

  activeSuggestions.style.transform =
    shouldOpenUp
      ? 'translateY(4px)'
      : 'translateY(-4px)';

  requestAnimationFrame(() => {

    activeSuggestions.style.opacity = '1';
    activeSuggestions.style.pointerEvents = 'auto';
    activeSuggestions.style.transform =
      'translateY(0)';
  });

  // eventos
  activeSuggestions
    .querySelectorAll('.item')
    .forEach((el, i) => {

      el.onclick = () => {
        applySuggestion(
          list[i],
          inputEl,
          prefix
        );
      };

      el.onmouseenter = () => {
        selectedIndex = i;
        updateSelection();
      };
    });

  updateSelection();
}

// Atualiza a seleção visual das sugestões, destacando a opção ativa 
function updateSelection() {

  if (!activeSuggestions) return;
  const theme = getThemeColors();
  activeSuggestions
    .querySelectorAll('.item')
    .forEach((el, i) => {

      const active =
        i === selectedIndex;

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

// Aplica a macro selecionada no input, substituindo o prefixo pelo conteúdo da macro
function applySuggestion(
  macro,
  input,
  prefix
) {

  const regex = new RegExp(
    escapeRegExp(prefix) + '\\s*$',
    'i'
  );

  const value = getElementValue(input);

  const content = isPlainTextElement(input)
    ? htmlToPlainText(macro.text)
    : macro.text;

  setElementValue(
    input,
    value.replace(regex, content)
  );

  hideSuggestions();
}

// Oculta o dropdown de sugestões e reseta o estado
function hideSuggestions(reset = true) {

  activeSuggestions?.remove();
  activeSuggestions = null;

  if (reset) {
    currentSuggestions = [];
    selectedIndex = -1;
  }
}

// -- Monitoramento --

// Monitora inputs editáveis para mostrar sugestões de macros conforme o usuário digita
function monitorInput(el) {

  if (monitoredElements.has(el)) return;
  monitoredElements.add(el);

  // captura digitação e alterações
  el.addEventListener('input', e => {
    updateSuggestions(
      e.target || e.srcElement
    );
  });

  // captura teclas para navegação no dropdown
  el.addEventListener('keyup', e => {
    updateSuggestions(
      e.target || e.srcElement
    );
  });

  // captura colagem de texto para atualizar sugestões
  el.addEventListener('paste', e => {
    updateSuggestions(
      e.target || e.srcElement
    );
  });

  el.addEventListener('keydown', e => {

    if (
      !activeSuggestions ||
      currentInput !== e.target
    ) return;

    switch (e.key) {

      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(
          selectedIndex + 1,
          currentSuggestions.length - 1
        );
        updateSelection();
        break;

      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(
          selectedIndex - 1,
          0
        );
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
            inputState.get(currentInput)
              ?.lastPrefix || ''
          );
        }

        break;

      case 'Escape':
        hideSuggestions();
        break;
    }
  });
}

// monitora foco atual
setInterval(() => {

  const el = document.activeElement;

  if (
    el &&
    (
      el.matches?.(EDITABLE_SELECTORS) ||
      el.isContentEditable
    )
  ) {
    monitorInput(el);
  }

}, 500);

// -- Eventos Globais --

// Fecha sugestões ao clicar fora ou apertar ESC
document.addEventListener('click', e => {
  if (
    activeSuggestions &&
    !activeSuggestions.contains(e.target)
  ) {
    hideSuggestions();
  }
});

// Fecha sugestões ao apertar ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideSuggestions();
  }
});

// Atualiza tema automaticamente
DARK_MODE_QUERY.addEventListener(
  'change',
  () => {

    if (
      activeSuggestions &&
      currentInput &&
      currentSuggestions.length
    ) {

      showSuggestions(
        currentSuggestions,
        currentInput,
        inputState.get(currentInput)
          ?.lastPrefix || ''
      );
    }
  }
);

// -- Init --

// Inicializa a extensão, carregando macros e monitorando inputs editáveis na página
async function init() {
  await loadMacrosCache();

  getEditableElements()
    .forEach(monitorInput);

  // monitora dinamicamente novos inputs adicionados à página
  const observer = new MutationObserver(
    mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;

          if (
            node.matches?.(
              EDITABLE_SELECTORS
            )
          ) {
            monitorInput(node);
          }

          node.querySelectorAll?.(
            EDITABLE_SELECTORS
          ).forEach(monitorInput);

          node.shadowRoot
            ?.querySelectorAll?.(
              EDITABLE_SELECTORS
            )
            .forEach(monitorInput);
        });
      });
    }
  );

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// bootstrap
document.readyState === 'loading'
  ? document.addEventListener(
      'DOMContentLoaded',
      init
    )
  : init();