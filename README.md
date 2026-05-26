# <img width="26" height="26" alt="SpeedText Logo" src="https://github.com/laracmiranda/SpeedText/blob/main/site/assets/logo.svg" /> SpeedText

<p align="left">

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-826cff.svg)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-826cff.svg)
![HTML5](https://img.shields.io/badge/HTML5-826cff.svg)
![CSS3](https://img.shields.io/badge/CSS3-826cff.svg)

Extensão para Chrome que permite criar, gerenciar e expandir macros de texto em qualquer site com autocomplete inteligente.
Transforme atalhos como `\email`, `\pix` ou `\assinatura` em textos completos instantaneamente.

👉 Baixe a extensão: [SpeedText](https://github.com/laracmiranda/SpeedText/blob/main/site/SpeedText.zip)

---

## 📸 Demonstração rápida

### Extensão
<img src="./site/assets/SpeedTextGIF.gif" alt="SpeedText" width="250"/>

### Preview
<img src="./site/assets/PreviewGIF.gif" alt="Preview" width="300"/>

---

## ⚡ Funcionalidades

* Autocomplete inteligente em tempo real
* Expansão de macros em qualquer campo de texto
* Compatível com: Inputs, Textareas, Contenteditable, Rich editors
* Navegação pelo teclado (`↑ ↓ Enter Tab Esc`)
* Sistema moderno de sugestões flutuantes
* Detecção automática de Dark / Light Mode
* Importação de macros via `.json`
* Exportação de macros para backup
* Atualização instantânea das macros sem reiniciar
* Compatível com Gmail, Google Chat, Movidesk e outros sistemas web
* Interface moderna inspirada em apps desktop
* Suporte a múltiplas macros simultaneamente
* Sistema otimizado com cache local

---

## 🧠 Como funciona

Digite um atalho iniciado com `\` em qualquer campo de texto:

```txt
\email
```

O SpeedText exibe automaticamente sugestões de macros disponíveis.

Ao pressionar `Tab` ou selecionar com o mouse, o conteúdo é expandido instantaneamente:

```txt
Olá! Segue meu e-mail para contato:
contato@empresa.com
```

---

## 🛠️ Tecnologias

* **JavaScript (Vanilla)** — Core da extensão
* **Chrome Extensions API** — Integração com o navegador
* **HTML5** — Estrutura da interface
* **CSS3** — Interface moderna responsiva
* **MutationObserver** — Monitoramento dinâmico da página
* **Chrome Storage Sync** — Persistência sincronizada das macros

---

## 📦 Instalação

1. Clone o repositório

```bash
git clone https://github.com/laracmiranda/SpeedText.git
cd SpeedText
```

2. Abra o Chrome e acesse:

```txt
chrome://extensions
```

3. Ative o **Modo do desenvolvedor**

4. Clique em:

```txt
Carregar sem compactação
```

5. Selecione a pasta do projeto

---

## ✨ Utilizando

### Criando uma macro

1. Abra o popup da extensão
2. Defina:

   * Nome
   * Atalho
   * Conteúdo da macro
3. Salve a macro

---

### Expandindo uma macro

Digite o atalho em qualquer site:

```txt
\assinatura
```

O SpeedText exibirá sugestões automaticamente.

---

### Navegação rápida

| Tecla   | Ação                    |
| ------- | ----------------------- |
| `↑` `↓` | Navegar entre sugestões |
| `Enter` | Aplicar macro           |
| `Tab`   | Aplicar macro           |
| `Esc`   | Fechar sugestões        |

---

## 📂 Estrutura do Projeto

```bash
speedtext/
├── assets/                # Logos e imagens
├── site/                  # Landing page da extensão
├── popup.html
├── popup.css
├── popup.js
├── content.js             # Sistema principal da extensão
├── manifest.json
└── README.md
```

---

## 🚀 Diferenciais

O SpeedText foi desenvolvido pensando em produtividade real.

Ao invés de apenas substituir texto simples, ele:

* Funciona em rich text editors
* Detecta inputs dinâmicos automaticamente
* Mantém compatibilidade com apps modernos
* Possui autocomplete visual elegante
* Atualiza macros em tempo real
* Possui arquitetura otimizada e desacoplada

---

## 🤝 Contribuição

1. Faça um fork deste repositório
2. Crie uma branch para sua feature

```bash
git checkout -b feature/minha-feature
```

3. Commit suas alterações

```bash
git commit -m "feat: adiciona nova feature"
```

4. Envie para o GitHub

```bash
git push origin feature/minha-feature
```

5. Abra um Pull Request 🚀

---

## 📃 Licença

Este projeto está licenciado sob a licença **GNU General Public License v2.0 (GPL-2.0).**


---

> *“Menos repetição. Mais velocidade.”*
