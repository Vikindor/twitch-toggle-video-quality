// ==UserScript==
// @name         Twitch - Toggle Video Quality
// @namespace    twitch-toggle-video-quality
// @version      1.0.0
// @description  Adds a customizable button to toggle stream quality (lowest <-> preferred) with optional auto-mute
// @author       Vikindor (https://vikindor.github.io/)
// @homepageURL  https://github.com/Vikindor/twitch-toggle-video-quality/
// @supportURL   https://github.com/Vikindor/twitch-toggle-video-quality/issues
// @license      MIT
// @match        https://www.twitch.tv/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------------- CONFIG ----------------
  // Preferred HIGH resolution.
  // Set a number (e.g. 1080) to try switching to that exact height.
  // If not available on the stream, the script falls back to the highest available quality.
  // Set to "null" to always use the maximum available quality.
  const PREFERRED_HIGH = 1080;

  // When switching to the lowest quality, automatically mute the player (true / false)
  const MUTE_ON_LOW = true;

  // Persist quality + mute state across reload
  const PERSIST_SELECTION = true;

  // 'minimal' -> small "Q" button inside player controls (bottom-right of video)
  // 'header'  -> purple "Quality" button in the channel header (next to "Subscribe")
  const VISUAL_MODE = 'header';
  // ----------------------------------------

  function persistQuality(group) {
    if (!PERSIST_SELECTION) return;

    try {
      localStorage.setItem(
        'video-quality',
        JSON.stringify({ default: group })
      );
    } catch (e) {}
  }

  function persistMute(isMuted) {
    if (!PERSIST_SELECTION || !MUTE_ON_LOW) return;

    try {
      localStorage.setItem(
        'video-muted',
        JSON.stringify({ default: String(isMuted) })
      );
    } catch (e) {}
  }

  function restoreMute(player) {
    if (!PERSIST_SELECTION || !MUTE_ON_LOW) return;

    try {
      const raw = localStorage.getItem('video-muted');
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const isMuted = parsed?.default === 'true';

      player.setMuted(isMuted);
    } catch (e) {}
  }

  function getTwitchPlayer() {
    const node = document.querySelector('[data-a-target="video-player"]');
    if (!node) return null;

    const fiberKey = Object.keys(node).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return null;

    const fiber = node[fiberKey];
    let found;

    (function find(obj, depth = 0, maxDepth = 6, seen = new WeakSet()) {
      if (!obj || typeof obj !== 'object') return;
      if (seen.has(obj)) return;
      seen.add(obj);

      if (
        typeof obj.setQuality === 'function' &&
        typeof obj.getQualities === 'function'
      ) {
        found = obj;
        return;
      }

      if (depth > maxDepth) return;

      for (let key in obj) {
        try {
          find(obj[key], depth + 1, maxDepth, seen);
        } catch (e) {}
      }
    })(fiber);

    return found || null;
  }

  function extractHeight(q) {
    const match = q.name.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  function toggleQuality() {
    const player = getTwitchPlayer();
    if (!player) return;

    const qualities = player.getQualities();
    if (!qualities || !qualities.length) return;

    const current = player.getQuality();

    const lowest = qualities.reduce((min, q) =>
      q.bitrate < min.bitrate ? q : min
    );

    let preferredHigh = null;

    if (PREFERRED_HIGH != null) {
      preferredHigh = qualities.find(q =>
        extractHeight(q) === PREFERRED_HIGH
      );
    }

    const highestAvailable = qualities.reduce((max, q) =>
      q.bitrate > max.bitrate ? q : max
    );

    const high = preferredHigh || highestAvailable;

    const isCurrentlyLowest = current.group === lowest.group;

    if (isCurrentlyLowest) {
      player.setQuality(high);
      player.setMuted(false);
      persistQuality(high.group);
      persistMute(false);
    } else {
      player.setQuality(lowest);
      if (MUTE_ON_LOW) {
        player.setMuted(true);
        persistMute(true);
      }
      persistQuality(lowest.group);
    }
  }

  function insertMinimalButton() {
    if (document.getElementById('quality-toggle-btn')) return;

    const rightGroup = document.querySelector(
      '[data-a-target="player-controls"] .player-controls__right-control-group'
    );

    if (!rightGroup) return;

    const btn = document.createElement('button');
    btn.id = 'quality-toggle-btn';
    btn.type = 'button';
    btn.textContent = 'Q';

    btn.style.background = 'transparent';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = 'bold';
    btn.style.padding = '0 8px';
    btn.style.height = '100%';

    btn.addEventListener('click', toggleQuality);

    rightGroup.appendChild(btn);
  }

  function insertHeaderButton() {
    if (document.getElementById('quality-toggle-btn')) return;

    const headerRight = document.querySelector(
      '[data-target="channel-header-right"]'
    );

    if (!headerRight) return;

    const btn = document.createElement('button');
    btn.id = 'quality-toggle-btn';
    btn.type = 'button';

    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.height = '32px';
    btn.style.padding = '0 12px';
    btn.style.border = '0';
    btn.style.boxSizing = 'border-box';
    btn.style.cursor = 'pointer';
    btn.style.fontFamily = 'Inter, inherit';
    btn.style.fontSize = '14px';
    btn.style.fontWeight = '600';
    btn.style.lineHeight = '19.6px';
    btn.style.borderRadius = '9000px';
    btn.style.marginLeft = '8px';
    btn.style.backgroundColor = '#9147ff';
    btn.style.color = 'white';
    btn.style.transition = 'background-color 0.15s ease';

    const svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.marginRight = '6px';

    svg.innerHTML = `
      <line x1="4" y1="6" x2="20" y2="6"></line>
      <circle cx="9" cy="6" r="2"></circle>
      <line x1="4" y1="12" x2="20" y2="12"></line>
      <circle cx="15" cy="12" r="2"></circle>
      <line x1="4" y1="18" x2="20" y2="18"></line>
      <circle cx="11" cy="18" r="2"></circle>
    `;

    const label = document.createElement('span');
    label.textContent = 'Quality';

    btn.appendChild(svg);
    btn.appendChild(label);

    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = '#772ce8';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = '#9147ff';
    });

    btn.addEventListener('click', toggleQuality);

    headerRight.appendChild(btn);
  }

  function observeUI() {
    let muteRestored = false;

    const observer = new MutationObserver(() => {
      const player = getTwitchPlayer();

      if (player && !muteRestored) {
        setTimeout(() => {
          restoreMute(player);
        }, 500);

        muteRestored = true;
      }

      if (VISUAL_MODE === 'minimal') {
        insertMinimalButton();
      } else if (VISUAL_MODE === 'header') {
        insertHeaderButton();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  window.addEventListener('load', () => {
    observeUI();
  });
})();
