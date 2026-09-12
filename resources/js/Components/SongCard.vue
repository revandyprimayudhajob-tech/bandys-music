<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { usePlayerStore } from '@/Stores/player';

const props = defineProps({
    track: {
        type: Object,
        required: true
    },
    list: {
        type: Array,
        default: () => []
    }
});

const player = usePlayerStore();
const isCurrent = computed(() => player.currentTrack?.id === props.track.id);
const isFav = computed(() => player.favorites.some(f => f.id === props.track.id));
const showMenu = ref(false);

const toggleMenu = () => {
    showMenu.value = !showMenu.value;
};

const closeMenu = (e) => {
    if (showMenu.value && !e.target.closest(`.song-menu-${props.track.id}`)) {
        showMenu.value = false;
    }
};

onMounted(() => {
    document.addEventListener('click', closeMenu);
});

onUnmounted(() => {
    document.removeEventListener('click', closeMenu);
});

const handlePlay = () => {
    player.playTrack(props.track, props.list);
};

const handleAddToQueue = () => {
    player.addToQueue(props.track);
    showMenu.value = false;
};

const handlePlayNext = () => {
    player.playNextInQueue(props.track);
    showMenu.value = false;
};
</script>

<template>
    <div 
        @click="handlePlay"
        class="flex items-center p-2.5 rounded-2xl glass-card hover:bg-white/[0.07] transition cursor-pointer gap-3 border relative group"
        :class="[
            isCurrent ? 'border-purple-500/50 bg-purple-950/20' : 'border-white/5',
            showMenu ? 'z-40' : 'z-10'
        ]"
    >
        <!-- Thumbnail with Animated EQ -->
        <div class="w-12 h-12 rounded-xl relative overflow-hidden bg-slate-800 flex-shrink-0">
            <img 
                :src="track.thumbnail || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`" 
                :alt="track.title"
                @error="(e) => { e.target.src = `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`; }"
                loading="lazy"
                class="w-full h-full object-cover"
            />
            
            <div 
                v-if="isCurrent" 
                class="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center gap-1"
            >
                <span 
                    class="w-1 bg-cyan-400 rounded-full shadow-sm shadow-cyan-400/80 transition-all"
                    :class="player.isPlaying ? 'animate-eq-1 h-4' : 'h-2.5 opacity-70'"
                ></span>
                <span 
                    class="w-1 bg-cyan-300 rounded-full shadow-sm shadow-cyan-300/80 transition-all"
                    :class="player.isPlaying ? 'animate-eq-2 h-5' : 'h-4 opacity-70'"
                ></span>
                <span 
                    class="w-1 bg-cyan-400 rounded-full shadow-sm shadow-cyan-400/80 transition-all"
                    :class="player.isPlaying ? 'animate-eq-3 h-3' : 'h-1.5 opacity-70'"
                ></span>
            </div>
        </div>

        <!-- Title & Artist -->
        <div class="flex-1 min-w-0">
            <h4 class="text-sm font-bold text-white truncate" :class="{ 'text-purple-400': isCurrent }">
                {{ track.title }}
            </h4>
            <p class="text-xs text-slate-400 truncate">
                {{ track.artist }} <span v-if="track.duration">• {{ track.duration }}</span>
            </p>
        </div>

        <!-- Like Button -->
        <button 
            @click.stop="player.toggleFavorite(track)" 
            class="p-2 text-slate-400 hover:text-pink-400 transition flex-shrink-0"
        >
            <i class="text-lg" :class="isFav ? 'ri-heart-3-fill text-pink-500' : 'ri-heart-3-line'"></i>
        </button>

        <!-- 3 Dots Options Button -->
        <div class="relative flex-shrink-0" :class="`song-menu-${track.id}`">
            <button 
                @click.stop="toggleMenu"
                class="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition"
                :class="{ 'text-purple-400 bg-white/10': showMenu }"
            >
                <i class="ri-more-2-fill text-lg"></i>
            </button>

            <!-- Dropdown Menu Popup -->
            <div 
                v-if="showMenu"
                @click.stop
                class="absolute right-0 top-full mt-2 w-52 bg-[#171b30] border border-slate-700/80 rounded-2xl shadow-2xl py-1.5 z-50 overflow-hidden divide-y divide-white/5"
            >
                <div class="py-1">
                    <button 
                        @click.stop="handleAddToQueue"
                        class="w-full px-4 py-2.5 text-xs font-medium text-left text-slate-200 hover:text-white hover:bg-purple-600/25 flex items-center gap-3 transition"
                    >
                        <i class="ri-play-list-add-line text-purple-400 text-base"></i>
                        <span>Tambahkan ke Antrean</span>
                    </button>
                    <button 
                        @click.stop="handlePlayNext"
                        class="w-full px-4 py-2.5 text-xs font-medium text-left text-slate-200 hover:text-white hover:bg-purple-600/25 flex items-center gap-3 transition"
                    >
                        <i class="ri-speed-up-line text-cyan-400 text-base"></i>
                        <span>Putar Berikutnya</span>
                    </button>
                </div>
                <div class="py-1">
                    <button 
                        @click.stop="player.toggleFavorite(track); showMenu = false"
                        class="w-full px-4 py-2.5 text-xs font-medium text-left text-slate-200 hover:text-white hover:bg-purple-600/25 flex items-center gap-3 transition"
                    >
                        <i class="text-base" :class="isFav ? 'ri-heart-3-fill text-pink-500' : 'ri-heart-3-line text-pink-400'"></i>
                        <span>{{ isFav ? 'Hapus dari Favorit' : 'Tambah ke Favorit' }}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
