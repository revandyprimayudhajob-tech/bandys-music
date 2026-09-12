<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Head } from '@inertiajs/vue3';
import AppLayout from '@/Layouts/AppLayout.vue';
import SongCard from '@/Components/SongCard.vue';

const searchQuery = ref('');
const tracks = ref([]);
const isLoading = ref(false);
const isMoreLoading = ref(false);
const pageOffset = ref(1);

const discoveryKeywords = [
    'Top Hits Indonesia 2024',
    'Pop Indonesia Terpopuler',
    'Viral TikTok Indonesia',
    'Acoustic Pop Indonesia',
    'Indie Indonesia Hits',
    'Lagu Nostalgia Indonesia 2000an',
    'Global Viral Hits',
    'Chill Pop Beats',
    'Lagu Galau Indonesia',
    'Top Chart YouTube Music Indonesia'
];

const getRandomKeyword = () => {
    return discoveryKeywords[Math.floor(Math.random() * discoveryKeywords.length)];
};

let searchTimeout = null;

const triggerSearch = () => {
    clearTimeout(searchTimeout);
    pageOffset.value = 1;
    if (searchQuery.value.trim()) {
        fetchTracks(searchQuery.value.trim(), false);
    } else {
        fetchTracks(getRandomKeyword(), true);
    }
};

const onSearchInput = () => {
    clearTimeout(searchTimeout);
    if (!searchQuery.value.trim()) {
        pageOffset.value = 1;
        fetchTracks(getRandomKeyword(), true);
        return;
    }
    searchTimeout = setTimeout(() => {
        triggerSearch();
    }, 450);
};

const clearSearch = () => {
    searchQuery.value = '';
    pageOffset.value = 1;
    fetchTracks(getRandomKeyword(), true);
};

const fetchTracks = async (query, isRandom = false) => {
    isLoading.value = true;
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
            let list = [...data.data];
            
            if (isRandom) {
                for (let i = list.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [list[i], list[j]] = [list[j], list[i]];
                }
            } else {
                const cleanQ = query.toLowerCase().trim();
                list.sort((a, b) => {
                    const titleA = (a.title || '').toLowerCase();
                    const titleB = (b.title || '').toLowerCase();
                    const artistA = (a.artist || '').toLowerCase();
                    const artistB = (b.artist || '').toLowerCase();
                    
                    const matchA = titleA.includes(cleanQ) || artistA.includes(cleanQ) ? -1 : 0;
                    const matchB = titleB.includes(cleanQ) || artistB.includes(cleanQ) ? -1 : 0;
                    return matchA - matchB;
                });
            }
            tracks.value = list;
        }
    } catch (err) {
        console.error('Fetch error:', err);
    } finally {
        isLoading.value = false;
    }
};

const fetchMoreTracks = async () => {
    if (isMoreLoading.value || isLoading.value) return;
    isMoreLoading.value = true;
    pageOffset.value++;

    try {
        const currentQ = searchQuery.value.trim() || getRandomKeyword();
        // Generate continuous variation queries for infinite scrolling
        const variations = [
            `${currentQ} full album`,
            `${currentQ} hits populer`,
            `${currentQ} live session acoustic`,
            `${currentQ} best songs tracklist`,
            `Lagu ${currentQ} official audio`,
            `Pop ${currentQ} playlist`,
            `${currentQ} discography`
        ];

        const nextQuery = variations[(pageOffset.value - 2) % variations.length] || `${currentQ} mix`;
        const res = await fetch(`/api/search?q=${encodeURIComponent(nextQuery)}`);
        const data = await res.json();
        
        if (data && Array.isArray(data.data)) {
            const existingIds = new Set(tracks.value.map(t => t.id));
            const newSongs = data.data.filter(s => !existingIds.has(s.id));
            if (newSongs.length > 0) {
                tracks.value = [...tracks.value, ...newSongs];
            }
        }
    } catch (err) {
        console.warn('Infinite scroll error:', err);
    } finally {
        isMoreLoading.value = false;
    }
};

// Window Infinite Scroll Listener
const handleScroll = () => {
    const bottomOfWindow = window.innerHeight + window.scrollY >= document.documentElement.offsetHeight - 400;
    if (bottomOfWindow && tracks.value.length > 0 && !isLoading.value && !isMoreLoading.value) {
        fetchMoreTracks();
    }
};

onMounted(() => {
    if (!tracks.value || tracks.value.length === 0) {
        fetchTracks(getRandomKeyword(), true);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
});

onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
    <Head title="Explore - Bandy's Music" />

    <AppLayout>
        <!-- Search Input -->
        <div class="mb-5">
            <form @submit.prevent="triggerSearch" class="flex items-center glass-card rounded-2xl px-4 py-3.5 gap-3 border border-white/10 focus-within:border-purple-500/80 transition shadow-inner">
                <button type="submit" class="text-slate-400 hover:text-purple-400 transition" title="Cari">
                    <i class="ri-search-2-line text-lg"></i>
                </button>
                <input 
                    v-model="searchQuery" 
                    @input="onSearchInput"
                    @keydown.enter="triggerSearch"
                    type="text" 
                    placeholder="Cari lagu, artis, atau album..." 
                    class="w-full bg-transparent outline-none text-white text-sm placeholder-slate-500"
                />
                <button v-if="searchQuery" type="button" @click="clearSearch" class="text-slate-400 hover:text-white">
                    <i class="ri-close-circle-fill text-lg"></i>
                </button>
            </form>
        </div>

        <!-- Section Title -->
        <div class="flex items-center justify-between mb-3 px-1">
            <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
                <i class="ri-fire-fill text-orange-400"></i>
                {{ searchQuery ? `Hasil untuk "${searchQuery}"` : "Rekomendasi Bandy's Music" }}
            </h3>
        </div>

        <!-- Loading Skeletons -->
        <div v-if="isLoading" class="space-y-2">
            <div v-for="i in 6" :key="i" class="h-16 rounded-2xl glass-card animate-pulse"></div>
        </div>

        <!-- Track List -->
        <div v-else-if="tracks.length > 0" class="space-y-2 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 md:gap-3">
            <SongCard 
                v-for="item in tracks" 
                :key="item.id" 
                :track="item" 
                :list="tracks" 
            />
        </div>

        <!-- Infinite Scroll Loader Indicator & Button -->
        <div v-if="tracks.length > 0" class="pt-4 pb-8 text-center">
            <button 
                @click="fetchMoreTracks" 
                :disabled="isMoreLoading"
                class="w-full max-w-md mx-auto py-3 px-4 rounded-2xl bg-white/5 hover:bg-purple-600/20 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition flex items-center justify-center gap-2 shadow-lg"
            >
                <i class="ri-loader-4-line text-purple-400 text-base" :class="{ 'animate-spin': isMoreLoading }"></i>
                <span>{{ isMoreLoading ? 'Memuat Lagu Tambahan...' : 'Muat Lagu Lainnya' }}</span>
            </button>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-16 text-slate-500 text-sm">
            Tidak ada lagu yang ditemukan. Coba kata kunci lain.
        </div>
    </AppLayout>
</template>
