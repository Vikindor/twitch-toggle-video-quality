// ==UserScript==
// @name         Twitch - Toggle Video Quality
// @namespace    twitch-toggle-video-quality
// @version      1.2.8
// @description  Adds a customizable button to toggle stream quality (lowest <-> preferred) with optional auto-mute
// @author       Vikindor (https://vikindor.github.io/)
// @homepageURL  https://github.com/Vikindor/twitch-toggle-video-quality/
// @supportURL   https://github.com/Vikindor/twitch-toggle-video-quality/issues
// @license      GPL-3.0
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

  // Persist quality + mute state across reload (true / false)
  const PERSIST_SELECTION = true;

  // 'minimal' -> small icon button inside player controls (bottom-right of video)
  // 'header'  -> purple "Quality" button in the channel header (next to "Subscribe")
  const VISUAL_MODE = 'header';
  // ----------------------------------------

  const QUALITY_BUTTON_LABELS = {
    en: 'Quality',
    da: 'Kvalitet',
    de: 'Qualität',
    es: 'Calidad',
    fr: 'Qualité',
    it: 'Qualità',
    hu: 'Minőség',
    nl: 'Kwaliteit',
    no: 'Kvalitet',
    pl: 'Jakość',
    pt: 'Qualidade',
    ro: 'Calitate',
    sk: 'Kvalita',
    fi: 'Laatu',
    sv: 'Kvalitet',
    vi: 'Chất lượng',
    tr: 'Kalite',
    cs: 'Kvalita',
    el: 'Ποιότητα',
    bg: 'Качество',
    ru: 'Качество',
    uk: 'Якість',
    th: 'คุณภาพ',
    ar: 'الجودة',
	'zh-cn': '画质',
	'zh-tw': '畫質',
    ja: '画質',
    ko: '화질'
  };

  function getQualityButtonLabel() {
    const lang = (document.documentElement.lang || 'en').toLowerCase();

    if (QUALITY_BUTTON_LABELS[lang]) {
      return QUALITY_BUTTON_LABELS[lang];
    }

    const baseLang = lang.split('-')[0];
    return QUALITY_BUTTON_LABELS[baseLang] || QUALITY_BUTTON_LABELS.en;
  }

  function persistQuality(quality) {
    if (!PERSIST_SELECTION) return;
    if (!quality || !quality.group) return;

    try {
      localStorage.setItem(
        'video-quality-highest-available',
        'false'
      );

      const bitrate = Number(quality.bitrate);
      if (Number.isFinite(bitrate) && bitrate > 0) {
        localStorage.setItem(
          'quality-bitrate',
          String(bitrate)
        );
      }

      localStorage.setItem(
        'video-quality',
        JSON.stringify({ default: quality.group })
      );
    } catch (e) {}
  }

  function persistMute(isMuted) {
    if (!PERSIST_SELECTION || !MUTE_ON_LOW) return;

    try {
      localStorage.setItem(
        'video-muted',
        JSON.stringify({ default: isMuted })
      );
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

  function isOfflineChannelPage() {
    return !!document.querySelector('.home-offline-hero');
  }

  function removeQualityButton() {
    document.getElementById('quality-toggle-btn')?.remove();
  }

  function getButtonContainer() {
    if (VISUAL_MODE === 'minimal') {
      return document.querySelector(
        '[data-a-target="player-controls"] .player-controls__right-control-group'
      );
    }

    if (VISUAL_MODE === 'header') {
      return document.querySelector('[data-target="channel-header-right"]');
    }

    return null;
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
      persistQuality(high);
      persistMute(false);
    } else {
      player.setQuality(lowest);
      if (MUTE_ON_LOW) {
        player.setMuted(true);
        persistMute(true);
      }
      persistQuality(lowest);
    }
  }

  function createQualityIcon() {
    const svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const path = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path'
    );
    path.setAttribute('fill', 'currentColor');
    path.setAttribute(
      'd',
      'M4.25 6.5a.75.75 0 0 1 .75-.75h14a.75.75 0 0 1 0 1.5h-14a.75.75 0 0 1-.75-.75Zm2.75 0a1.65 1.65 0 1 0 3.3 0 1.65 1.65 0 0 0-3.3 0ZM4.25 12a.75.75 0 0 1 .75-.75h14a.75.75 0 0 1 0 1.5h-14a.75.75 0 0 1-.75-.75Zm8.5 0a1.65 1.65 0 1 0 3.3 0 1.65 1.65 0 0 0-3.3 0ZM4.25 17.5a.75.75 0 0 1 .75-.75h14a.75.75 0 0 1 0 1.5h-14a.75.75 0 0 1-.75-.75Zm4.75 0a1.65 1.65 0 1 0 3.3 0 1.65 1.65 0 0 0-3.3 0Z'
    );

    svg.appendChild(path);
    return svg;
  }

  function insertMinimalButton() {
    if (document.getElementById('quality-toggle-btn')) return;
    if (isOfflineChannelPage()) return;
  
    const rightGroup = document.querySelector(
      '[data-a-target="player-controls"] .player-controls__right-control-group'
    );
  
    if (!rightGroup) return;
  
    const btn = document.createElement('button');
    btn.id = 'quality-toggle-btn';
    btn.type = 'button';
  
    btn.style.background = 'transparent';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.width = '32px';
    btn.style.height = '32px';
    btn.style.padding = '0';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.borderRadius = '9999px';
    btn.style.transition = 'background-color 0.15s ease';
  
    const svg = createQualityIcon(24, 1.25);
    btn.appendChild(svg);
  
    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = 'rgba(255, 255, 255, 0.13)';
    });
  
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = 'transparent';
    });
  
    btn.addEventListener('click', toggleQuality);
  
    rightGroup.appendChild(btn);
  }

  function insertHeaderButton() {
    if (document.getElementById('quality-toggle-btn')) return;
    if (isOfflineChannelPage()) return;

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
    btn.style.marginInlineStart = '8px';
    btn.style.backgroundColor = '#9147ff';
    btn.style.color = 'white';
    btn.style.transition = 'background-color 0.15s ease';

    const svg = createQualityIcon();

    const label = document.createElement('span');
    label.textContent = getQualityButtonLabel();
    label.style.paddingInline = '6px';

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
    let syncScheduled = false;
    let uiObserver = null;
    let uiObserverTimeoutId = null;

    function syncButton() {
      syncScheduled = false;

      if (isOfflineChannelPage()) {
        removeQualityButton();
        return;
      }

      if (getButtonContainer()) {
        if (VISUAL_MODE === 'minimal') {
          insertMinimalButton();
        } else if (VISUAL_MODE === 'header') {
          insertHeaderButton();
        }
      } else {
        removeQualityButton();
      }
    }

    function scheduleSync() {
      if (syncScheduled) return;
      syncScheduled = true;
      requestAnimationFrame(syncButton);
    }

    function stopUIBootstrapObserver() {
      if (uiObserver) {
        uiObserver.disconnect();
        uiObserver = null;
      }

      if (uiObserverTimeoutId) {
        clearTimeout(uiObserverTimeoutId);
        uiObserverTimeoutId = null;
      }
    }

    function startUIBootstrapObserver() {
      stopUIBootstrapObserver();

      if (getButtonContainer() || isOfflineChannelPage()) {
        scheduleSync();
        return;
      }

      uiObserver = new MutationObserver(() => {
        if (!getButtonContainer() && !isOfflineChannelPage()) return;

        stopUIBootstrapObserver();
        scheduleSync();
      });

      uiObserver.observe(document.body, {
        childList: true,
        subtree: true
      });

      uiObserverTimeoutId = setTimeout(() => {
        stopUIBootstrapObserver();
      }, 10000);
    }

    function handleRouteChange() {
      removeQualityButton();
      scheduleSync();
      startUIBootstrapObserver();
    }

    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      handleRouteChange();
      return result;
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      handleRouteChange();
      return result;
    };

    window.addEventListener('popstate', handleRouteChange);

    const headObserver = new MutationObserver(scheduleSync);
    headObserver.observe(document.head, {
      childList: true,
      subtree: true
    });

    handleRouteChange();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeUI, { once: true });
  } else {
    observeUI();
  }
})();
