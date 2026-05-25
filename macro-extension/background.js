/*
 * SpeedText
 * Copyright (C) 2026 Lara Miranda
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License v2.0.
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