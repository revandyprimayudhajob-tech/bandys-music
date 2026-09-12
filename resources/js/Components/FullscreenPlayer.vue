<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { usePlayerStore } from '@/Stores/player';
import SongCard from '@/Components/SongCard.vue';

const player = usePlayerStore();
const track = computed(() => player.currentTrack);

// Tabs: 'player' (disc), 'queue' (Berikutnya), 'lyrics' (Lirik), 'related' (Terkait)
const activeTab = ref('player');
const hasLyrics = ref(true);
const isLyricsLoading = ref(false);
const plainLyrics = ref('');
const parsedSyncedLyrics = ref([]); // array of { time: seconds, text: string }
const activeLineIndex = ref(-1);
const lyricsContainer = ref(null);

const relatedTracks = computed(() => {
    if (player.playlist.length > 1) {
        const queueIds = new Set(player.playlist.map(p => p.id));
        return player.relatedRecommendations.filter(item => !queueIds.has(item.id));
    }
    return player.relatedRecommendations;
});
const isRelatedLoading = ref(false);

// Drag and Drop State for Queue Reordering
const draggedIndex = ref(null);
const dragOverIndex = ref(null);

const onDragStart = (e, idx) => {
    draggedIndex.value = idx;
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', idx.toString());
    }
};

const onDragOver = (e, idx) => {
    e.preventDefault();
    if (draggedIndex.value === null) return;
    if (dragOverIndex.value !== idx) {
        dragOverIndex.value = idx;
    }
    if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
    }
};

const onDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIndex.value !== null && draggedIndex.value !== targetIdx) {
        player.moveQueueItem(draggedIndex.value, targetIdx);
    }
    draggedIndex.value = null;
    dragOverIndex.value = null;
};

const onDragEnd = () => {
    draggedIndex.value = null;
    dragOverIndex.value = null;
};

const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const onSeek = (e) => {
    player.seek(parseFloat(e.target.value));
};

const onSliderClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) {
        const clickX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
        player.seek(pct);
    }
};

const setTab = (tab) => {
    if (tab === 'lyrics' && !hasLyrics.value) return;
    if (activeTab.value === tab) {
        activeTab.value = 'player';
    } else {
        activeTab.value = tab;
        if (tab === 'lyrics') fetchLyrics();
        if (tab === 'related') fetchRelated();
    }
};

const parseLRC = (lrcString) => {
    if (!lrcString) return [];
    const lines = lrcString.split('\n');
    const result = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

    for (const line of lines) {
        const match = timeRegex.exec(line);
        if (match) {
            const min = parseInt(match[1]);
            const sec = parseInt(match[2]);
            const ms = parseInt(match[3].padEnd(3, '0'));
            const totalSeconds = min * 60 + sec + ms / 1000;
            const text = line.replace(timeRegex, '').trim();
            if (text) {
                result.push({ time: totalSeconds, text });
            }
        }
    }
    return result.sort((a, b) => a.time - b.time);
};

const checkAndFetchLyrics = async () => {
    if (!track.value) return;
    isLyricsLoading.value = true;
    try {
        const res = await fetch(`/api/lyrics?videoId=${encodeURIComponent(track.value.id)}&title=${encodeURIComponent(track.value.title)}&artist=${encodeURIComponent(track.value.artist)}`);
        const data = await res.json();
        
        hasLyrics.value = data.hasLyrics === true;
        plainLyrics.value = data.plainLyrics || '';
        
        if (data.syncedLyrics) {
            parsedSyncedLyrics.value = parseLRC(data.syncedLyrics);
        } else {
            parsedSyncedLyrics.value = [];
        }

        if (!data.hasLyrics && activeTab.value === 'lyrics') {
            activeTab.value = 'player';
        }
    } catch (e) {
        hasLyrics.value = false;
    } finally {
        isLyricsLoading.value = false;
    }
};

