/*
 * SpeedText
 * Copyright (c) 2026 Lara Corsini de Miranda
 *
 * This source code may be viewed, studied, and used for personal
 * and non-commercial purposes only.
 *
 * Commercial use, redistribution, resale, relicensing, modification
 * for commercial purposes, or removal of author credits is prohibited
 * without prior written permission from the author.
 *
 * See the LICENSE file for full terms.
 */

//Gerencia mensagens para fallback

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getMacros') {
    chrome.storage.sync.get('macros', (result) => {
      sendResponse({ macros: result.macros || [] });
    });
    return true;  // Resposta assíncrona
  }
});