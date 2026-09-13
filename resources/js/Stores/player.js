import { defineStore } from 'pinia';

export const usePlayerStore = defineStore('player', {
    state: () => ({
        ytPlayer: null,
        isApiReady: false,
        playlist: [],
        currentIndex: -1,
        isPlaying: false,
        isLoading: false,
        isShuffle: false,
        isRepeat: false,
        repeatMode: 'off', // 'off' | 'all' (loop antrean) | 'one' (loop 1 lagu) | 'shuffle' (random antrean)
        currentTime: 0,
        duration: 0,
        progress: 0,
        isFullPlayerOpen: false,
        favorites: JSON.parse(localStorage.getItem('bandys_favs') || '[]'),
        history: JSON.parse(localStorage.getItem('bandys_history') || '[]'),
        userQueue: [], // Lagu-lagu yang ditambahkan manual oleh user via "Tambahkan ke Antrean"
        relatedRecommendations: [], // Daftar rekomendasi terkait aktif
        previousTracks: [], // Stack lagu-lagu sebelumnya untuk fitur Undo/Prev
        shouldRefreshRelated: true, // Flag kontrol apakah rekomendasi perlu di-fetch ulang atau dipertahankan
        progressTimer: null,
        playbackMode: 'youtube', // 'youtube' | 'audio'
        currentStreamUrl: null,
        currentStreamDuration: 0,
        audioEngine: null,
        fallbackRetries: 0,
        triedAlternativeIds: [],
        silentAudio: null,
        wakeLock: null,
        isVisibilityGuarded: false,
        isUserPaused: false,
        pendingTrackId: null,
    }),
    getters: {
        currentTrack(state) {
            if (state.currentIndex >= 0 && state.currentIndex < state.playlist.length) {
                return state.playlist[state.currentIndex];
            }
            return null;
        },
        isCurrentFavorite(state) {
            if (!this.currentTrack) return false;
            return state.favorites.some(f => f.id === this.currentTrack.id);
        },
    },
    actions: {
        initYouTubeEngine() {
            this.initNativeBridgeListener();
            this.initAudioEngine();
            this.initBackgroundAudioBridge();
            this.initVisibilityGuard();

            if (window.YT && window.YT.Player) {
                this.createPlayerInstance();
                return;
            }

            // Load YouTube IFrame Player API
            if (!document.getElementById('yt-iframe-api')) {
                const tag = document.createElement('script');
                tag.id = 'yt-iframe-api';
                tag.src = 'https://www.youtube.com/iframe_api';
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

                window.onYouTubeIframeAPIReady = () => {
                    this.createPlayerInstance();
                };
            }
        },

        initNativeBridgeListener() {
            if (typeof window === 'undefined' || window._bandysBridgeInitialized) return;
            window._bandysBridgeInitialized = true;

            window.BandysNativeBridgeListener = (action, value) => {
                if (action === 'play') {
                    this.isPlaying = true;
                    this.isUserPaused = false;
                    if (this.playbackMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
                        try { this.ytPlayer.playVideo(); } catch (e) {}
                    }
                } else if (action === 'pause') {
                    this.isPlaying = false;
                    this.isUserPaused = true;
                    if (this.playbackMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
                        try { this.ytPlayer.pauseVideo(); } catch (e) {}
                    }
                } else if (action === 'next') {
                    this.nextTrack();
                } else if (action === 'previous') {
                    this.prevTrack();
                } else if (action === 'seek') {
                    if (this.duration > 0 && typeof value === 'number') {
                        const sec = value / 1000;
                        const pct = Math.max(0, Math.min(100, (sec / this.duration) * 100));
                        this.seek(pct);
                    }
                } else if (action === 'sync_pos') {
                    if (this.playbackMode === 'audio' && typeof value === 'number' && this.duration > 0) {
                        const sec = value / 1000;
                        if (sec > 0 || this.currentTime < 2) {
                            this.currentTime = sec;
                            this.progress = Math.max(0, Math.min(100, (sec / this.duration) * 100));
                        }
                    }
                }
            };
        },

        initAudioEngine() {
            if (this.audioEngine || typeof window === 'undefined') return;
            try {
                let audio = document.getElementById('bandys-native-audio-engine');
                if (!audio) {
                    audio = document.createElement('audio');
                    audio.id = 'bandys-native-audio-engine';
                    audio.preload = 'auto';
                    audio.setAttribute('playsinline', 'true');
                    audio.setAttribute('webkit-playsinline', 'true');
                    audio.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-998;';
                    document.body.appendChild(audio);
                }

                audio.addEventListener('play', () => {
                    if (this.playbackMode === 'audio') {
                        this.isPlaying = true;
                        this.isLoading = false;
                        this.acquireWakeLock();
                        if ('mediaSession' in navigator) {
                            navigator.mediaSession.playbackState = 'playing';
                        }
                    }
                });

                audio.addEventListener('pause', () => {
                    if (this.playbackMode === 'audio') {
                        this.isPlaying = false;
                        this.releaseWakeLock();
                        if ('mediaSession' in navigator) {
                            navigator.mediaSession.playbackState = 'paused';
                        }
                    }
                });

                let lastNativeAudioSync = 0;
                audio.addEventListener('timeupdate', () => {
                    if (this.playbackMode === 'audio') {
                        const curr = audio.currentTime || 0;
                        const dur = audio.duration || this.duration || 0;
                        this.currentTime = curr;
                        if (dur > 0 && !isNaN(dur)) {
                            this.duration = dur;
                            this.progress = (curr / dur) * 100;
                        }

                        // Sync position state to OS Lockscreen / Notification Shade
                        if ('mediaSession' in navigator && dur > 0 && typeof navigator.mediaSession.setPositionState === 'function') {
                            try {
                                navigator.mediaSession.setPositionState({
                                    duration: dur,
                                    playbackRate: 1,
                                    position: Math.min(curr, dur)
                                });
                            } catch (e) {}
                        }

                        const now = Date.now();
                        if (now - lastNativeAudioSync > 1200 && typeof window !== 'undefined' && window.BandysNativeBridge?.updatePosition) {
                            lastNativeAudioSync = now;
                            window.BandysNativeBridge.updatePosition(curr, dur, this.isPlaying);
                        }
                    }
                });

                audio.addEventListener('ended', () => {
                    if (this.playbackMode === 'audio') {
                        this.isPlaying = false;
                        this.isLoading = false;
                        this.releaseWakeLock();
                        if ('mediaSession' in navigator) {
                            navigator.mediaSession.playbackState = 'paused';
                        }
                        this.onTrackEnded();
                    }
                });

                audio.addEventListener('error', (e) => {
                    if (this.playbackMode === 'audio') {
                        console.warn('Native audio error, falling back to next or alternative:', e);
                        this.isLoading = false;
                    }
                });

                this.audioEngine = audio;
            } catch (e) {
                console.warn('Audio engine init error:', e);
            }
        },

        initBackgroundAudioBridge() {
            if (this.silentAudio || typeof window === 'undefined') return;
            try {
                // Base64 silent WAV loop to keep audio context & background execution alive in mobile browsers & lockscreen
                const silentWavUri = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
                let audio = document.getElementById('bandys-silent-bg-audio');
                if (!audio) {
                    audio = document.createElement('audio');
                    audio.id = 'bandys-silent-bg-audio';
                    audio.src = silentWavUri;
                    audio.loop = true;
                    audio.setAttribute('playsinline', 'true');
                    audio.setAttribute('webkit-playsinline', 'true');
                    audio.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1000;';
                    document.body.appendChild(audio);
                }
                this.silentAudio = audio;
            } catch (e) {
                console.warn('Silent audio bridge init error:', e);
            }
        },

        playSilentAudioBridge() {
            if (this.silentAudio) {
                this.silentAudio.play().catch(() => {});
            }
        },

        pauseSilentAudioBridge() {
            if (this.silentAudio) {
                this.silentAudio.pause();
            }
        },

        async acquireWakeLock() {
            if ('wakeLock' in navigator && !this.wakeLock) {
                try {
                    this.wakeLock = await navigator.wakeLock.request('screen');
                } catch (err) {}
            }
        },

        releaseWakeLock() {
            if (this.wakeLock) {
                try {
                    this.wakeLock.release();
                } catch (err) {}
                this.wakeLock = null;
            }
        },

        initVisibilityGuard() {
            if (this.isVisibilityGuarded || typeof document === 'undefined') return;
            this.isVisibilityGuarded = true;

            const handleVisibilityChange = () => {
                if (document.visibilityState === 'hidden') {
                    // Ketika user beralih ke aplikasi lain (Home / WA) atau mematikan layar HP
                    if (!this.isUserPaused && this.isPlaying && this.currentTrack) {
                        let currentPos = this.currentTime;
                        if (this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
                            const ytSec = this.ytPlayer.getCurrentTime();
                            if (ytSec > 0) currentPos = ytSec;
                        }

                        // Stream URL: gunakan proxy audio stream agar tidak terkena 403 Google CDN
                        const streamUrl = `${window.location.origin}/api/stream/audio/${this.currentTrack.id}`;

                        // Jika berjalan di Android APK -> serahkan audio ke Native Android Foreground Service
                        if (typeof window !== 'undefined' && window.BandysNativeBridge?.playNativeStream) {
                            this.playbackMode = 'audio';
                            if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
                                try { this.ytPlayer.pauseVideo(); } catch (e) {}
                            }
                            const track = this.currentTrack;
                            const title = track?.title || "Bandy's Music";
                            const artist = track?.artist || "Bandy's Stream";
                            const thumb = track?.thumbnail || `https://i.ytimg.com/vi/${track?.id}/hqdefault.jpg`;
                            window.BandysNativeBridge.playNativeStream(streamUrl, title, artist, thumb, this.currentStreamDuration || this.duration, currentPos);
                        } else {
                            this.playSilentAudioBridge();
                            if (this.playbackMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
                                this.ytPlayer.playVideo();
                            }
                        }
                    }
                } else {
                    // Ketika user kembali ke dalam aplikasi (foreground)
                    if (!this.isUserPaused && this.isPlaying) {
                        if (this.playbackMode === 'audio' && typeof window !== 'undefined' && window.BandysNativeBridge?.stopNativeAudio) {
                            // Hentikan native audio dan lanjutkan dengan YouTube player di detik yang sama
                            window.BandysNativeBridge.stopNativeAudio();
                            this.playbackMode = 'youtube';
                            if (this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
                                try {
                                    this.ytPlayer.seekTo(this.currentTime, true);
                                    this.ytPlayer.playVideo();
                                } catch (e) {}
                            }
                        } else if (this.playbackMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
                            this.ytPlayer.playVideo();
                        }
                    }
                }
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);
            if (typeof window !== 'undefined') {
                window.addEventListener('pagehide', handleVisibilityChange);
                window.addEventListener('blur', handleVisibilityChange);
            }
        },

        createPlayerInstance() {
            if (this.ytPlayer) return;

            // Create persistent container if not exists (using 200x200 off-screen to avoid Chromium mobile layout drops)
            let container = document.getElementById('bandys-hidden-yt-player');
            if (!container) {
                container = document.createElement('div');
                container.id = 'bandys-hidden-yt-player';
                container.style.cssText = 'position:fixed;bottom:0;right:0;width:200px;height:200px;opacity:0.001;pointer-events:none;z-index:-999;';
                document.body.appendChild(container);
            }

            this.ytPlayer = new window.YT.Player('bandys-hidden-yt-player', {
                height: '200',
                width: '200',
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    rel: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    enablejsapi: 1,
                    origin: window.location.origin
                },
                events: {
                    onReady: () => {
                        this.isApiReady = true;
                        if (this.pendingTrackId && this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
                            this.ytPlayer.loadVideoById(this.pendingTrackId);
                            this.ytPlayer.playVideo();
                            this.pendingTrackId = null;
                        }
                    },
                    onStateChange: (event) => {
                        if (this.playbackMode !== 'youtube') return;

                        // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
                        if (event.data === window.YT.PlayerState.PLAYING) {
                            this.isPlaying = true;
                            this.isLoading = false;
                            this.playSilentAudioBridge();
                            this.acquireWakeLock();
                            const dur = this.ytPlayer.getDuration() || 0;
                            if (dur > 0) {
                                this.duration = dur;
                            }
                            this.updateMediaSession(this.currentTrack);
                            if ('mediaSession' in navigator) {
                                navigator.mediaSession.playbackState = 'playing';
                            }
                            this.startProgressTracker();
                        } else if (event.data === window.YT.PlayerState.PAUSED) {
                            if (this.isUserPaused) {
                                this.isPlaying = false;
                                this.pauseSilentAudioBridge();
                                this.releaseWakeLock();
                                if ('mediaSession' in navigator) {
                                    navigator.mediaSession.playbackState = 'paused';
                                }
                                this.stopProgressTracker();
                            } else {
                                // Background auto-pause intervention by Chromium / OS -> Keep playing!
                                this.playSilentAudioBridge();
                                if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
                                    this.ytPlayer.playVideo();
                                }
                            }
                        } else if (event.data === window.YT.PlayerState.BUFFERING) {
                            this.isLoading = true;
                        } else if (event.data === window.YT.PlayerState.ENDED) {
                            this.isPlaying = false;
                            this.isLoading = false;
                            this.pauseSilentAudioBridge();
                            this.releaseWakeLock();
                            if ('mediaSession' in navigator) {
                                navigator.mediaSession.playbackState = 'paused';
                            }
                            this.stopProgressTracker();
                            this.onTrackEnded();
                        }
                    },
                    onError: async (err) => {
                        console.warn('YouTube Player Embed Restricted / Error:', err);
                        this.isLoading = true;

                        const current = this.currentTrack;
                        // TRIK 1: Ambil Direct Audio Stream langsung dari server (100% tembus tanpa batasan embed YouTube)
                        if (current && current.id) {
                            try {
                                const res = await fetch(`/api/stream/${current.id}`);
                                const data = await res.json();
                                if (data && data.success && data.streamUrl) {
                                    this.playDirectAudioStream(data.streamUrl, data.duration, this.currentTime);
                                    return;
                                }
                            } catch (e) {
                                console.warn('Direct stream fallback attempt:', e);
                            }
                        }

                        // TRIK 2: Jika direct stream belum tersedia, carikan Video Alternatif (Official MV / Lyric Video) untuk lagu yang sama
                        if (current && this.fallbackRetries < 3 && current.title && current.artist) {
                            this.fallbackRetries++;
                            try {
                                const excludeParam = (this.triedAlternativeIds || []).join(',');
                                const res = await fetch(`/api/alternative?title=${encodeURIComponent(current.title)}&artist=${encodeURIComponent(current.artist)}&exclude=${encodeURIComponent(excludeParam)}`);
                                const data = await res.json();
                                if (data && data.success && data.alternativeVideoId) {
                                    const altId = data.alternativeVideoId;
                                    this.triedAlternativeIds.push(altId);
                                    current.id = altId;

                                    if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
                                        this.playbackMode = 'youtube';
                                        this.ytPlayer.loadVideoById(altId);
                                        this.ytPlayer.playVideo();
                                        return;
                                    }
                                }
                            } catch (e) {
                                console.error('Failed to resolve alternative video:', e);
                            }
                        }

                        this.isLoading = false;
                        setTimeout(() => this.nextTrack(), 1000);
                    }
                }
            });
        },

        playDirectAudioStream(streamUrl, duration = null, startPosition = 0) {
            this.initAudioEngine();
            this.playbackMode = 'audio';
            this.stopProgressTracker();

            // Matikan / pause YouTube player jika sedang ada
            if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
                try { this.ytPlayer.pauseVideo(); } catch (e) {}
            }
            this.pauseSilentAudioBridge();

            // 1. Jika berjalan di Native Android APK -> serahkan audio decoding 100% ke Android MediaPlayer Foreground Service!
            if (typeof window !== 'undefined' && window.BandysNativeBridge?.playNativeStream) {
                const track = this.currentTrack;
                const title = track?.title || "Bandy's Music";
                const artist = track?.artist || "Bandy's Stream";
                const thumb = track?.thumbnail || (track?.id ? `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg` : "");
                const dur = duration || this.duration || 0;
                
                window.BandysNativeBridge.playNativeStream(streamUrl, title, artist, thumb, dur, startPosition);
                this.isPlaying = true;
                this.isLoading = false;
                if (duration) this.duration = duration;
                if (startPosition > 0) this.currentTime = startPosition;
                this.updateMediaSession(track);
                return;
            }

            // 2. Web Browser fallback
            if (this.audioEngine) {
                this.audioEngine.src = streamUrl;
                if (startPosition > 0) {
                    this.audioEngine.currentTime = startPosition;
                    this.currentTime = startPosition;
                }
                if (duration) this.duration = duration;

                this.audioEngine.play().then(() => {
                    this.isPlaying = true;
                    this.isLoading = false;
                    this.acquireWakeLock();
                    this.updateMediaSession(this.currentTrack);
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = 'playing';
                    }
                }).catch(err => {
                    console.warn('AudioEngine play error:', err);
                    this.isLoading = false;
                });
            }
        },


        startProgressTracker() {
            this.stopProgressTracker();
            let lastNativeSync = 0;
            this.progressTimer = setInterval(() => {
                if (this.playbackMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
                    const curr = this.ytPlayer.getCurrentTime() || 0;
                    const dur = this.ytPlayer.getDuration() || 0;
                    this.currentTime = curr;
                    this.duration = dur;
                    this.progress = dur > 0 ? (curr / dur) * 100 : 0;

                    // Sync position state to OS Lockscreen / Notification Shade
                    if ('mediaSession' in navigator && dur > 0 && typeof navigator.mediaSession.setPositionState === 'function') {
                        try {
                            navigator.mediaSession.setPositionState({
                                duration: dur,
                                playbackRate: 1,
                                position: Math.min(curr, dur)
                            });
                        } catch (e) {}
                    }

                    // Throttle native position updates to every 1.5s
                    const now = Date.now();
                    if (now - lastNativeSync > 1500 && typeof window !== 'undefined' && window.BandysNativeBridge?.updatePosition) {
                        lastNativeSync = now;
                        window.BandysNativeBridge.updatePosition(curr, dur, this.isPlaying);
                    }
                }
            }, 500);
        },

        stopProgressTracker() {
            if (this.progressTimer) {
                clearInterval(this.progressTimer);
                this.progressTimer = null;
            }
        },

        async fetchRelatedRecommendations(track, forceRefresh = false) {
            if (!track) return;
            if (!forceRefresh && this.relatedRecommendations.length > 0) {
                return;
            }

            try {
                const timestamp = Date.now();
                const res = await fetch(`/api/related?artist=${encodeURIComponent(track.artist)}&title=${encodeURIComponent(track.title)}&t=${timestamp}`);
                const data = await res.json();
                if (data && Array.isArray(data.data)) {
                    // Filter out duplicate instance of the current track from raw recommendations
                    const filtered = data.data.filter(item => item.id !== track.id);
                    // Insert track yang sedang diputar di posisi PALING AWAL (Index 0)
                    this.relatedRecommendations = [track, ...filtered];
                }
            } catch (e) {
                console.error('Failed to fetch related recommendations:', e);
            }
        },

        playTrack(track, list = null) {
            this.initYouTubeEngine();
            this.initAudioEngine();
            this.initBackgroundAudioBridge();
            this.playSilentAudioBridge();

            // 1. INSTANT STATE UPDATE (0.001 detik langsung responsif tanpa delay)
            this.currentTime = 0;
            this.duration = 0;
            this.progress = 0;
            this.previousTracks = [];
            this.playlist = [track];
            this.currentIndex = 0;
            this.shouldRefreshRelated = true;
            this.fallbackRetries = 0;
            this.triedAlternativeIds = [track.id];
            this.isPlaying = true;
            this.isLoading = false;
            this.isUserPaused = false;

            this.addToHistory(track);
            this.updateMediaSession(track);
            this.fetchRelatedRecommendations(track, true);

            const isBackground = typeof document !== 'undefined' && document.visibilityState === 'hidden';

            if (isBackground && typeof window !== 'undefined' && window.BandysNativeBridge?.playNativeStream) {
                this.playbackMode = 'audio';
                if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
                    try { this.ytPlayer.pauseVideo(); } catch (e) {}
                }
                const streamUrl = `${window.location.origin}/api/stream/audio/${track.id}`;
                const title = track.title || "Bandy's Music";
                const artist = track.artist || "Bandy's Stream";
                const thumb = track.thumbnail || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
                window.BandysNativeBridge.playNativeStream(streamUrl, title, artist, thumb, 0, 0);
            } else {
                // Stop any native audio playback from previous song
                if (typeof window !== 'undefined' && window.BandysNativeBridge?.stopNativeAudio) {
                    window.BandysNativeBridge.stopNativeAudio();
                } else if (typeof window !== 'undefined' && window.BandysNativeBridge?.pauseNativeAudio) {
                    window.BandysNativeBridge.pauseNativeAudio();
                }

                // 2. Putar YouTube Audio secara instan 0-delay
                this.playbackMode = 'youtube';
                if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
                    this.ytPlayer.loadVideoById(track.id);
                    this.ytPlayer.playVideo();
                } else {
                    this.pendingTrackId = track.id;
                }
            }

            // 3. Precache direct stream secara senyap di background untuk persiapan background playback
            this.precacheStream(track);
        },

        async precacheStream(track) {
            if (!track || !track.id) return;
            const targetId = track.id;
            try {
                const res = await fetch(`/api/stream/${encodeURIComponent(targetId)}`);
                const data = await res.json();
                if (data && data.success && data.streamUrl && this.currentTrack?.id === targetId) {
                    const streamUrl = data.streamUrl.startsWith('http') ? data.streamUrl : `${window.location.origin}${data.streamUrl}`;
                    this.currentStreamUrl = streamUrl;
                    this.currentStreamDuration = data.duration || this.duration;
                }
            } catch (e) {
                console.warn('Precache stream note:', e);
            }
        },

        playTrackFromQueue(track, index) {
            this.initYouTubeEngine();
            this.initAudioEngine();
            this.initBackgroundAudioBridge();
            this.playSilentAudioBridge();

            const isBackground = typeof document !== 'undefined' && document.visibilityState === 'hidden';

            if (isBackground && typeof window !== 'undefined' && window.BandysNativeBridge?.playNativeStream) {
                this.playbackMode = 'audio';
                if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
                    try { this.ytPlayer.pauseVideo(); } catch (e) {}
                }
                const streamUrl = `${window.location.origin}/api/stream/audio/${track.id}`;
                const title = track.title || "Bandy's Music";
                const artist = track.artist || "Bandy's Stream";
                const thumb = track.thumbnail || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
                window.BandysNativeBridge.playNativeStream(streamUrl, title, artist, thumb, 0, 0);
            } else {
                // Stop any native audio playback from previous song
                if (typeof window !== 'undefined' && window.BandysNativeBridge?.stopNativeAudio) {
                    window.BandysNativeBridge.stopNativeAudio();
                } else if (typeof window !== 'undefined' && window.BandysNativeBridge?.pauseNativeAudio) {
                    window.BandysNativeBridge.pauseNativeAudio();
                }

                // 2. Putar YouTube Audio secara instan 0-delay
                this.playbackMode = 'youtube';
                if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
                    this.ytPlayer.loadVideoById(track.id);
                    this.ytPlayer.playVideo();
                } else {
                    this.pendingTrackId = track.id;
                }
            }

            // 3. Precache direct stream secara senyap di background
            this.precacheStream(track);
        },

        togglePlay(forceState) {
            this.initYouTubeEngine();

            if (this.currentIndex === -1 && this.playlist.length > 0) {
                this.playTrack(this.playlist[0], this.playlist);
                return;
            }

            const targetPlaying = forceState !== undefined ? forceState : !this.isPlaying;
            this.isUserPaused = !targetPlaying;

            // Native Android Bridge Handling for Audio mode
            if (this.playbackMode === 'audio' && typeof window !== 'undefined' && window.BandysNativeBridge?.pauseNativeAudio && window.BandysNativeBridge?.resumeNativeAudio) {
                if (targetPlaying) {
                    window.BandysNativeBridge.resumeNativeAudio();
                    this.isPlaying = true;
                } else {
                    window.BandysNativeBridge.pauseNativeAudio();
                    this.isPlaying = false;
                }
                return;
            }

            if (this.playbackMode === 'audio' && this.audioEngine) {
                if (targetPlaying) {
                    this.audioEngine.play().catch(() => {});
                    this.isPlaying = true;
                    this.playSilentAudioBridge();
                    if (this.currentTrack && typeof window !== 'undefined' && window.BandysNativeBridge?.startForegroundPlayback) {
                        window.BandysNativeBridge.startForegroundPlayback(this.currentTrack.title || "Bandy's Music", this.currentTrack.artist || "Bandy's Stream");
                    }
                } else {
                    this.audioEngine.pause();
                    this.isPlaying = false;
                    this.pauseSilentAudioBridge();
                    if (typeof window !== 'undefined' && window.BandysNativeBridge?.stopForegroundPlayback) {
                        window.BandysNativeBridge.stopForegroundPlayback();
                    }
                }
                return;
            }

            if (!this.ytPlayer || typeof this.ytPlayer.getPlayerState !== 'function') return;

            if (targetPlaying) {
                this.ytPlayer.playVideo();
                this.isPlaying = true;
                this.playSilentAudioBridge();
                if (typeof window !== 'undefined' && window.BandysNativeBridge?.updatePosition) {
                    window.BandysNativeBridge.updatePosition(this.currentTime, this.duration, true);
                }
            } else {
                this.ytPlayer.pauseVideo();
                this.isPlaying = false;
                this.pauseSilentAudioBridge();
                if (typeof window !== 'undefined' && window.BandysNativeBridge?.updatePosition) {
                    window.BandysNativeBridge.updatePosition(this.currentTime, this.duration, false);
                }
            }
        },

        setRelatedRecommendations(list) {
            this.relatedRecommendations = list || [];
        },

        nextTrack() {
            const current = this.currentTrack;
            if (!current) return;

            // 1. Jika antrean playlist memiliki lebih dari 1 lagu (user punya antrean manual)
            if (this.playlist.length > 1) {
                // Jika mode shuffle aktif atau repeatMode === 'shuffle'
                if (this.isShuffle || this.repeatMode === 'shuffle') {
                    let randomIdx = Math.floor(Math.random() * this.playlist.length);
                    if (this.playlist.length > 1 && randomIdx === this.currentIndex) {
                        randomIdx = (randomIdx + 1) % this.playlist.length;
                    }
                    this.previousTracks.push(current);
                    this.playTrackFromQueue(this.playlist[randomIdx], randomIdx);
                    return;
                } else {
                    let nextIdx = this.currentIndex + 1;
                    // Jika masih ada lagu berikutnya di dalam antrean manual
                    if (nextIdx < this.playlist.length) {
                        this.previousTracks.push(current);
                        this.playTrackFromQueue(this.playlist[nextIdx], nextIdx);
                        return;
                    }

                    // JIKA SUDAH DI LAGU TERAKHIR ANTREAN:
                    // Jika mode Repeat All Queue aktif (repeatMode === 'all'), loop kembali ke lagu ke-1 antrean
                    if (this.repeatMode === 'all') {
                        this.previousTracks.push(current);
                        this.playTrackFromQueue(this.playlist[0], 0);
                        return;
                    }

                    // Jika tidak repeat all, ambil lagu berikutnya dari Playlist Rekomendasi Terkait dan OTOMATIS MASUKKAN KE ANTREAN!
                    if (this.relatedRecommendations && this.relatedRecommendations.length > 0) {
                        const queueIds = new Set(this.playlist.map(p => p.id));
                        const nextSong = this.relatedRecommendations.find(r => !queueIds.has(r.id)) || this.relatedRecommendations[0];

                        if (nextSong) {
                            this.previousTracks.push(current);
                            // Masukkan lagu C ke dalam tabel antrean (player.playlist)
                            const newIdx = this.playlist.length;
                            this.playlist.push(nextSong);
                            // Putar lagu C sebagai bagian dari antrean
                            this.playTrackFromQueue(nextSong, newIdx);
                            return;
                        }
                    }
                }
            }

            // 2. Navigasi lagu di Playlist Rekomendasi Terkait jika bukan mode antrean banyak
            if (this.relatedRecommendations && this.relatedRecommendations.length > 0) {
                // Temukan index lagu saat ini di dalam daftar rekomendasi
                const currRecIndex = this.relatedRecommendations.findIndex(r => r.id === current.id);
                let nextSong = null;

                if (currRecIndex >= 0) {
                    // Jika lagu saat ini ada di list rekomendasi, pilih lagu berikutnya (index + 1)
                    if (currRecIndex + 1 < this.relatedRecommendations.length) {
                        nextSong = this.relatedRecommendations[currRecIndex + 1];
                    }
                } else {
                    // Jika lagu saat ini tidak ada di daftar rekomendasi, cari lagu rekomendasi pertama
                    const queueIds = new Set(this.playlist.map(p => p.id));
                    nextSong = this.relatedRecommendations.find(r => !queueIds.has(r.id)) || this.relatedRecommendations[0];
                }

                if (nextSong) {
                    // Simpan lagu saat ini ke previousTracks untuk Undo/Kembali
                    this.previousTracks.push(current);
                    
                    // Putar lagu rekomendasi berikutnya TANPA me-refresh playlist rekomendasi
                    this.playTrackFromRecommendations(nextSong);
                    return;
                }
            }

            // 3. Fallback jika sudah di ujung rekomendasi
            this.fetchMoreRadioTracks();
        },

        prevTrack() {
            this.initYouTubeEngine();

            // Aturan Standar Pemutar Musik Dunia (Spotify / Apple Music / YouTube Music):
            // Jika lagu sudah berjalan lebih dari 3 detik (misal di menit 1:25),
            // tekan Back/Prev akan MENGULANG LAGU DARI DETIK 0:00.
            // Jika ditekan di detik awal (<= 3 detik), baru mundur ke lagu sebelumnya!
            if (this.currentTime > 3) {
                this.seek(0);
                if (!this.isPlaying) {
                    this.togglePlay(true);
                }
                return;
            }

            // 1. Jika antrean memiliki lagu dan kita berada di indeks > 0 (misal lagu ke-2, mundur ke lagu ke-1)
            if (this.playlist.length > 1 && this.currentIndex > 0) {
                const prevIdx = this.currentIndex - 1;
                const prevSong = this.playlist[prevIdx];
                if (prevSong) {
                    this.playTrackFromQueue(prevSong, prevIdx);
                    return;
                }
            }

            // 2. Jika ada riwayat sebelumnya di previousTracks
            if (this.previousTracks.length > 0) {
                const prevSong = this.previousTracks.pop();
                if (prevSong) {
                    const qIdx = this.playlist.findIndex(p => p.id === prevSong.id);
                    if (qIdx >= 0) {
                        this.playTrackFromQueue(prevSong, qIdx);
                    } else {
                        this.playTrackFromRecommendations(prevSong);
                    }
                    return;
                }
            }

            // 3. Jika ini lagu pertama di daftar, ulangi dari detik 0:00
            this.seek(0);
            if (!this.isPlaying) {
                this.togglePlay(true);
            }
        },

        playTrackFromRecommendations(track) {
            const current = this.currentTrack;
            if (current && current.id !== track.id) {
                this.previousTracks.push(current);
            }

            this.initYouTubeEngine();
            this.initAudioEngine();
            this.initBackgroundAudioBridge();
            this.playSilentAudioBridge();

            // 1. INSTANT STATE UPDATE
            this.currentTime = 0;
            this.duration = 0;
            this.progress = 0;
            this.shouldRefreshRelated = false;
            this.fallbackRetries = 0;
            this.triedAlternativeIds = [track.id];
            this.isPlaying = true;
            this.isLoading = false;
            this.isUserPaused = false;

            this.addToHistory(track);
            this.updateMediaSession(track);

            // Cek apakah lagu ini sudah ada di antrean
            const existingIdx = this.playlist.findIndex(p => p.id === track.id);
            if (existingIdx >= 0) {
                this.currentIndex = existingIdx;
            } else {
                this.playlist.push(track);
                this.currentIndex = this.playlist.length - 1;
            }

            const isBackground = typeof document !== 'undefined' && document.visibilityState === 'hidden';

            if (isBackground && typeof window !== 'undefined' && window.BandysNativeBridge?.playNativeStream) {
                this.playbackMode = 'audio';
                if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
                    try { this.ytPlayer.pauseVideo(); } catch (e) {}
                }
                const streamUrl = `${window.location.origin}/api/stream/audio/${track.id}`;
                const title = track.title || "Bandy's Music";
                const artist = track.artist || "Bandy's Stream";
                const thumb = track.thumbnail || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
                window.BandysNativeBridge.playNativeStream(streamUrl, title, artist, thumb, 0, 0);
            } else {
                // Stop any native audio playback from previous song
                if (typeof window !== 'undefined' && window.BandysNativeBridge?.stopNativeAudio) {
                    window.BandysNativeBridge.stopNativeAudio();
                } else if (typeof window !== 'undefined' && window.BandysNativeBridge?.pauseNativeAudio) {
                    window.BandysNativeBridge.pauseNativeAudio();
                }

                // 2. Putar YouTube Audio secara instan 0-delay
                this.playbackMode = 'youtube';
                if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
                    this.ytPlayer.loadVideoById(track.id);
                    this.ytPlayer.playVideo();
                } else {
                    this.pendingTrackId = track.id;
                }
            }

            // 3. Precache direct stream secara senyap di background
            this.precacheStream(track);
        },

        async fetchMoreRadioTracks() {
            const curr = this.currentTrack;
            if (!curr) return;
            try {
                const res = await fetch(`/api/related?artist=${encodeURIComponent(curr.artist)}&title=${encodeURIComponent(curr.title)}&t=${Date.now()}`);
                const data = await res.json();
                if (data && Array.isArray(data.data) && data.data.length > 0) {
                    const nextSong = data.data.find(s => s.id !== curr.id) || data.data[0];
                    if (nextSong) {
                        this.previousTracks.push(curr);
                        this.playTrackFromRecommendations(nextSong);
                    }
                }
            } catch (e) {
                console.warn('Auto radio stream load error:', e);
            }
        },

        onTrackEnded() {
            // Mode 1: Repeat One (Loop 1 lagu yang sedang diputar terus-menerus)
            if (this.repeatMode === 'one' || this.isRepeat) {
                this.currentTime = 0;
                this.progress = 0;
                if (this.playbackMode === 'audio' && this.audioEngine) {
                    this.audioEngine.currentTime = 0;
                    this.audioEngine.play().catch(() => {});
                } else if (this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
                    this.ytPlayer.seekTo(0, true);
                    this.ytPlayer.playVideo();
                }
                return;
            }

            // Mode 2: Repeat All Queue (Loop seluruh lagu di dalam antrean berulang-ulang)
            if (this.repeatMode === 'all' && this.playlist.length > 1) {
                const current = this.currentTrack;
                let nextIdx = this.currentIndex + 1;
                if (nextIdx >= this.playlist.length) {
                    nextIdx = 0; // Kembali memutar dari lagu pertama di antrean!
                }
                if (current) this.previousTracks.push(current);
                this.playTrackFromQueue(this.playlist[nextIdx], nextIdx);
                return;
            }

            // Mode 3: Shuffle Queue (Acak lagu khusus di dalam antrean saja)
            if (this.repeatMode === 'shuffle' && this.playlist.length > 1) {
                const current = this.currentTrack;
                let randomIdx = Math.floor(Math.random() * this.playlist.length);
                if (this.playlist.length > 1 && randomIdx === this.currentIndex) {
                    randomIdx = (randomIdx + 1) % this.playlist.length;
                }
                if (current) this.previousTracks.push(current);
                this.playTrackFromQueue(this.playlist[randomIdx], randomIdx);
                return;
            }

            // Default
            this.nextTrack();
        },

        seek(percent) {
            this.initYouTubeEngine();
            const pct = Math.max(0, Math.min(100, parseFloat(percent) || 0));
            this.progress = pct;

            let dur = this.duration || 0;

            if (this.playbackMode === 'audio' && typeof window !== 'undefined' && window.BandysNativeBridge?.seekNativeAudio) {
                if (dur > 0) {
                    const targetSecs = (pct / 100) * dur;
                    this.currentTime = targetSecs;
                    window.BandysNativeBridge.seekNativeAudio(targetSecs);
                }
                return;
            }

            if (this.playbackMode === 'audio' && this.audioEngine) {
                if (this.audioEngine.duration && !isNaN(this.audioEngine.duration)) {
                    dur = this.audioEngine.duration;
                }
                if (dur > 0) {
                    const targetSecs = (pct / 100) * dur;
                    this.currentTime = targetSecs;
                    this.duration = dur;
                    this.audioEngine.currentTime = targetSecs;
                }
                return;
            }

            if (this.ytPlayer) {
                let ytDur = typeof this.ytPlayer.getDuration === 'function' ? this.ytPlayer.getDuration() : 0;
                if (ytDur && !isNaN(ytDur) && ytDur > 0) {
                    dur = ytDur;
                }

                if (dur > 0) {
                    const targetSecs = (pct / 100) * dur;
                    this.currentTime = targetSecs;
                    this.duration = dur;

                    if (typeof this.ytPlayer.seekTo === 'function') {
                        this.ytPlayer.seekTo(targetSecs, true);
                    }
                }
            }
        },

        toggleShuffle() {
            this.isShuffle = !this.isShuffle;
        },

        toggleRepeat() {
            const hasQueue = this.playlist.length > 1;

            if (!hasQueue) {
                // Skenario 1 (Tanpa antrean):
                // Toggle antara 'off' dan 'one' (loop lagu saat ini terus-menerus)
                if (this.repeatMode === 'one') {
                    this.repeatMode = 'off';
                    this.isRepeat = false;
                } else {
                    this.repeatMode = 'one';
                    this.isRepeat = true;
                }
            } else {
                // Skenario 2 (Dalam antrean > 1 lagu):
                // Siklus 3 mode: 'all' (loop antrean) -> 'one' (loop 1 lagu) -> 'shuffle' (random antrean) -> 'off'
                if (this.repeatMode === 'off') {
                    this.repeatMode = 'all';
                    this.isRepeat = false;
                } else if (this.repeatMode === 'all') {
                    this.repeatMode = 'one';
                    this.isRepeat = true;
                } else if (this.repeatMode === 'one') {
                    this.repeatMode = 'shuffle';
                    this.isRepeat = false;
                } else {
                    this.repeatMode = 'off';
                    this.isRepeat = false;
                }
            }
        },

        toggleFavorite(track) {
            const idx = this.favorites.findIndex(f => f.id === track.id);
            if (idx >= 0) {
                this.favorites.splice(idx, 1);
            } else {
                this.favorites.unshift(track);
            }
            localStorage.setItem('bandys_favs', JSON.stringify(this.favorites));
        },

        addToHistory(track) {
            this.history = this.history.filter(h => h.id !== track.id);
            this.history.unshift(track);
            if (this.history.length > 50) this.history.pop();
            localStorage.setItem('bandys_history', JSON.stringify(this.history));
        },

        addToQueue(track) {
            // Tambahkan langsung ke dalam satu playlist antrean yang sama (di akhir list tanpa menduplikat jika sudah ada)
            const exists = this.playlist.some(t => t.id === track.id);
            if (!exists) {
                this.playlist.push(track);
            }
        },

        playNextInQueue(track) {
            // Sisipkan tepat di urutan selanjutnya setelah lagu yang sedang berputar
            const filtered = this.playlist.filter(t => t.id !== track.id);
            const insertIdx = this.currentIndex >= 0 ? this.currentIndex + 1 : 0;
            filtered.splice(insertIdx, 0, track);
            this.playlist = filtered;
        },

        removeFromQueue(trackId) {
            const idx = this.playlist.findIndex(t => t.id === trackId);
            if (idx >= 0) {
                this.playlist.splice(idx, 1);
                if (idx < this.currentIndex) {
                    this.currentIndex--;
                }
            }
        },

        moveQueueItem(fromIndex, toIndex) {
            if (fromIndex < 0 || fromIndex >= this.playlist.length) return;
            if (toIndex < 0 || toIndex >= this.playlist.length) return;
            if (fromIndex === toIndex) return;

            // Simpan track yang sedang aktif bermain
            const currentTrackId = this.currentTrack?.id;

            // Pindahkan item di array playlist
            const item = this.playlist.splice(fromIndex, 1)[0];
            this.playlist.splice(toIndex, 0, item);

            // Sinkronkan kembali currentIndex agar lagu yang sedang aktif bermain tetap sinkron
            if (currentTrackId) {
                const newCurrentIdx = this.playlist.findIndex(p => p.id === currentTrackId);
                if (newCurrentIdx >= 0) {
                    this.currentIndex = newCurrentIdx;
                }
            }
        },

        clearQueue() {
            if (this.currentTrack) {
                this.playlist = [this.currentTrack];
                this.currentIndex = 0;
            } else {
                this.playlist = [];
                this.currentIndex = -1;
            }
        },

        updateMediaSession(track) {
            if (!track) return;

            // Trigger Native Android MediaStyle Foreground Service if running inside Capacitor Android APK
            try {
                if (typeof window !== 'undefined' && window.BandysNativeBridge) {
                    const thumbUrl = track.thumbnail || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
                    if (typeof window.BandysNativeBridge.updatePlayback === 'function') {
                        window.BandysNativeBridge.updatePlayback(
                            track.title || "Bandy's Music",
                            track.artist || "Bandy's Stream",
                            thumbUrl,
                            this.duration || 0,
                            this.currentTime || 0,
                            this.isPlaying
                        );
                    } else if (typeof window.BandysNativeBridge.startForegroundPlayback === 'function') {
                        window.BandysNativeBridge.startForegroundPlayback(track.title || "Bandy's Music", track.artist || "Bandy's Stream");
                    }
                }
            } catch (e) {
                console.warn('Native foreground bridge error:', e);
            }

            if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

            const thumb = track.thumbnail || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title || "Bandy's Music",
                artist: track.artist || "Bandy's Stream",
                album: "Bandy's Music App",
                artwork: [
                    { src: thumb, sizes: '96x96', type: 'image/jpeg' },
                    { src: thumb, sizes: '128x128', type: 'image/jpeg' },
                    { src: thumb, sizes: '192x192', type: 'image/jpeg' },
                    { src: thumb, sizes: '256x256', type: 'image/jpeg' },
                    { src: thumb, sizes: '384x384', type: 'image/jpeg' },
                    { src: thumb, sizes: '512x512', type: 'image/jpeg' }
                ]
            });

            try {
                navigator.mediaSession.setActionHandler('play', () => this.togglePlay(true));
                navigator.mediaSession.setActionHandler('pause', () => this.togglePlay(false));
                navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack());
                navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());
                navigator.mediaSession.setActionHandler('seekto', (details) => {
                    if (details.seekTime !== undefined && this.duration > 0) {
                        this.seek((details.seekTime / this.duration) * 100);
                    }
                });
                navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                    const skipTime = details.seekOffset || 10;
                    const newTime = Math.max(this.currentTime - skipTime, 0);
                    if (this.duration > 0) {
                        this.seek((newTime / this.duration) * 100);
                    }
                });
                navigator.mediaSession.setActionHandler('seekforward', (details) => {
                    const skipTime = details.seekOffset || 10;
                    const newTime = Math.min(this.currentTime + skipTime, this.duration);
                    if (this.duration > 0) {
                        this.seek((newTime / this.duration) * 100);
                    }
                });
                navigator.mediaSession.setActionHandler('stop', () => {
                    this.togglePlay(false);
                });
            } catch (e) {
                console.warn('MediaSession setActionHandler error:', e);
            }
        },

        openFullPlayer() {
            this.isFullPlayerOpen = true;
        },

        closeFullPlayer() {
            this.isFullPlayerOpen = false;
        }
    }
});