const fetchLyrics = async () => {
    if (!plainLyrics.value && parsedSyncedLyrics.value.length === 0) {
        await checkAndFetchLyrics();
    }
};

const isMoreLoading = ref(false);

const normalizeTitle = (str) => {
    return (str || '')
        .toLowerCase()
        .replace(/\(.*?\)|\[.*?\]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
};

const fetchRelated = async (forceRefresh = false) => {
    if (!track.value) return;
    
    // Jika tidak dipaksa refresh dan store sudah punya daftar rekomendasi, pertahankan!
    if (!forceRefresh && player.relatedRecommendations.length > 0) {
        return;
    }

    isRelatedLoading.value = true;
    try {
        await player.fetchRelatedRecommendations(track.value, true);
    } catch (e) {
        console.error(e);
    } finally {
        isRelatedLoading.value = false;
    }
};

const fetchMoreRelated = async () => {
    if (!track.value || isMoreLoading.value) return;
    isMoreLoading.value = true;
    try {
        const randomQueries = [
            `Top Hits Pop Indonesia`,
            `Lagu Viral Indonesia Terbaru`,
            `Indie Indonesia Terpopuler`,
            `Lagu Galau Indonesia Pilihan`,
            `Acoustic Pop Indonesia Terbaik`,
            `Top Chart Musik Indonesia`,
            `Lagu Santai Chill Pop Indonesia`,
            `Playlist Lagu Paling Enak Didengar`
        ];
        const randomQ = randomQueries[Math.floor(Math.random() * randomQueries.length)];
        const res = await fetch(`/api/search?q=${encodeURIComponent(randomQ)}&t=${Date.now()}`);
        const data = await res.json();
        const rawList = data.data || [];

        const newItems = rawList.filter(item => {
            if (player.relatedRecommendations.some(r => r.id === item.id)) return false;
            return true;
        });

        if (newItems.length > 0) {
            player.setRelatedRecommendations([...player.relatedRecommendations, ...newItems]);
        }
    } catch (e) {
        console.error(e);
    } finally {
        isMoreLoading.value = false;
    }
};

// Realtime sync lyrics highlighting & auto-scroll (Karaoke Zoom effect)
watch(() => player.currentTime, (currTime) => {
    if (parsedSyncedLyrics.value.length === 0) return;

    let index = -1;
    for (let i = 0; i < parsedSyncedLyrics.value.length; i++) {
        if (currTime >= parsedSyncedLyrics.value[i].time) {
            index = i;
        } else {
            break;
        }
    }

    if (index !== activeLineIndex.value) {
        activeLineIndex.value = index;
        
        // Auto scroll active zoomed lyric to middle view
        if (activeTab.value === 'lyrics' && lyricsContainer.value && index >= 0) {
            nextTick(() => {
                const activeEl = lyricsContainer.value?.querySelector(`[data-lyric-idx="${index}"]`);
                if (activeEl) {
                    activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
    }
});

// When track changes OR is reselected, refresh lyrics and maintain/refresh recommendations
watch([() => track.value?.id, () => player.playCount], ([newId]) => {
    if (newId) {
        plainLyrics.value = '';
        parsedSyncedLyrics.value = [];
        activeLineIndex.value = -1;
        hasLyrics.value = true;
        checkAndFetchLyrics();
        // Hanya force refresh rekomendasi jika player.shouldRefreshRelated === true
        fetchRelated(player.shouldRefreshRelated);
    }
}, { immediate: true });
</script>

<template>
    <div 
        class="fixed inset-0 w-full max-w-md md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto bg-[#0a0c16] z-50 flex flex-col justify-between p-4 sm:p-6 md:p-8 transition-transform duration-500 ease-out md:border-x md:border-white/10 shadow-2xl"
        :class="player.isFullPlayerOpen && track ? 'translate-y-0' : 'translate-y-full pointer-events-none'"
    >
        <!-- Modal Top Bar -->
        <div class="flex items-center justify-between pb-2 border-b border-white/5">
            <button @click="player.closeFullPlayer" class="w-10 h-10 sm:w-11 sm:h-11 rounded-full glass-card flex items-center justify-center text-white text-2xl active:scale-90 transition hover:bg-white/10" title="Tutup">
                <i class="ri-arrow-down-s-line"></i>
            </button>
            <div class="text-center">
                <span class="text-[10px] sm:text-xs font-bold tracking-widest text-purple-400 block uppercase">Memutar Dari</span>
                <span class="text-xs sm:text-sm font-bold text-white">Bandy's Music</span>
            </div>
            <div class="w-10 sm:w-11"></div>
        </div>

        <!-- Dynamic Middle Area: Disc OR Tab Content with Smooth Transition -->
        <div class="flex-1 flex flex-col justify-center my-3 min-h-0 overflow-hidden relative">
            <Transition name="tab-fade" mode="out-in">
                <!-- 1. Vinyl Disc Mode (Default) -->
                <div v-if="activeTab === 'player'" key="tab-player" class="flex-1 flex items-center justify-center py-4">
                    <div 
                        class="w-56 h-56 sm:w-68 sm:h-68 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-full relative p-2 sm:p-3 bg-[#13172c] border-4 sm:border-8 border-slate-700/50 shadow-2xl shadow-purple-900/50 flex items-center justify-center transition-all animate-spin-slow"
                        :class="player.isPlaying ? 'animate-spin-running' : 'animate-spin-pause'"
                    >
                        <img 
                            :src="track?.thumbnail || `https://i.ytimg.com/vi/${track?.id}/hqdefault.jpg`" 
                            alt="Cover Art" 
                            @error="(e) => { e.target.src = `https://i.ytimg.com/vi/${track?.id}/hqdefault.jpg`; }"
                            class="w-full h-full object-cover rounded-full shadow-inner"
                        />
                        <!-- Center spindle hole -->
                        <div class="absolute w-12 h-12 sm:w-16 sm:h-16 bg-[#07080f] rounded-full border-4 border-white/20 shadow-inner flex items-center justify-center">
                            <div class="w-3 h-3 sm:w-4 sm:h-4 bg-white/40 rounded-full"></div>
                        </div>
                    </div>
                </div>

                <!-- 2. Berikutnya / Queue Tab -->
                <div v-else-if="activeTab === 'queue'" key="tab-queue" class="flex-1 flex flex-col min-h-0 glass-card rounded-2xl p-3.5 overflow-hidden border border-white/10">
                    <div class="flex items-center justify-between mb-2.5 px-1">
                        <h4 class="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                            <i class="ri-play-list-2-line"></i> Antrean & Rekomendasi
                        </h4>
                        <span class="text-[11px] text-slate-400">
                            {{ player.playlist.length }} Lagu di Antrean
                        </span>
                    </div>

                    <div class="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
                        <!-- TABLE 1: TABEL ANTREAN LAGU (Hanya Muncul Jika User Menambahkan Lagu ke Antrean > 1 Lagu) -->
                        <div v-if="player.playlist.length > 1" class="space-y-2">
                            <div class="flex items-center justify-between px-1">
                                <span class="text-[11px] font-bold tracking-wider uppercase text-purple-300 flex items-center gap-1.5">
                                    <i class="ri-play-list-add-line text-purple-400"></i> Tabel Antrean ({{ player.playlist.length }})
                                </span>
                                <span class="text-[10px] text-slate-400 font-medium">
                                    Lagu Pilihan Anda
                                </span>
                            </div>

                            <!-- Antrean Table Box -->
                            <div class="space-y-1.5 p-2 rounded-2xl bg-[#121528] border border-purple-500/30 shadow-lg shadow-purple-950/30">
                                <div 
                                    v-for="(item, idx) in player.playlist" 
                                    :key="`pl-${item.id}-${idx}`"
                                    draggable="true"
                                    @dragstart="onDragStart($event, idx)"
                                    @dragover="onDragOver($event, idx)"
                                    @drop="onDrop($event, idx)"
                                    @dragend="onDragEnd"
                                    @click="player.playTrackFromQueue(item, idx)"
                                    class="flex items-center p-2 rounded-xl transition cursor-grab active:cursor-grabbing gap-2.5 border group relative select-none"
                                    :class="[
                                        idx === player.currentIndex 
                                            ? 'bg-purple-950/60 border-purple-500/60 shadow-md shadow-purple-950/40' 
                                            : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/5',
                                        dragOverIndex === idx && draggedIndex !== idx
                                            ? 'ring-2 ring-cyan-400 border-cyan-400 bg-cyan-950/40 scale-[1.01]'
                                            : '',
                                        draggedIndex === idx 
                                            ? 'opacity-40 border-dashed border-cyan-400' 
                                            : ''
                                    ]"
                                >
                                    <!-- Ikon Geser / Drag Handle & Nomor urut -->
                                    <div class="flex items-center gap-1 flex-shrink-0">
                                        <div class="text-slate-600 group-hover:text-cyan-400 cursor-grab active:cursor-grabbing transition" title="Tekan & Geser untuk mengubah urutan">
                                            <i class="ri-draggable text-base"></i>
                                        </div>

                                        <!-- Nomor urut / Animasi Equalizer -->
                                        <div class="w-5 flex items-center justify-center">
                                            <div v-if="idx === player.currentIndex" class="flex items-center gap-0.5">
                                                <span 
                                                    class="w-0.5 bg-cyan-400 rounded-full"
                                                    :class="player.isPlaying ? 'animate-eq-1 h-3.5' : 'h-2 opacity-60'"
                                                ></span>
                                                <span 
                                                    class="w-0.5 bg-cyan-300 rounded-full"
                                                    :class="player.isPlaying ? 'animate-eq-2 h-4.5' : 'h-3.5 opacity-60'"
                                                ></span>
                                                <span 
                                                    class="w-0.5 bg-cyan-400 rounded-full"
                                                    :class="player.isPlaying ? 'animate-eq-3 h-2.5' : 'h-1 opacity-60'"
                                                ></span>
                                            </div>
                                            <span v-else class="text-xs font-bold text-slate-500">
                                                {{ idx + 1 }}
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Thumbnail -->
                                    <img 
                                        :src="item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`" 
                                        :alt="item.title"
                                        class="w-10 h-10 rounded-lg object-cover flex-shrink-0 pointer-events-none"
                                    />

                                    <!-- Info Lagu -->
                                    <div class="flex-1 min-w-0">
                                        <h5 
                                            class="text-xs font-bold truncate"
                                            :class="idx === player.currentIndex ? 'text-purple-300' : 'text-white'"
                                        >
                                            {{ item.title }}
                                        </h5>
                                        <p class="text-[11px] text-slate-400 truncate">{{ item.artist }}</p>
                                    </div>

                                    <!-- Badge Playing -->
                                    <span 
                                        v-if="idx === player.currentIndex" 
                                        class="text-[9px] font-bold text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex-shrink-0"
                                    >
                                        PLAYING
                                    </span>

                                    <!-- Tombol Pindah Cepat & Hapus -->
                                    <div class="flex items-center gap-0.5 flex-shrink-0">
                                        <!-- Tombol Hapus Lagu Dari Antrean -->
                                        <button 
                                            @click.stop="player.removeFromQueue(item.id)" 
                                            class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/20 active:scale-90 transition"
                                            title="Hapus dari antrean"
                                        >
                                            <i class="ri-close-line text-base"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- TABLE 2: TABEL PLAYLIST ACAK / REKOMENDASI (Tabel di Bawahnya) -->
                        <div class="space-y-2 pt-2">
                            <div class="flex items-center justify-between px-1">
                                <span class="text-[11px] font-bold tracking-wider uppercase text-cyan-400 flex items-center gap-1.5">
                                    <i class="ri-shuffle-line text-cyan-400"></i> Playlist Rekomendasi
                                </span>
                            </div>

                            <!-- Separate Playlist Box -->
                            <div class="space-y-1.5 p-2 rounded-2xl bg-white/[0.02] border border-white/5">
                                <div v-if="isRelatedLoading" class="space-y-2 py-2">
                                    <div v-for="i in 4" :key="i" class="h-12 rounded-xl glass-card animate-pulse"></div>
                                </div>
                                <template v-else-if="relatedTracks.length > 0">
                                    <div 
                                         v-for="(item, rIdx) in relatedTracks" 
                                         :key="`rel-${item.id}-${rIdx}`"
                                         @click="player.playTrackFromRecommendations(item)"
                                         class="flex items-center p-2 rounded-xl transition gap-2.5 border group relative cursor-pointer"
                                         :class="[
                                             player.currentTrack && player.currentTrack.id === item.id 
                                                 ? 'bg-purple-950/60 border-purple-500/60 shadow-md shadow-purple-950/40' 
                                                 : 'glass-card hover:bg-white/10 border-white/5'
                                         ]"
                                     >
                                         <!-- Nomor urut / Animasi Equalizer jika sedang memutar lagu ini -->
                                         <div class="w-6 flex items-center justify-center flex-shrink-0">
                                             <div v-if="player.currentTrack && player.currentTrack.id === item.id" class="flex items-center gap-0.5">
                                                 <span 
                                                     class="w-0.5 bg-cyan-400 rounded-full"
                                                     :class="player.isPlaying ? 'animate-eq-1 h-3.5' : 'h-2 opacity-60'"
                                                 ></span>
                                                 <span 
                                                     class="w-0.5 bg-cyan-300 rounded-full"
                                                     :class="player.isPlaying ? 'animate-eq-2 h-4.5' : 'h-3.5 opacity-60'"
                                                 ></span>
                                                 <span 
                                                     class="w-0.5 bg-cyan-400 rounded-full"
                                                     :class="player.isPlaying ? 'animate-eq-3 h-2.5' : 'h-1 opacity-60'"
                                                 ></span>
                                             </div>
                                             <span v-else class="text-xs text-slate-500">
                                                 {{ rIdx + 1 }}
                                             </span>
                                         </div>

                                         <!-- Thumbnail -->
                                         <img 
                                             :src="item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`" 
                                             :alt="item.title"
                                             class="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                                         />

                                         <!-- Info Lagu -->
                                         <div class="flex-1 min-w-0">
                                             <h5 
                                                 class="text-xs font-medium truncate transition"
                                                 :class="player.currentTrack && player.currentTrack.id === item.id ? 'text-cyan-300 font-bold' : 'text-slate-200 group-hover:text-cyan-300'"
                                             >
                                                 {{ item.title }}
                                             </h5>
                                             <p class="text-[11px] text-slate-400 truncate">{{ item.artist }}</p>
                                         </div>

                                         <!-- Badge Playing jika sedang diputar -->
                                         <span 
                                             v-if="player.currentTrack && player.currentTrack.id === item.id" 
                                             class="text-[9px] font-bold text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex-shrink-0"
                                         >
                                             PLAYING
                                         </span>

                                         <!-- Quick Add To Queue Button -->
                                         <button 
                                             @click.stop="player.addToQueue(item)" 
                                             class="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-purple-500/20 rounded-lg transition text-xs flex items-center gap-1 flex-shrink-0"
                                             title="Tambah ke Antrean di atas"
                                         >
                                             <i class="ri-play-list-add-line text-sm"></i>
                                             <span class="text-[10px] hidden group-hover:inline">+ Antrean</span>
                                         </button>
                                     </div>

                                     <!-- Unlimited Load More Button for Recommendations -->
                                    <div class="pt-2 pb-1 text-center">
                                        <button 
                                            @click="fetchMoreRelated" 
                                            :disabled="isMoreLoading"
                                            class="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition flex items-center justify-center gap-2"
                                        >
                                            <i class="ri-sparkling-fill text-cyan-400" :class="{ 'animate-spin': isMoreLoading }"></i>
                                            <span>{{ isMoreLoading ? 'Memuat Lagu Serupa...' : 'Muat Lagu Rekomendasi Lainnya' }}</span>
                                        </button>
                                    </div>
                                </template>
                                <div v-else class="text-center py-6 text-xs text-slate-500">
                                    Memuat lagu rekomendasi...
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 3. Lirik Tab (Karaoke Synchronized Dynamic Zoom Effect) -->
                <div v-else-if="activeTab === 'lyrics'" key="tab-lyrics" class="flex-1 flex flex-col min-h-0 py-1 px-3 overflow-hidden relative">
                    <div class="flex items-center justify-between mb-2 pb-1 flex-shrink-0">
                        <h4 class="text-xs font-bold uppercase tracking-wider text-pink-300 flex items-center gap-1.5">
                            <i class="ri-music-2-line animate-bounce"></i> Realtime Synced Lyrics
                        </h4>
                        <span class="text-[11px] text-slate-400 truncate max-w-[150px]">{{ track?.title }}</span>
                    </div>

                    <!-- Lyric lines container with auto-scroll (Left-aligned) -->
                    <div 
                        ref="lyricsContainer"
                        class="flex-1 overflow-y-auto text-left space-y-4 py-8 px-3 scrollbar-none select-none transition-all duration-300"
                    >
                        <div v-if="isLyricsLoading" class="py-12 space-y-4">
                            <div class="h-5 bg-white/10 rounded-full w-3/4 animate-pulse"></div>
                            <div class="h-6 bg-purple-500/20 rounded-full w-4/5 animate-pulse"></div>
                            <div class="h-5 bg-white/10 rounded-full w-2/3 animate-pulse"></div>
                        </div>

                        <!-- Synced Realtime Lyrics Lines with Absolute Equal Font Geometry (Zero Reflow) -->
                        <template v-else-if="parsedSyncedLyrics.length > 0">
                            <div 
                                v-for="(line, idx) in parsedSyncedLyrics" 
                                :key="idx"
                                :data-lyric-idx="idx"
                                @click="player.seek((line.time / (player.duration || 1)) * 100)"
                                class="cursor-pointer transition-colors duration-200 ease-out text-base sm:text-lg font-bold leading-normal select-none"
                                :class="[
                                    idx === activeLineIndex 
                                        ? 'text-purple-400 opacity-100' 
                                        : 'text-slate-500 hover:text-slate-400 opacity-30'
                                ]"
                            >
                                {{ line.text }}
                            </div>
                        </template>

                        <!-- Plain Text Lyrics Fallback -->
                        <div v-else-if="plainLyrics" class="py-4 text-slate-200 text-sm leading-relaxed whitespace-pre-line font-medium select-text">
                            {{ plainLyrics }}
                        </div>

                        <div v-else class="py-16 text-slate-500 text-sm">
                            Lirik belum tersedia untuk lagu ini.
                        </div>
                    </div>
                </div>

                <!-- 4. Terkait Tab -->
                <div v-else-if="activeTab === 'related'" key="tab-related" class="flex-1 flex flex-col min-h-0 glass-card rounded-2xl p-4 overflow-hidden border border-white/10">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                            <i class="ri-sparkling-fill"></i> Lagu & Artis Terkait
                        </h4>
                        <span class="text-[11px] text-slate-400">{{ relatedTracks.length }} Rekomendasi</span>
                    </div>
                    <div class="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-none">
                        <div v-if="isRelatedLoading" class="space-y-2 py-4">
                            <div v-for="i in 5" :key="i" class="h-14 rounded-xl glass-card animate-pulse"></div>
                        </div>
                        <SongCard 
                            v-else-if="relatedTracks.length > 0"
                            v-for="item in relatedTracks" 
                            :key="item.id" 
                            :track="item" 
                            :list="relatedTracks" 
                        />
                        <div v-else class="text-center py-12 text-xs text-slate-500">
                            Tidak ada lagu terkait yang ditemukan.
                        </div>
                    </div>
                </div>
            </Transition>
        </div>

        <!-- 3 Quick Menus: Berikutnya, Lirik, Terkait -->
        <div class="grid grid-cols-3 gap-2 my-2">
            <!-- Berikutnya -->
            <button 
                @click="setTab('queue')" 
                class="py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border"
                :class="activeTab === 'queue' ? 'bg-purple-600/30 text-purple-300 border-purple-500/50 shadow-md shadow-purple-900/30' : 'glass-card text-slate-400 border-white/5 hover:text-white'"
            >
                <i class="ri-play-list-2-line"></i> Berikutnya
            </button>

            <!-- Lirik (Auto-disabled & Grayed out if unavailable) -->
            <button 
                @click="setTab('lyrics')" 
                :disabled="!hasLyrics"
                class="py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border"
                :class="[
                    !hasLyrics 
                        ? 'opacity-40 cursor-not-allowed bg-slate-900/40 text-slate-600 border-transparent' 
                        : activeTab === 'lyrics' 
                            ? 'bg-pink-600/30 text-pink-300 border-pink-500/50 shadow-md shadow-pink-900/30' 
                            : 'glass-card text-slate-400 border-white/5 hover:text-white'
                ]"
            >
                <i class="ri-file-text-line"></i> Lirik
            </button>

            <!-- Terkait -->
            <button 
                @click="setTab('related')" 
                class="py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border"
                :class="activeTab === 'related' ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-900/30' : 'glass-card text-slate-400 border-white/5 hover:text-white'"
            >
                <i class="ri-sparkling-line"></i> Terkait
            </button>
        </div>

        <!-- Track Info & Controls Bottom Area -->
        <div class="space-y-4 pt-1">
            <!-- Metadata -->
            <div class="flex items-center justify-between gap-4">
                <div class="flex-1 min-w-0">
                    <h2 class="text-lg font-black text-white truncate">{{ track?.title || 'Judul Lagu' }}</h2>
                    <p class="text-xs font-medium text-slate-400 truncate">{{ track?.artist || 'Bandy\'s Music' }}</p>
                </div>
                <button 
                    @click="player.toggleFavorite(track)" 
                    class="text-2xl p-1 text-slate-400 transition hover:scale-110 active:scale-95"
                >
                    <i :class="player.isCurrentFavorite ? 'ri-heart-3-fill text-pink-500' : 'ri-heart-3-line'"></i>
                </button>
            </div>

            <!-- Timeline Slider with Active White Progress Fill -->
            <div class="space-y-1.5 select-none py-1">
                <div 
                    @click="onSliderClick"
                    class="relative w-full h-3 flex items-center cursor-pointer group"
                >
                    <!-- Base Track (Gray Bar) -->
                    <div class="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <!-- Played Active Track (Pure White Line) -->
                        <div class="h-full bg-white rounded-full transition-[width] duration-75" :style="{ width: `${player.progress}%` }"></div>
                    </div>
                    
                    <!-- Native Range Input for Dragging -->
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="0.1"
                        :value="player.progress" 
                        @input="onSeek"
                        @change="onSeek"
                        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    
                    <!-- Scrubber Thumb -->
                    <div 
                        class="absolute w-4 h-4 bg-white rounded-full shadow-lg shadow-white/60 -translate-x-1/2 pointer-events-none transition-all duration-75 group-hover:scale-125"
                        :style="{ left: `${player.progress}%` }"
                    ></div>
                </div>
                <div class="flex justify-between text-[11px] font-semibold text-slate-400 px-0.5">
                    <span>{{ formatTime(player.currentTime) }}</span>
                    <span>{{ formatTime(player.duration) }}</span>
                </div>
            </div>

            <!-- Playback Controls -->
            <div class="flex items-center justify-between px-2">
                <button 
                    @click="player.toggleShuffle" 
                    class="text-xl p-2 transition" 
                    :class="player.isShuffle ? 'text-purple-400' : 'text-slate-500'"
                >
                    <i class="ri-shuffle-line"></i>
                </button>

                <button @click="player.prevTrack" class="text-3xl text-white hover:text-purple-300 active:scale-90 transition">
                    <i class="ri-skip-back-fill"></i>
                </button>

                <button 
                    @click="player.togglePlay()" 
                    class="w-16 h-16 rounded-full gradient-brand text-white flex items-center justify-center text-3xl shadow-xl shadow-purple-600/40 active:scale-95 transition"
                >
                    <i :class="player.isPlaying ? 'ri-pause-fill' : 'ri-play-fill'"></i>
                </button>

                <button @click="player.nextTrack" class="text-3xl text-white hover:text-purple-300 active:scale-90 transition">
                    <i class="ri-skip-forward-fill"></i>
                </button>

                <button 
                    @click="player.toggleRepeat" 
                    class="relative text-xl p-2 transition flex items-center justify-center rounded-xl" 
                    :class="[
                        player.repeatMode !== 'off' 
                            ? 'text-purple-400 bg-purple-500/10 shadow-sm shadow-purple-500/20' 
                            : 'text-slate-500 hover:text-slate-300'
                    ]"
                    :title="
                        player.playlist.length > 1
                            ? (player.repeatMode === 'all' 
                                ? 'Loop Seluruh Antrean' 
                                : player.repeatMode === 'one' 
                                    ? 'Loop 1 Lagu di Antrean' 
                                    : player.repeatMode === 'shuffle' 
                                        ? 'Random Antrean Saja' 
                                        : 'Mode Putar Biasa')
                            : (player.repeatMode === 'one' ? 'Loop Lagu Ini Terus-Menerus' : 'Ulangi Lagu (Mati)')
                    "
                >
                    <!-- Ikon Berdasarkan Mode -->
                    <template v-if="player.repeatMode === 'one'">
                        <!-- Loop 1 Lagu: Ikon Kotak Putar dengan Titik/Dot di Tengahnya Sesuai Request -->
                        <div class="relative flex items-center justify-center">
                            <i class="ri-repeat-line text-cyan-400 text-2xl animate-pulse"></i>
                            <!-- Dot Titik Tepat di Tengah Kotak -->
                            <span class="absolute w-1.5 h-1.5 bg-cyan-300 rounded-full shadow-sm shadow-cyan-300 pointer-events-none"></span>
                        </div>
                    </template>
                    <template v-else-if="player.repeatMode === 'all'">
                        <!-- Loop Seluruh Antrean -->
                        <i class="ri-repeat-line text-purple-400 text-2xl"></i>
                        <!-- Badge Penanda Antrean -->
                        <span class="absolute -top-1 -right-1 text-[8px] font-black bg-purple-600 text-white px-1 py-0.2 rounded-full border border-purple-400 shadow">
                            ALL
                        </span>
                    </template>
                    <template v-else-if="player.repeatMode === 'shuffle'">
                        <!-- Random Acak Khusus Antrean Saja -->
                        <i class="ri-shuffle-line text-pink-400 text-2xl"></i>
                        <!-- Badge Penanda Shuffle Queue -->
                        <span class="absolute -top-1 -right-1 text-[8px] font-black bg-pink-600 text-white px-1 py-0.2 rounded-full border border-pink-400 shadow">
                            Q
                        </span>
                    </template>
                    <template v-else>
                        <!-- Off / Mati -->
                        <i class="ri-repeat-line text-2xl"></i>
                    </template>
                </button>
            </div>
        </div>
    </div>
</template>
