/**
 * NotesLook / BeatNect: Music Architecture & Persistent Playback Engine
 * Provides Apple Music-grade layout, SPA routing without page reloads,
 * docked filter bar, batch actions, and persistent cross-view audio engine.
 */

(function () {
    'use strict';

    // Global Music Engine State
    window.NotesMusic = {
        tracks: [],
        currentTrack: null,
        isPlaying: false,
        isShuffle: false,
        repeatMode: 'none', // 'none', 'all', 'one'
        volume: 0.85,
        activeTab: 'recently-added',
        searchQuery: '',
        filterAlbum: null,
        filterArtist: null,
        sortBy: 'recent',
        selectedIds: new Set(),
        selectMode: false
    };

    const state = window.NotesMusic;
    let audio = null;

    // Helper: format seconds to M:SS
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Helper: format bytes
    function formatBytes(bytes) {
        if (!bytes || isNaN(bytes)) return '';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    }

    const DEFAULT_ARTWORK = '/static/images/music_thumb.jpg?v=3';

    // Helper: clean track title (stripping site tags, numbers, extensions)
    function getCleanTrackTitle(track) {
        if (!track) return 'Untitled Track';
        let raw = track.displayName || track.name || track.original_name || '';
        // Strip audio extensions
        raw = raw.replace(/\.[^.]+$/i, '');
        // Remove common source-site tags and web domains (sensongs, naasongs, isongs, pendujatt, com, se, co, etc.)
        raw = raw.replace(/(?:^|[\s._-]+)(?:sensongs(?:mp3)?(?:\.[a-z]{2,4})*|naasongs(?:mp3)?(?:\.[a-z]{2,4})*|isongs(?:info)?(?:\.[a-z]{2,4})*|pendujatt(?:\.[a-z]{2,4})*|sen_songs|com|se|co|in|org|net)(?=$|[\s._-]+)/gi, ' ');
        // Remove numeric prefixes (e.g., "01 - ", "01_-_", "1. ")
        raw = raw.replace(/^[\s._-]*\d+[\s._-]*/g, '');
        // Convert dots and underscores to spaces
        raw = raw.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();

        // Split by dash if present (e.g. "Artist - Title")
        if (raw.includes(' - ')) {
            const parts = raw.split(' - ');
            if (parts[1] && parts[1].trim()) {
                raw = parts[1].trim();
            }
        }
        return raw.trim() || track.name || track.original_name || 'Untitled Track';
    }

    // Helper: clean artist name
    function getCleanArtist(track) {
        if (!track) return 'Unknown Artist';
        let artist = track.artist || '';
        // If artist contains site tags, web urls or is generic
        if (!artist || artist === 'Unknown Artist' || /(?:sensongs|naasongs|isongs|pendujatt|www\.)/i.test(artist)) {
            return 'Unknown Artist';
        }
        return artist.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function normalizeMediaUrl(url) {
        if (!url) return '';
        if (url.includes('/static/uploads/files/')) {
            return '/static/uploads/files/' + url.split('/static/uploads/files/')[1];
        }
        if (url.includes('/static/uploads/artwork/')) {
            return '/static/uploads/artwork/' + url.split('/static/uploads/artwork/')[1].split('?')[0];
        }
        if (url.includes('/static/uploads/')) {
            return '/static/uploads/' + url.split('/static/uploads/')[1];
        }
        return url;
    }

    // Helper: safe artwork url
    function getArtworkUrl(track) {
        if (track && track.artwork_url && track.artwork_url !== 'None' && track.artwork_url !== 'null' && track.artwork_url.trim() !== '') {
            return normalizeMediaUrl(track.artwork_url);
        }
        return DEFAULT_ARTWORK;
    }

    // =========================================================================
    // SPA Routing & Navigation Engine
    // =========================================================================
    function navigateTo(path, push = true) {
        const normalized = path.split('?')[0];
        if (push && window.location.pathname !== normalized) {
            window.history.pushState({ path: normalized }, '', path);
        }

        const docView = document.getElementById('documentView');
        const musicView = document.getElementById('musicView');
        const videosView = document.getElementById('videosView');
        const bottomBar = document.querySelector('.app-bottom-bar');
        const localnavProductName = document.getElementById('localnavProductName');

        const localnavPrimaryActionText = document.getElementById('localnavPrimaryActionText');

        if (normalized === '/music') {
            document.body.classList.add('in-music-mode');
            document.body.classList.remove('in-videos-mode');
            if (docView) docView.hidden = true;
            if (videosView) videosView.hidden = true;
            if (bottomBar) bottomBar.style.display = 'none';
            if (musicView) {
                musicView.hidden = false;
                renderActiveView();
            }
            if (localnavProductName) localnavProductName.textContent = 'Music Library';
            if (localnavPrimaryActionText) localnavPrimaryActionText.textContent = 'Upload';
            document.title = 'NotesLook - Music Library';
        } else if (normalized === '/videos') {
            document.body.classList.add('in-videos-mode');
            document.body.classList.remove('in-music-mode');
            if (docView) docView.hidden = true;
            if (musicView) musicView.hidden = true;
            if (bottomBar) bottomBar.style.display = 'none';
            if (videosView) {
                videosView.hidden = false;
                const activateVideos = () => {
                    if (typeof window.renderHighlightsGallery === 'function') {
                        window.renderHighlightsGallery();
                    } else if (typeof window.initHighlightsGallery === 'function') {
                        window.initHighlightsGallery();
                    }
                    setTimeout(() => {
                        if (typeof window.centerActiveGalleryCard === 'function') {
                            window.centerActiveGalleryCard();
                        }
                    }, 60);
                };
                if (typeof window.syncVideosFromDB === 'function') {
                    window.syncVideosFromDB(activateVideos);
                } else {
                    activateVideos();
                }
            }
            if (localnavProductName) localnavProductName.textContent = 'Highlights & Videos';
            if (localnavPrimaryActionText) localnavPrimaryActionText.textContent = 'Add Video';
            document.title = 'NotesLook - Highlights & Videos';
        } else {
            document.body.classList.remove('in-music-mode');
            document.body.classList.remove('in-videos-mode');
            if (musicView) musicView.hidden = true;
            if (videosView) videosView.hidden = true;
            if (docView) docView.hidden = false;
            if (bottomBar) {
                bottomBar.style.display = '';
            }
            if (typeof window.renderTabs === 'function') {
                window.renderTabs();
            }
            document.title = 'NotesLook - Document Canvas';
        }

        // Clean up music view fullscreen if user navigates to another hub
        if (normalized !== '/music' && musicView && musicView.classList.contains('music-view-fullscreen')) {
            musicView.classList.remove('music-view-fullscreen');
            document.body.classList.remove('music-fullscreen-active');
            document.documentElement.classList.remove('music-fullscreen-active');
            const fsBtn = document.getElementById('musicViewFullscreenBtn');
            const fsLabel = document.getElementById('musicViewFullscreenLabel');
            if (fsBtn) fsBtn.classList.remove('active');
            if (fsLabel) fsLabel.textContent = 'Full Screen';
        }

        updateMiniPlayer();
        syncSidebarNav();
        if (typeof window.syncGlobalNavActive === 'function') {
            window.syncGlobalNavActive(normalized);
        }
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    window.navigateTo = navigateTo;

    // Listen for browser back / forward navigation
    window.addEventListener('popstate', () => {
        navigateTo(window.location.pathname, false);
    });

    // =========================================================================
    // Audio Engine & Persistent Audio Context
    // =========================================================================
    function initAudioEngine() {
        audio = document.getElementById('globalAudioPlayer');
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = 'globalAudioPlayer';
            audio.preload = 'none';
            document.body.appendChild(audio);
        }

        audio.volume = state.volume;

        audio.addEventListener('play', () => {
            state.isPlaying = true;
            updatePlayerBarUI();
            updateMiniPlayer();
            updateTrackRowActiveStates();
        });

        audio.addEventListener('pause', () => {
            state.isPlaying = false;
            updatePlayerBarUI();
            updateMiniPlayer();
            updateTrackRowActiveStates();
        });

        audio.addEventListener('timeupdate', () => {
            const curTimeEl = document.getElementById('gpbCurrentTime');
            const fillEl = document.getElementById('gpbProgressFill');
            if (curTimeEl && audio.duration) {
                curTimeEl.textContent = formatTime(audio.currentTime);
                const pct = (audio.currentTime / audio.duration) * 100;
                if (fillEl) fillEl.style.width = `${pct}%`;
            }
        });

        audio.addEventListener('loadedmetadata', () => {
            const totalTimeEl = document.getElementById('gpbTotalTime');
            if (totalTimeEl) {
                totalTimeEl.textContent = formatTime(audio.duration);
            }
        });

        audio.addEventListener('ended', () => {
            if (state.repeatMode === 'one') {
                audio.currentTime = 0;
                audio.play();
            } else {
                playNext();
            }
        });

        // Set up progress seek click
        const progWrap = document.getElementById('gpbProgressBarWrap');
        if (progWrap) {
            progWrap.addEventListener('click', (e) => {
                if (!audio.duration) return;
                const rect = progWrap.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const pct = Math.max(0, Math.min(1, clickX / rect.width));
                audio.currentTime = pct * audio.duration;
            });
        }

        // Set up volume seek click
        const volWrap = document.getElementById('gpbVolSliderWrap');
        if (volWrap) {
            volWrap.addEventListener('click', (e) => {
                const rect = volWrap.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const pct = Math.max(0, Math.min(1, clickX / rect.width));
                state.volume = pct;
                audio.volume = pct;
                const fill = document.getElementById('gpbVolFill');
                if (fill) fill.style.width = `${pct * 100}%`;
            });
        }
    }

    function playTrack(track) {
        if (!track) return;
        const safeUrl = normalizeMediaUrl(track.url);
        if (!safeUrl) return;
        track.url = safeUrl;
        if (track.artwork_url) {
            track.artwork_url = normalizeMediaUrl(track.artwork_url);
        }
        state.currentTrack = track;
        audio.src = safeUrl;
        audio.play().catch(e => console.log('Playback error:', e));

        updatePlayerBarUI();
        updateMiniPlayer();
        updateTrackRowActiveStates();

        if (window.musicState) {
            // When an album or artist filter is active, scope the GMP queue to only
            // those tracks so that Next/Prev navigate within the current context
            // (album view or artist view) rather than the entire library.
            const contextTracks = (state.filterAlbum || state.filterArtist)
                ? getFilteredTracks()
                : state.tracks;
            window.musicState.tracks = contextTracks.map(t => ({
                ...t,
                url: normalizeMediaUrl(t.url),
                artwork_url: normalizeMediaUrl(t.artwork_url),
                displayName: getCleanTrackTitle(t),
                cleanArtist: getCleanArtist(t)
            }));
            window.musicState.currentId = track.id;
        }
        if (typeof window.updateGlobalPlayerUI === 'function') {
            window.updateGlobalPlayerUI();
        }
    }

    function togglePlayPause() {
        if (!state.currentTrack) {
            if (state.tracks.length > 0) {
                playTrack(state.tracks[0]);
            }
            return;
        }

        const safeUrl = normalizeMediaUrl(state.currentTrack.url);
        if (!audio.src || audio.src === window.location.href || !audio.src.includes(safeUrl)) {
            playTrack(state.currentTrack);
            return;
        }

        if (audio.paused) {
            audio.play().catch(e => {
                console.log('Playback error, reloading track:', e);
                playTrack(state.currentTrack);
            });
        } else {
            audio.pause();
        }
        if (typeof window.updateGlobalPlayerUI === 'function') {
            window.updateGlobalPlayerUI();
        }
    }

    function playNext() {
        const pool = (state.filterAlbum || state.filterArtist) ? getFilteredTracks() : state.tracks;
        if (pool.length === 0) return;
        if (state.isShuffle) {
            const nextIdx = Math.floor(Math.random() * pool.length);
            playTrack(pool[nextIdx]);
            return;
        }

        const idx = pool.findIndex(t => t.id === state.currentTrack?.id);
        const nextIdx = (idx >= 0 && idx + 1 < pool.length) ? idx + 1 : 0;
        playTrack(pool[nextIdx]);
    }

    function playPrev() {
        const pool = (state.filterAlbum || state.filterArtist) ? getFilteredTracks() : state.tracks;
        if (pool.length === 0) return;
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        const idx = pool.findIndex(t => t.id === state.currentTrack?.id);
        const prevIdx = (idx > 0) ? idx - 1 : pool.length - 1;
        playTrack(pool[prevIdx]);
    }

    function toggleShuffle() {
        state.isShuffle = !state.isShuffle;
        const btn = document.getElementById('gpbShuffleBtn');
        if (btn) btn.classList.toggle('active', state.isShuffle);
    }

    function toggleRepeat() {
        if (state.repeatMode === 'none') state.repeatMode = 'all';
        else if (state.repeatMode === 'all') state.repeatMode = 'one';
        else state.repeatMode = 'none';

        const btn = document.getElementById('gpbRepeatBtn');
        if (btn) {
            btn.classList.toggle('active', state.repeatMode !== 'none');
            btn.title = `Repeat: ${state.repeatMode}`;
        }
    }

    // =========================================================================
    // UI Updates
    // =========================================================================
    function updatePlayerBarUI() {
        const titleEl = document.getElementById('gpbTrackTitle');
        const artistEl = document.getElementById('gpbTrackArtist');
        const artImg = document.getElementById('gpbCoverImg');
        const playBtn = document.getElementById('gpbPlayBtn');

        if (artImg) {
            artImg.onerror = function () {
                if (this.src !== DEFAULT_ARTWORK) {
                    this.src = DEFAULT_ARTWORK;
                }
            };
            artImg.style.display = 'block';
        }

        if (state.currentTrack) {
            if (titleEl) titleEl.textContent = getCleanTrackTitle(state.currentTrack);
            if (artistEl) artistEl.textContent = getCleanArtist(state.currentTrack);
            if (artImg) {
                artImg.src = getArtworkUrl(state.currentTrack);
            }
        } else {
            if (titleEl) titleEl.textContent = 'No Track Selected';
            if (artistEl) artistEl.textContent = 'Select a song to play';
            if (artImg) {
                artImg.src = DEFAULT_ARTWORK;
            }
        }

        if (playBtn) {
            playBtn.innerHTML = state.isPlaying
                ? '<i data-lucide="pause"></i>'
                : '<i data-lucide="play"></i>';
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        }
    }

    function updateMiniPlayer() {
        const btn = document.getElementById('openMusicHubBtn');
        if (btn) {
            if (state.currentTrack && state.isPlaying) {
                btn.classList.add('is-playing');
                btn.title = `Music: ${state.currentTrack.name} (${getCleanArtist(state.currentTrack)})`;
            } else if (state.currentTrack) {
                btn.classList.remove('is-playing');
                btn.title = `Music (Paused): ${state.currentTrack.name}`;
            } else {
                btn.classList.remove('is-playing');
                btn.title = 'Music Library';
            }
        }

        const chip = document.getElementById('docMusicChip');
        if (chip) chip.style.display = 'none';

        const playerBar = document.getElementById('musicGlobalPlayerBar');
        if (playerBar) {
            const isMusicMode = document.body.classList.contains('in-music-mode');
            playerBar.style.display = isMusicMode ? 'grid' : 'none';
        }
    }

    function updateTrackRowActiveStates() {
        const rows = document.querySelectorAll('.music-track-row');
        rows.forEach(row => {
            const trackId = row.getAttribute('data-track-id');
            const isActive = state.currentTrack && state.currentTrack.id === trackId;
            row.classList.toggle('is-active-track', isActive);
        });

        const cards = document.querySelectorAll('.music-recent-card');
        cards.forEach(card => {
            const trackId = card.getAttribute('data-track-id');
            const isActive = state.currentTrack && state.currentTrack.id === trackId;
            card.classList.toggle('is-playing', isActive && state.isPlaying);
        });

        const albumCards = document.querySelectorAll('.music-grid-card[data-album]');
        albumCards.forEach(card => {
            const albumName = card.getAttribute('data-album');
            const isPlayingThisAlbum = state.currentTrack && (state.currentTrack.album || 'Single / Unknown Album') === albumName && state.isPlaying;
            card.classList.toggle('is-playing-album', isPlayingThisAlbum);
            const playBtn = card.querySelector('.album-hover-play-btn');
            if (playBtn) {
                playBtn.innerHTML = isPlayingThisAlbum
                    ? `<svg class="album-pause-icon" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`
                    : `<svg class="album-play-icon" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>`;
            }
        });
    }

    function syncSidebarNav() {
        const navItems = document.querySelectorAll('.music-nav-item');
        navItems.forEach(item => {
            const tab = item.getAttribute('data-tab');
            item.classList.toggle('active', tab === state.activeTab);
        });
        const mobileBtns = document.querySelectorAll('.mobile-nav-btn');
        mobileBtns.forEach(btn => {
            const tab = btn.getAttribute('data-tab');
            btn.classList.toggle('active', tab === state.activeTab);
        });
    }

    // =========================================================================
    // Data Loading & Filtering
    // =========================================================================
    async function fetchTracks() {
        try {
            const res = await fetch('/music_tracks?scope=all');
            if (!res.ok) throw new Error('Failed to fetch tracks');
            const data = await res.json();
            if (Array.isArray(data)) {
                state.tracks = data.map(t => ({
                    ...t,
                    url: normalizeMediaUrl(t.url),
                    artwork_url: normalizeMediaUrl(t.artwork_url),
                    displayName: getCleanTrackTitle(t),
                    cleanArtist: getCleanArtist(t)
                }));
                if (window.musicState) {
                    window.musicState.tracks = state.tracks;
                    if (!window.musicState.currentId && state.tracks.length > 0) {
                        state.currentTrack = state.tracks[0];
                        window.musicState.currentId = state.tracks[0].id;
                        if (audio && !audio.src) {
                            audio.src = normalizeMediaUrl(state.tracks[0].url);
                        }
                        updatePlayerBarUI();
                        updateMiniPlayer();
                        if (typeof window.updateGlobalPlayerUI === 'function') {
                            window.updateGlobalPlayerUI();
                        }
                    }
                } else if (!state.currentTrack && state.tracks.length > 0) {
                    state.currentTrack = state.tracks[0];
                    if (audio && !audio.src) {
                        audio.src = normalizeMediaUrl(state.tracks[0].url);
                    }
                    updatePlayerBarUI();
                    updateMiniPlayer();
                }
                renderActiveView();
            }
        } catch (err) {
            console.error('Error loading tracks:', err);
        }
    }

    function getFilteredTracks() {
        let list = [...state.tracks];

        // Specific album filter (when opened from Albums view)
        if (state.activeTab === 'songs' && state.filterAlbum) {
            list = list.filter(t => (t.album || 'Single / Unknown Album') === state.filterAlbum);
        }

        // Specific artist filter (when opened from Artists view)
        if (state.activeTab === 'songs' && state.filterArtist) {
            list = list.filter(t => getCleanArtist(t) === state.filterArtist);
        }

        if (state.searchQuery) {
            const q = state.searchQuery.toLowerCase();
            list = list.filter(t =>
                (getCleanTrackTitle(t)).toLowerCase().includes(q) ||
                (getCleanArtist(t)).toLowerCase().includes(q) ||
                (t.album || '').toLowerCase().includes(q)
            );
        }

        if (state.sortBy === 'title') {
            list.sort((a, b) => getCleanTrackTitle(a).localeCompare(getCleanTrackTitle(b)));
        } else if (state.sortBy === 'artist') {
            list.sort((a, b) => getCleanArtist(a).localeCompare(getCleanArtist(b)));
        } else if (state.sortBy === 'album') {
            list.sort((a, b) => (a.album || '').localeCompare(b.album || ''));
        } else {
            // 'recent'
            list.sort((a, b) => new Date(b.created_at || b.uploaded_at || 0) - new Date(a.created_at || a.uploaded_at || 0));
        }

        return list;
    }

    // =========================================================================
    // Views Renderers
    // =========================================================================
    function renderActiveView() {
        const titleEl = document.getElementById('musicViewTitle');
        const contentEl = document.getElementById('musicViewDynamicContent');
        const countBadge = document.getElementById('musicTrackCountBadge');
        if (!contentEl) return;

        const filtered = getFilteredTracks();
        if (countBadge) {
            countBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'Track' : 'Tracks'}`;
        }

        if (state.activeTab === 'recently-added') {
            if (titleEl) titleEl.textContent = 'Recently Added';
            renderRecentlyAddedView(contentEl, filtered);
        } else if (state.activeTab === 'songs') {
            if (titleEl) {
                if (state.filterAlbum) {
                    titleEl.textContent = state.filterAlbum;
                } else if (state.filterArtist) {
                    titleEl.textContent = state.filterArtist;
                } else {
                    titleEl.textContent = 'Songs';
                }
            }
            renderSongsView(contentEl, filtered);
        } else if (state.activeTab === 'artists') {
            if (titleEl) titleEl.textContent = 'Artists';
            renderArtistsView(contentEl, filtered);
        } else if (state.activeTab === 'albums') {
            if (titleEl) titleEl.textContent = 'Albums';
            renderAlbumsView(contentEl, filtered);
        }

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // View: Recently Added
    function renderRecentlyAddedView(container, tracks) {
        const recentSubset = [...tracks].slice(0, 12);

        let cardsHtml = recentSubset.map(track => {
            const isPlaying = state.currentTrack && state.currentTrack.id === track.id && state.isPlaying;
            return `
                <div class="music-recent-card ${isPlaying ? 'is-playing' : ''}" data-track-id="${track.id}">
                    <div class="music-card-art-box">
                        <img src="${getArtworkUrl(track)}" alt="" loading="lazy" onerror="if(this.src!=='${DEFAULT_ARTWORK}'){this.src='${DEFAULT_ARTWORK}';}">
                        <div class="music-card-play-overlay">
                            <button class="music-overlay-play-btn" title="Play">
                                <i data-lucide="${isPlaying ? 'pause' : 'play'}"></i>
                            </button>
                        </div>
                    </div>
                    <div class="music-card-info">
                        <div class="music-card-title" title="${escapeHtml(getCleanTrackTitle(track))}">${escapeHtml(getCleanTrackTitle(track))}</div>
                        <div class="music-card-artist" title="${escapeHtml(getCleanArtist(track))}">${escapeHtml(getCleanArtist(track))}</div>
                    </div>
                </div>
            `;
        }).join('');

        let html = `
            <div class="music-recently-added-section">
                <div class="music-section-title">
                    <span>Recent Highlights</span>
                    <span style="font-size:0.82rem;font-weight:500;color:var(--music-text-muted);">${recentSubset.length} Added</span>
                </div>
                <div class="music-carousel-track">
                    ${cardsHtml || '<div style="color:var(--music-text-muted);padding:20px;">No music tracks uploaded yet. Click Upload to add your first song!</div>'}
                </div>
            </div>
            <div class="music-section-title">Albums</div>
        `;

        container.innerHTML = html;
        // Append album view grid below the highlights carousel
        const albumGridContainer = document.createElement('div');
        container.appendChild(albumGridContainer);
        renderAlbumsView(albumGridContainer, tracks);

        // Attach card click handlers
        container.querySelectorAll('.music-recent-card').forEach(card => {
            const trackId = card.getAttribute('data-track-id');
            const track = state.tracks.find(t => t.id === trackId);
            card.addEventListener('click', () => {
                if (state.currentTrack && state.currentTrack.id === trackId && state.isPlaying) {
                    togglePlayPause();
                } else {
                    playTrack(track);
                }
            });
        });
    }

    // View: Songs
    function renderSongsView(container, tracks) {
        container.innerHTML = '';

        if (state.filterAlbum) {
            const banner = document.createElement('div');
            banner.className = 'music-filter-breadcrumb';
            banner.innerHTML = `
                <div class="breadcrumb-info">
                    <span class="breadcrumb-tag">Album</span>
                    <span class="breadcrumb-name">${escapeHtml(state.filterAlbum)}</span>
                </div>
                <button class="breadcrumb-clear-btn" id="musicClearFilterBtn" type="button">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    <span>All Songs</span>
                </button>
            `;
            container.appendChild(banner);
            banner.querySelector('#musicClearFilterBtn').addEventListener('click', () => {
                state.filterAlbum = null;
                renderActiveView();
            });
        } else if (state.filterArtist) {
            const banner = document.createElement('div');
            banner.className = 'music-filter-breadcrumb';
            banner.innerHTML = `
                <div class="breadcrumb-info">
                    <span class="breadcrumb-tag">Artist</span>
                    <span class="breadcrumb-name">${escapeHtml(state.filterArtist)}</span>
                </div>
                <button class="breadcrumb-clear-btn" id="musicClearFilterBtn" type="button">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    <span>All Songs</span>
                </button>
            `;
            container.appendChild(banner);
            banner.querySelector('#musicClearFilterBtn').addEventListener('click', () => {
                state.filterArtist = null;
                renderActiveView();
            });
        }

        renderSongsTable(container, tracks);
    }

    function renderSongsTable(container, tracks) {
        if (tracks.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:48px 20px;color:var(--music-text-muted);">
                    <i data-lucide="music" style="width:40px;height:40px;margin-bottom:12px;opacity:0.4;"></i>
                    <div style="font-size:1.05rem;font-weight:600;color:var(--music-text-primary);">No tracks found</div>
                    <div style="font-size:0.86rem;margin-top:4px;">Upload music files to expand your library.</div>
                </div>
            `;
            return;
        }

        let rowsHtml = tracks.map((track, idx) => {
            const isPlaying = state.currentTrack && state.currentTrack.id === track.id;
            const isSelected = state.selectedIds.has(track.id);
            return `
                <tr class="music-track-row ${isPlaying ? 'is-active-track' : ''}" data-track-id="${track.id}">
                    <td class="col-num">
                        ${state.selectMode ? `
                            <input type="checkbox" class="music-select-box" data-track-id="${track.id}" ${isSelected ? 'checked' : ''}>
                        ` : `
                            <span class="track-row-index">${idx + 1}</span>
                        `}
                    </td>
                    <td class="col-art">
                        <div class="table-art-thumbnail">
                            <img src="${getArtworkUrl(track)}" alt="" loading="lazy" onerror="if(this.src!=='${DEFAULT_ARTWORK}'){this.src='${DEFAULT_ARTWORK}';}">
                        </div>
                    </td>
                    <td class="col-title">
                        <div class="col-title-primary" title="${escapeHtml(getCleanTrackTitle(track))}">${escapeHtml(getCleanTrackTitle(track))}</div>
                        <div class="col-title-sub" title="${escapeHtml(getCleanArtist(track))}">${escapeHtml(getCleanArtist(track))}</div>
                    </td>
                    <td class="col-album" title="${escapeHtml(track.album || '')}">
                        <div class="table-album-marquee-wrap">
                            <span class="table-album-text">${escapeHtml(track.album || 'Single')}</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'music-table-container';
        tableWrapper.innerHTML = `
            <table class="music-track-table">
                <colgroup>
                    <col class="col-num-width">
                    <col class="col-art-width">
                    <col class="col-title-width">
                    <col class="col-album-width">
                </colgroup>
                <thead>
                    <tr>
                        <th class="col-num">${state.selectMode ? 'Select' : '#'}</th>
                        <th class="col-art"></th>
                        <th class="col-title">Title</th>
                        <th class="col-album">Album</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;

        container.appendChild(tableWrapper);

        // Track Row Handlers
        tableWrapper.querySelectorAll('.music-track-row').forEach(row => {
            const trackId = row.getAttribute('data-track-id');
            const track = state.tracks.find(t => t.id === trackId);

            // Album marquee inside smooth horizontal scroll on hover or mouse wheel
            const albumWrap = row.querySelector('.table-album-marquee-wrap');
            const albumText = row.querySelector('.table-album-text');
            if (albumWrap && albumText) {
                let marqueeTimeout = null;
                row.addEventListener('mouseenter', () => {
                    const diff = albumText.scrollWidth - albumWrap.clientWidth;
                    if (diff > 4) {
                        const duration = Math.max(2, diff / 25);
                        albumText.style.transition = `transform ${duration}s linear 0.3s`;
                        albumText.style.transform = `translateX(-${diff + 6}px)`;
                        marqueeTimeout = setTimeout(() => {
                            if (row.matches(':hover')) {
                                albumText.style.transition = 'transform 0.4s ease-out';
                                albumText.style.transform = 'translateX(0)';
                            }
                        }, (duration + 1.2) * 1000);
                    }
                });

                row.addEventListener('mouseleave', () => {
                    if (marqueeTimeout) clearTimeout(marqueeTimeout);
                    albumText.style.transition = 'transform 0.3s ease-out';
                    albumText.style.transform = 'translateX(0)';
                });

                albumWrap.addEventListener('wheel', (e) => {
                    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) && albumWrap.scrollWidth > albumWrap.clientWidth) {
                        albumWrap.scrollLeft += e.deltaY;
                        e.stopPropagation();
                    }
                }, { passive: true });
            }

            row.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('input')) return;
                if (state.selectMode) {
                    toggleSelectTrack(trackId);
                    return;
                }
                if (state.currentTrack && state.currentTrack.id === trackId && state.isPlaying) {
                    togglePlayPause();
                } else {
                    playTrack(track);
                }
            });

            // Action: Download
            const dlBtn = row.querySelector('.row-download-btn');
            if (dlBtn) {
                dlBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (track && track.download_url) {
                        window.location.href = track.download_url;
                    }
                });
            }

            // Action: Delete
            const delBtn = row.querySelector('.row-delete-btn');
            if (delBtn) {
                delBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${track.name}" from library?`)) {
                        await deleteTrack(trackId);
                    }
                });
            }

            // Select checkbox
            const chk = row.querySelector('.music-select-box');
            if (chk) {
                chk.addEventListener('change', (e) => {
                    e.stopPropagation();
                    toggleSelectTrack(trackId, chk.checked);
                });
            }
        });
    }

    // View: Artists
    function renderArtistsView(container, tracks) {
        const artistMap = {};
        tracks.forEach(t => {
            const art = getCleanArtist(t);
            if (!artistMap[art]) artistMap[art] = [];
            artistMap[art].push(t);
        });

        let artists = Object.keys(artistMap);
        if (state.sortBy === 'artist' || state.sortBy === 'title') {
            artists.sort((a, b) => a.localeCompare(b));
        } else {
            // 'recent'
            artists.sort((a, b) => {
                const getLatestTime = (arr) => {
                    let maxTime = 0;
                    for (const t of arr) {
                        const d = new Date(t.created_at || t.uploaded_at || 0).getTime();
                        if (!isNaN(d) && d > maxTime) maxTime = d;
                    }
                    return maxTime;
                };
                return getLatestTime(artistMap[b]) - getLatestTime(artistMap[a]);
            });
        }
        if (artists.length === 0) {
            container.innerHTML = '<div style="color:var(--music-text-muted);padding:40px;text-align:center;">No artists found.</div>';
            return;
        }

        let html = '<div class="music-grid-view">';
        artists.forEach(artist => {
            const artistTracks = artistMap[artist];
            const sampleArt = getArtworkUrl(artistTracks[0]);
            html += `
                <div class="music-grid-card is-artist" data-artist="${escapeHtml(artist)}">
                    <div class="music-grid-card-art">
                        <img src="${sampleArt}" alt="" loading="lazy" onerror="if(this.src!=='${DEFAULT_ARTWORK}'){this.src='${DEFAULT_ARTWORK}';}">
                    </div>
                    <div class="music-grid-card-name" title="${escapeHtml(artist)}">${escapeHtml(artist)}</div>
                    <div class="music-grid-card-meta">${artistTracks.length} ${artistTracks.length === 1 ? 'Song' : 'Songs'}</div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;

        container.querySelectorAll('.music-grid-card').forEach(card => {
            card.addEventListener('click', () => {
                const artistName = card.getAttribute('data-artist');
                state.filterArtist = artistName;
                state.filterAlbum = null;
                state.searchQuery = '';
                const searchInput = document.getElementById('musicSearchInput');
                if (searchInput) searchInput.value = '';
                state.activeTab = 'songs';
                syncSidebarNav();
                renderActiveView();
            });
        });
    }

    // View: Albums
    function renderAlbumsView(container, tracks) {
        const albumMap = {};
        tracks.forEach(t => {
            const alb = t.album || 'Single / Unknown Album';
            if (!albumMap[alb]) albumMap[alb] = [];
            albumMap[alb].push(t);
        });

        let albums = Object.keys(albumMap);
        if (state.sortBy === 'title' || state.sortBy === 'album') {
            albums.sort((a, b) => a.localeCompare(b));
        } else if (state.sortBy === 'artist') {
            albums.sort((a, b) => {
                const artistA = (albumMap[a][0]?.artist || '').toLowerCase();
                const artistB = (albumMap[b][0]?.artist || '').toLowerCase();
                return artistA.localeCompare(artistB);
            });
        } else {
            // 'recent' (Default for Recently Added view and Recent sort):
            // Order albums by the timestamp of their most recently added track!
            albums.sort((a, b) => {
                const getLatestTime = (arr) => {
                    let maxTime = 0;
                    for (const t of arr) {
                        const d = new Date(t.created_at || t.uploaded_at || 0).getTime();
                        if (!isNaN(d) && d > maxTime) maxTime = d;
                    }
                    return maxTime;
                };
                return getLatestTime(albumMap[b]) - getLatestTime(albumMap[a]);
            });
        }
        if (albums.length === 0) {
            container.innerHTML = '<div style="color:var(--music-text-muted);padding:40px;text-align:center;">No albums found.</div>';
            return;
        }

        let html = '<div class="music-grid-view">';
        albums.forEach(album => {
            const albumTracks = albumMap[album];
            const sampleArt = getArtworkUrl(albumTracks[0]);
            const artist = albumTracks[0].artist || 'Various Artists';
            const isPlayingThisAlbum = state.currentTrack && (state.currentTrack.album || 'Single / Unknown Album') === album && state.isPlaying;
            html += `
                <div class="music-grid-card ${isPlayingThisAlbum ? 'is-playing-album' : ''}" data-album="${escapeHtml(album)}">
                    <div class="music-grid-card-art">
                        <img src="${sampleArt}" alt="" loading="lazy" onerror="if(this.src!=='${DEFAULT_ARTWORK}'){this.src='${DEFAULT_ARTWORK}';}">
                        <button class="album-hover-play-btn" data-album="${escapeHtml(album)}" aria-label="Play ${escapeHtml(album)}" title="Play ${escapeHtml(album)}" type="button">
                            ${isPlayingThisAlbum
                                ? `<svg class="album-pause-icon" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`
                                : `<svg class="album-play-icon" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>`}
                        </button>
                    </div>
                    <div class="music-grid-card-name" title="${escapeHtml(album)}">${escapeHtml(album)}</div>
                    <div class="music-grid-card-meta">${escapeHtml(artist)} • ${albumTracks.length} Songs</div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;

        container.querySelectorAll('.music-grid-card').forEach(card => {
            const albumName = card.getAttribute('data-album');
            const albumTracks = albumMap[albumName] || [];

            // Play button on hover & mobile tap: starts playing album from track 1 immediately
            const playBtn = card.querySelector('.album-hover-play-btn');
            if (playBtn) {
                const handleAlbumPlay = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (state.currentTrack && (state.currentTrack.album || 'Single / Unknown Album') === albumName && state.isPlaying) {
                        togglePlayPause();
                    } else if (albumTracks.length > 0) {
                        playTrack(albumTracks[0]);
                    }
                };
                playBtn.addEventListener('click', handleAlbumPlay);
                playBtn.addEventListener('touchend', handleAlbumPlay, { passive: false });
            }

            // Clicking album card opens album view without polluting global search bar
            card.addEventListener('click', (e) => {
                if (e.target.closest('.album-hover-play-btn')) return;
                state.filterAlbum = albumName;
                state.filterArtist = null;
                state.searchQuery = '';
                const searchInput = document.getElementById('musicSearchInput');
                if (searchInput) searchInput.value = '';
                state.activeTab = 'songs';
                syncSidebarNav();
                renderActiveView();
            });
        });
    }

    // =========================================================================
    // Batch Actions & Overflow Menu Handlers
    // =========================================================================
    function toggleSelectTrack(trackId, force) {
        if (force === true) {
            state.selectedIds.add(trackId);
        } else if (force === false) {
            state.selectedIds.delete(trackId);
        } else {
            if (state.selectedIds.has(trackId)) state.selectedIds.delete(trackId);
            else state.selectedIds.add(trackId);
        }
        renderActiveView();
    }

    async function deleteTrack(trackId) {
        try {
            const res = await fetch(`/music_tracks/${trackId}`, { method: 'DELETE' });
            if (res.ok) {
                state.tracks = state.tracks.filter(t => t.id !== trackId);
                state.selectedIds.delete(trackId);
                if (state.currentTrack?.id === trackId) {
                    state.currentTrack = null;
                    audio.pause();
                    audio.src = '';
                }
                renderActiveView();
                updatePlayerBarUI();
                updateMiniPlayer();
            }
        } catch (e) {
            console.error('Delete error:', e);
        }
    }

    async function handleBatchDownload() {
        const ids = state.selectedIds.size > 0 ? Array.from(state.selectedIds) : state.tracks.map(t => t.id);
        if (ids.length === 0) return alert('No tracks available to download.');

        try {
            const res = await fetch('/download_music', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_ids: ids })
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'music_library.zip';
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                alert('Download failed.');
            }
        } catch (err) {
            console.error('Batch download error:', err);
        }
    }

    async function handleBatchDelete() {
        const ids = Array.from(state.selectedIds);
        if (ids.length === 0) return alert('Please select tracks to delete.');
        if (!confirm(`Are you sure you want to delete ${ids.length} selected tracks?`)) return;

        for (const id of ids) {
            await fetch(`/music_tracks/${id}`, { method: 'DELETE' });
        }
        state.tracks = state.tracks.filter(t => !state.selectedIds.has(t.id));
        state.selectedIds.clear();
        state.selectMode = false;
        renderActiveView();
        updatePlayerBarUI();
        updateMiniPlayer();
    }

    // =========================================================================
    // File Upload Handler with Real-time Progress Modal
    // =========================================================================
    async function handleMusicUpload(e) {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const modal = document.getElementById('musicUploadModal');
        const modalTitle = document.getElementById('musicUploadTitle');
        const modalFill = document.getElementById('musicUploadFill');
        const modalMeta = document.getElementById('musicUploadMeta');
        const closeBtn = document.getElementById('musicUploadCloseBtn');

        let hiddenByUser = false;
        if (closeBtn) {
            closeBtn.onclick = () => {
                hiddenByUser = true;
                if (modal) modal.classList.remove('show');
            };
        }

        const totalFiles = files.length;
        let completedFiles = 0;
        const totalBytes = files.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
        let completedBytes = 0;
        const inFlight = {};

        function updateModalUI() {
            if (!modalFill || !modalMeta || !modalTitle) return;
            const inFlightBytes = Object.values(inFlight).reduce((sum, n) => sum + (Number(n) || 0), 0);
            const loaded = completedBytes + inFlightBytes;
            const pct = Math.max(0, Math.min(100, Math.round((loaded / Math.max(1, totalBytes)) * 100)));
            modalFill.style.width = `${pct}%`;
            modalTitle.textContent = completedFiles === totalFiles ? "Upload complete" : `Uploading music (${completedFiles + 1}/${totalFiles})`;
            modalMeta.textContent = `${completedFiles}/${totalFiles} files • ${formatBytes(loaded)} / ${formatBytes(totalBytes)} • ${pct}%`;
        }

        if (modal && !hiddenByUser) {
            modal.classList.add('show');
            updateModalUI();
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileKey = `${i}:${file.name}`;
            inFlight[fileKey] = 0;
            updateModalUI();

            await new Promise(resolve => {
                const xhr = new XMLHttpRequest();
                xhr.open("POST", "/upload_file?doc=global", true);
                xhr.upload.onprogress = function(evt) {
                    if (evt.lengthComputable) {
                        inFlight[fileKey] = evt.loaded;
                        updateModalUI();
                    }
                };
                xhr.onload = function() {
                    delete inFlight[fileKey];
                    completedFiles++;
                    completedBytes += file.size;
                    updateModalUI();

                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const payload = JSON.parse(xhr.responseText);
                            const nowIso = new Date().toISOString();
                            const newTrack = {
                                id: payload.id,
                                name: payload.name,
                                url: normalizeMediaUrl(payload.url),
                                download_url: payload.download_url,
                                size: payload.size,
                                mime: payload.mime,
                                artwork_url: normalizeMediaUrl(payload.artwork_url),
                                artist: payload.artist || "Unknown Artist",
                                album: payload.album || "Single / Unknown Album",
                                uploaded_at: payload.uploaded_at || nowIso,
                                created_at: payload.created_at || nowIso
                            };
                            // Add to top of library
                            state.tracks = [newTrack, ...state.tracks.filter(t => t.id !== newTrack.id)];
                            // Immediately re-render active view so each song reflects right away!
                            renderActiveView();
                        } catch (err) {
                            console.error('Upload JSON parse error:', err);
                        }
                    }
                    resolve();
                };
                xhr.onerror = function() {
                    delete inFlight[fileKey];
                    completedFiles++;
                    completedBytes += file.size;
                    updateModalUI();
                    resolve();
                };
                const formData = new FormData();
                formData.append("file", file);
                formData.append("doc", "global");
                xhr.send(formData);
            });
        }

        updateModalUI();
        renderActiveView();
        e.target.value = '';

        setTimeout(() => {
            if (modal) modal.classList.remove('show');
        }, 1200);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // =========================================================================
    // Initialization & Event Wiring
    // =========================================================================
    function initMusicHub() {
        initAudioEngine();
        updatePlayerBarUI();

        // Check current route on initial load
        navigateTo(window.location.pathname || '/', false);

        // Fetch music library
        fetchTracks();

        // Sidebar Navigation Clicks
        document.querySelectorAll('.music-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const tab = item.getAttribute('data-tab');
                state.activeTab = tab;
                state.filterAlbum = null;
                state.filterArtist = null;
                state.searchQuery = '';
                const searchInput = document.getElementById('musicSearchInput');
                if (searchInput) searchInput.value = '';
                syncSidebarNav();
                renderActiveView();
            });
        });

        // Mobile Nav Bar Clicks
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                if (tab === 'notes') {
                    navigateTo('/');
                } else {
                    navigateTo('/music');
                    state.activeTab = tab;
                    state.filterAlbum = null;
                    state.filterArtist = null;
                    state.searchQuery = '';
                    const searchInput = document.getElementById('musicSearchInput');
                    if (searchInput) searchInput.value = '';
                    syncSidebarNav();
                    renderActiveView();
                }
            });
        });

        // Upload Button Wiring
        const uploadBtn = document.getElementById('musicSidebarUploadBtn');
        const uploadInput = document.getElementById('musicMainUploadInput');
        if (uploadBtn && uploadInput) {
            uploadBtn.addEventListener('click', () => uploadInput.click());
            uploadInput.addEventListener('change', handleMusicUpload);
        }

        // Search Input
        const searchInput = document.getElementById('musicSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state.searchQuery = e.target.value.trim();
                renderActiveView();
            });
        }

        // Sort Select
        const sortSelect = document.getElementById('musicSortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                state.sortBy = e.target.value;
                renderActiveView();
            });
        }

        // Batch Overflow Menu Toggle
        const overflowTrigger = document.getElementById('musicOverflowTrigger');
        const overflowMenu = document.getElementById('musicOverflowDropdown');
        if (overflowTrigger && overflowMenu) {
            overflowTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                overflowMenu.classList.toggle('show');
            });
            document.addEventListener('click', () => {
                overflowMenu.classList.remove('show');
            });
        }

        // Batch Menu Items
        document.getElementById('batchToggleSelectBtn')?.addEventListener('click', () => {
            state.selectMode = !state.selectMode;
            if (!state.selectMode) state.selectedIds.clear();
            renderActiveView();
        });

        document.getElementById('batchSelectAllBtn')?.addEventListener('click', () => {
            state.selectMode = true;
            getFilteredTracks().forEach(t => state.selectedIds.add(t.id));
            renderActiveView();
        });

        document.getElementById('batchDownloadBtn')?.addEventListener('click', handleBatchDownload);
        document.getElementById('batchDeleteBtn')?.addEventListener('click', handleBatchDelete);

        // Player Bar Controls
        document.getElementById('gpbPlayBtn')?.addEventListener('click', togglePlayPause);
        document.getElementById('gpbNextBtn')?.addEventListener('click', playNext);
        document.getElementById('gpbPrevBtn')?.addEventListener('click', playPrev);
        document.getElementById('gpbShuffleBtn')?.addEventListener('click', toggleShuffle);
        document.getElementById('gpbRepeatBtn')?.addEventListener('click', toggleRepeat);

        // Document Mini-Player Play/Pause
        document.getElementById('docMiniPlayBtn')?.addEventListener('click', togglePlayPause);

        // Document Open Hub Button
        document.getElementById('openMusicHubBtn')?.addEventListener('click', () => navigateTo('/music'));

        // Stop click propagation on control and utility areas so they NEVER trigger fullscreen
        document.querySelector('.gpb-center-controls')?.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        document.querySelector('.gpb-right-utilities')?.addEventListener('click', (e) => {
            if (!e.target.closest('#gpbExpandBtn')) {
                e.stopPropagation();
            }
        });

        // Trigger Full Screen Music Player ONLY from Track Details or Expand Button
        document.getElementById('gpbTrackDetails')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.togglePlayerFullScreen === 'function') {
                window.togglePlayerFullScreen();
            }
        });
        document.getElementById('gpbExpandBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.togglePlayerFullScreen === 'function') {
                window.togglePlayerFullScreen();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMusicHub);
    } else {
        initMusicHub();
    }

})();
