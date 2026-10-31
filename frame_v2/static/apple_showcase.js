/**
 * Apple Showcase Controller
 * Handles Highlights Edge-to-Edge Gallery (with left/right peek cards),
 * Dynamic Video Storage & Management with Visible Remove Buttons,
 * Clean App Navigation Bar, and YouTube Video embeds with real-time scrub syncing.
 */
(function() {
    'use strict';

    // =========================================================================
    // 1. Navigation Active State Synchronization
    // =========================================================================
    function syncNavActive(path) {
        const normalized = (path || window.location.pathname).split('?')[0];
        document.querySelectorAll('.app-nav-item').forEach(el => el.classList.remove('active'));

        const docsLink = document.getElementById('navDocsLink');
        const videosLink = document.getElementById('navVideosLink');
        const musicLink = document.getElementById('navMusicLink');

        if (normalized === '/videos') {
            if (videosLink) videosLink.classList.add('active');
        } else if (normalized === '/music') {
            if (musicLink) musicLink.classList.add('active');
        } else {
            // Docs route ('/' or '/docs')
            if (docsLink) docsLink.classList.add('active');
        }
    }

    window.syncGlobalNavActive = syncNavActive;

    // =========================================================================
    // 2. Database-Backed Video Storage & Gallery Management
    // =========================================================================
    const STORAGE_KEY = 'noteslook_videos_list';
    let storedVideosCache = null;
    let isFetchingVideos = false;

    function getStoredVideosLocal() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data !== null) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    // Filter out legacy demo video IDs
                    return parsed.filter(v => v && v.id && v.id !== 'dQw4w9WgXcQ' && v.id !== 'L_LUpnjgPso');
                }
            }
        } catch(e) {
            console.warn('Error reading stored videos:', e);
        }
        return [];
    }

    function saveStoredVideosLocal(videos) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
        } catch(e) {
            console.warn('Error saving videos:', e);
        }
    }

    function getStoredVideos() {
        if (storedVideosCache !== null) {
            return storedVideosCache;
        }
        storedVideosCache = getStoredVideosLocal();
        return storedVideosCache;
    }

    async function syncVideosFromDB(callback) {
        if (isFetchingVideos) return;
        isFetchingVideos = true;
        try {
            const resp = await fetch('/showcase_videos');
            if (resp.ok) {
                const data = await resp.json();
                const dbVideos = (data.videos || []).map(v => ({
                    id: v.video_id || v.id,
                    db_id: v.id,
                    title: v.title || ''
                }));

                // PostgreSQL is the single source of truth:
                // Overwrite the local cache and localStorage so deleted videos are permanently cleared.
                storedVideosCache = dbVideos;
                saveStoredVideosLocal(dbVideos);
                if (typeof callback === 'function') {
                    callback(dbVideos);
                }
                return dbVideos;
            }
        } catch(e) {
            console.warn('Failed to load videos from DB, using local cache:', e);
        } finally {
            isFetchingVideos = false;
        }

        if (storedVideosCache === null) {
            storedVideosCache = getStoredVideosLocal();
        }
        if (typeof callback === 'function') {
            callback(storedVideosCache);
        }
        return storedVideosCache;
    }

    window.syncVideosFromDB = syncVideosFromDB;

    let galleryState = {
        currentIndex: 0,
        isPlaying: false,
        progress: 0,
        currentTime: 0,
        duration: 0
    };

    function renderHighlightsGallery(force = false) {
        const cardSet = document.getElementById('highlightsCardSet');
        const dotList = document.getElementById('highlightsDotList');
        if (!cardSet || !dotList) return;

        const videos = getStoredVideos();

        // Check if cards are already rendered with the exact same videos
        const existingCards = Array.from(cardSet.querySelectorAll('.gallery-item:not(.gallery-empty-card)'));
        const existingIds = existingCards.map(c => c.getAttribute('data-video-id'));
        const newIds = videos.map(v => v.id);

        const isSame = existingIds.length === newIds.length && existingIds.every((id, idx) => id === newIds[idx]);

        if (!force && isSame && existingCards.length > 0) {
            // Already rendered: retain iframe DOM instances so video time & playback don't reset!
            initHighlightsGallery();
            return;
        }

        cardSet.innerHTML = '';
        dotList.innerHTML = '';

        if (videos.length === 0) {
            cardSet.innerHTML = `
                <li class="card-container gallery-item current gallery-empty-card" style="display:flex;align-items:center;justify-content:center;text-align:center;min-height:440px;width:100%;margin:0 auto;">
                    <div style="padding: 48px; color: var(--app-nav-text);">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity: 0.6; margin-bottom: 16px;">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                            <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
                        </svg>
                        <h3 style="font-size: 24px; font-weight: 600; margin: 0 0 8px 0;">No Videos Added Yet</h3>
                        <p style="opacity: 0.7; margin: 0 0 24px 0; font-size: 15px;">Add YouTube videos using the button above to build your collection.</p>
                        <button onclick="openAddYouTubeModal()" style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:9999px;background:var(--aap-accent-color);color:#fff;border:none;font-weight:600;font-size:14px;cursor:pointer;box-shadow: 0 4px 14px rgba(0, 113, 227, 0.4);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                            Add YouTube Video
                        </button>
                    </div>
                </li>
            `;
            const aap = document.getElementById('aap-media-card-gallery');
            if (aap) aap.style.display = 'none';
            return;
        }

        const aap = document.getElementById('aap-media-card-gallery');
        if (aap) aap.style.display = '';

        videos.forEach((video, idx) => {
            const cardLi = document.createElement('li');
            cardLi.className = `card-container gallery-item ${idx === 0 ? 'current' : ''}`;
            cardLi.id = `highlights-gallery-item-${idx + 1}`;
            cardLi.setAttribute('data-video-id', video.id);
            cardLi.setAttribute('role', 'tabpanel');
            cardLi.innerHTML = `
                <div class="card tile tile-rounded">
                    <button class="gallery-card-remove-btn" onclick="removeVideoCard(${idx}, event)" title="Remove video" aria-label="Remove video">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    <div class="media-block media-container">
                        <iframe id="highlights-yt-iframe-${idx}" 
                                src="https://www.youtube-nocookie.com/embed/${video.id}?enablejsapi=1&autoplay=0&rel=0&controls=1&playsinline=1" 
                                title="${video.title || 'Video ' + (idx + 1)}" 
                                loading="${idx > 1 ? 'lazy' : 'eager'}"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowfullscreen></iframe>
                    </div>
                </div>
            `;
            cardSet.appendChild(cardLi);

            const dotLi = document.createElement('li');
            dotLi.role = 'presentation';
            dotLi.className = `dotnav-item ${idx === 0 ? 'current' : ''}`;
            dotLi.innerHTML = `
                <a class="dotnav-link" href="#highlights-gallery-item-${idx + 1}" data-index="${idx}">
                    <span class="dot-progress-fill"></span>
                    <span class="visuallyhidden">${video.title || 'Video ' + (idx + 1)}</span>
                </a>
            `;
            dotList.appendChild(dotLi);
        });

        galleryState.currentIndex = 0;
        galleryState.progress = 0;
        initHighlightsGallery();
    }

    window.renderHighlightsGallery = renderHighlightsGallery;

    window.removeVideoCard = async function(index, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const videos = getStoredVideos();
        if (index >= 0 && index < videos.length) {
            const targetVideo = videos[index];
            const targetId = targetVideo.id;
            const targetDbId = targetVideo.db_id;

            // Remove immediately from memory and local storage
            videos.splice(index, 1);
            storedVideosCache = videos;
            saveStoredVideosLocal(videos);
            renderHighlightsGallery(true);
            if (videos.length > 0) {
                const targetIdx = Math.max(0, Math.min(index, videos.length - 1));
                const cards = document.querySelectorAll('#highlights-gallery-scroll .gallery-item');
                if (cards[targetIdx]) {
                    cards[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            }

            // Permanently delete from PostgreSQL database
            try {
                const ident = targetDbId ? String(targetDbId) : targetId;
                const resp = await fetch('/showcase_videos/' + encodeURIComponent(ident), {
                    method: 'DELETE'
                });
                if (!resp.ok) {
                    console.warn('DELETE /showcase_videos returned status:', resp.status);
                }
            } catch(e) {
                console.warn('Error deleting video from DB:', e);
            }
        }
    };

    // =========================================================================
    // 3. Apple Highlights Edge-to-Edge Gallery Carousel Engine
    // =========================================================================
    function initHighlightsGallery() {
        const gallery = document.getElementById('highlights-gallery-scroll');
        if (!gallery) return;

        const cards = gallery.querySelectorAll('.gallery-item:not(.gallery-empty-card)');
        const dotItems = document.querySelectorAll('.dotnav-item');
        const playPauseBtn = document.getElementById('highlightsPlayPauseBtn');

        if (!cards.length) return;

        function updateActiveCard(index) {
            if (index < 0 || index >= cards.length) return;
            galleryState.currentIndex = index;

            dotItems.forEach((dot, idx) => {
                const isCurr = idx === index;
                dot.classList.toggle('current', isCurr);
                const fill = dot.querySelector('.dot-progress-fill');
                if (fill) {
                    fill.style.width = isCurr ? `${galleryState.progress}%` : '0%';
                }
            });

            cards.forEach((card, idx) => {
                card.classList.toggle('current', idx === index);
            });

            // Instruct active YouTube iframe to send info updates
            postToActiveIframe({ event: 'listening' });
        }

        function scrollToCard(index) {
            if (index < 0 || index >= cards.length) return;
            const targetCard = cards[index];
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
            galleryState.progress = 0;
            updateActiveCard(index);
        }

        window.centerActiveGalleryCard = function() {
            scrollToCard(galleryState.currentIndex || 0);
        };

        // Ensure active card is centered on initialization
        setTimeout(() => {
            scrollToCard(galleryState.currentIndex || 0);
        }, 60);

        function postToActiveIframe(cmdObj) {
            const activeCard = cards[galleryState.currentIndex];
            const iframe = activeCard?.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(JSON.stringify(cmdObj), '*');
            }
        }

        function seekActiveVideo(seconds) {
            postToActiveIframe({
                event: 'command',
                func: 'seekTo',
                args: [seconds, true]
            });
        }

        function goToPrevCard() {
            if (!cards.length) return;
            const nextIdx = (galleryState.currentIndex - 1 + cards.length) % cards.length;
            scrollToCard(nextIdx);
        }

        function goToNextCard() {
            if (!cards.length) return;
            const nextIdx = (galleryState.currentIndex + 1) % cards.length;
            scrollToCard(nextIdx);
        }

        window.galleryGoToPrev = goToPrevCard;
        window.galleryGoToNext = goToNextCard;

        // Paddle buttons (prev / next)
        const prevBtn = document.getElementById('galleryPaddlePrev');
        const nextBtn = document.getElementById('galleryPaddleNext');
        if (prevBtn) {
            prevBtn.title = 'Previous Video (Left Arrow)';
            prevBtn.onclick = goToPrevCard;
        }
        if (nextBtn) {
            nextBtn.title = 'Next Video (Right Arrow)';
            nextBtn.onclick = goToNextCard;
        }

        // Track horizontal scrolling to update active card with fluid real-time zoom animation
        let scrollRaf = null;
        gallery.onscroll = function() {
            if (scrollRaf) return;
            scrollRaf = requestAnimationFrame(() => {
                scrollRaf = null;
                const galleryRect = gallery.getBoundingClientRect();
                const galleryCenter = galleryRect.left + galleryRect.width / 2;

                let closestIdx = 0;
                let minDistance = Infinity;

                cards.forEach((card, idx) => {
                    const rect = card.getBoundingClientRect();
                    const cardCenter = rect.left + rect.width / 2;
                    const dist = Math.abs(galleryCenter - cardCenter);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestIdx = idx;
                    }
                });

                if (closestIdx !== galleryState.currentIndex) {
                    galleryState.progress = 0;
                    updateActiveCard(closestIdx);
                }
            });
        };

        // Interactive Scrubbing & Clicking on the Pill
        dotItems.forEach((dot, idx) => {
            const link = dot.querySelector('.dotnav-link');
            if (!link) return;

            let isPointerDown = false;

            function scrubFromPointer(e) {
                const rect = link.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                const pct = ratio * 100;
                galleryState.progress = pct;

                const fill = link.querySelector('.dot-progress-fill');
                if (fill) fill.style.width = `${pct}%`;

                if (galleryState.duration > 0) {
                    seekActiveVideo(galleryState.duration * ratio);
                } else {
                    seekActiveVideo(100 * ratio);
                }
            }

            link.onpointerdown = function(e) {
                e.preventDefault();
                if (idx !== galleryState.currentIndex) {
                    scrollToCard(idx);
                    return;
                }
                isPointerDown = true;
                try { link.setPointerCapture(e.pointerId); } catch(_) {}
                scrubFromPointer(e);
            };

            link.onpointermove = function(e) {
                if (isPointerDown && idx === galleryState.currentIndex) {
                    scrubFromPointer(e);
                }
            };

            link.onpointerup = function(e) {
                if (isPointerDown) {
                    isPointerDown = false;
                    try { link.releasePointerCapture(e.pointerId); } catch(_) {}
                }
            };

            link.onpointercancel = function() {
                isPointerDown = false;
            };

            link.onclick = function(e) {
                e.preventDefault();
            };
        });

        // Play / Pause Button Handler
        function togglePlayPause() {
            galleryState.isPlaying = !galleryState.isPlaying;
            const cmd = galleryState.isPlaying ? 'playVideo' : 'pauseVideo';
            postToActiveIframe({
                event: 'command',
                func: cmd,
                args: ''
            });
            if (playPauseBtn) {
                playPauseBtn.classList.toggle('is-playing', galleryState.isPlaying);
            }
        }

        if (playPauseBtn) {
            playPauseBtn.onclick = togglePlayPause;
        }

        // Initialize active state on active card
        updateActiveCard(galleryState.currentIndex || 0);
    }

    window.initHighlightsGallery = initHighlightsGallery;

    // Global listener for YouTube postMessage API updates
    window.addEventListener('message', function(e) {
        try {
            const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            if (!data) return;

            // Handle YouTube infoDelivery (currentTime, duration, playerState)
            if (data.event === 'infoDelivery' && data.info) {
                const info = data.info;
                if (typeof info.duration === 'number' && info.duration > 0) {
                    galleryState.duration = info.duration;
                }
                if (typeof info.currentTime === 'number') {
                    galleryState.currentTime = info.currentTime;
                    if (galleryState.duration > 0) {
                        const pct = Math.min(100, Math.max(0, (info.currentTime / galleryState.duration) * 100));
                        galleryState.progress = pct;
                        const activeDot = document.querySelectorAll('.dotnav-item')[galleryState.currentIndex];
                        const fill = activeDot?.querySelector('.dot-progress-fill');
                        if (fill) fill.style.width = `${pct}%`;
                    }
                }
                if (typeof info.playerState === 'number') {
                    const isPlaying = info.playerState === 1; // 1 = playing
                    galleryState.isPlaying = isPlaying;
                    const btn = document.getElementById('highlightsPlayPauseBtn');
                    if (btn) btn.classList.toggle('is-playing', isPlaying);
                }
            }
        } catch(_) {}
    });

    // =========================================================================
    // 4. Add YouTube Video Modal & Handler (PostgreSQL Persistence)
    // =========================================================================
    window.openAddYouTubeModal = async function() {
        const url = prompt("Enter YouTube Video URL (e.g. https://www.youtube.com/watch?v=... or youtu.be/...):");
        if (!url) return;

        let videoId = null;
        // Supports youtube.com/watch?v=..., youtu.be/..., embed/..., shorts/..., v/...
        const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/;
        const match = url.match(regExp);
        if (match && match[1]) {
            videoId = match[1];
        }

        if (!videoId) {
            alert("Invalid YouTube URL. Please provide a valid YouTube video link.");
            return;
        }

        const videos = getStoredVideos();
        if (!videos.some(v => v.id === videoId)) {
            videos.push({
                id: videoId,
                title: ""
            });
            storedVideosCache = videos;
            saveStoredVideosLocal(videos);
            renderHighlightsGallery(true);
        }

        // Persist to PostgreSQL Database
        try {
            const resp = await fetch('/showcase_videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video_id: videoId, title: "" })
            });
            if (resp.ok) {
                const data = await resp.json();
                const added = data.video;
                const matchVid = (storedVideosCache || []).find(v => v.id === videoId);
                if (matchVid && added) {
                    matchVid.db_id = added.id;
                }
            }
        } catch(e) {
            console.warn('Failed to persist video to DB:', e);
        }

        setTimeout(() => {
            const cards = document.querySelectorAll('#highlights-gallery-scroll .gallery-item');
            if (cards.length > 0) {
                cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', inline: 'center' });
            }
        }, 150);
    };

    // Auto-init on page load with background DB sync
    document.addEventListener('DOMContentLoaded', () => {
        syncNavActive(window.location.pathname);
        syncVideosFromDB(() => {
            if (window.location.pathname === '/videos') {
                renderHighlightsGallery();
            }
        });
        if (window.location.pathname === '/videos') {
            renderHighlightsGallery();
        }
    });

    // Global Physical Key Navigation (Left / Right Arrow Keys)
    window.addEventListener('keydown', (e) => {
        const videosView = document.getElementById('videosView');
        if (!videosView || videosView.hidden || !document.body.classList.contains('in-videos-mode')) {
            return;
        }

        // Do not intercept if user is typing in an input, textarea, or contenteditable
        const target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]'))) {
            return;
        }

        if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') {
            e.preventDefault();
            if (typeof window.galleryGoToPrev === 'function') {
                window.galleryGoToPrev();
            }
        } else if (e.key === 'ArrowRight' || e.code === 'ArrowRight') {
            e.preventDefault();
            if (typeof window.galleryGoToNext === 'function') {
                window.galleryGoToNext();
            }
        }
    });

})();
