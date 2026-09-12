<script setup>
import { computed } from 'vue';
import { usePlayerStore } from '@/Stores/player';

const player = usePlayerStore();
const track = computed(() => player.currentTrack);
</script>

<template>
    <div 
        v-if="track"
        @click="player.openFullPlayer"
        class="fixed bottom-[74px] md:bottom-6 left-3 right-3 max-w-[calc(448px-1.5rem)] md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto h-[68px] sm:h-[72px] glass-panel rounded-2xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden z-30 cursor-pointer border border-white/15 hover:border-purple-500/40 transition-all duration-300"
    >
        <!-- Top Thin Progress Bar -->
        <div class="w-full h-1 bg-white/10">
            <div class="h-full gradient-brand transition-all duration-150" :style="{ width: `${player.progress}%` }"></div>
        </div>

        <div class="flex-1 flex items-center px-4 gap-3.5">
            <img 
                :src="track.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120'" 
                alt="Cover" 
                class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover bg-slate-800 shadow-md flex-shrink-0"
            />

            <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-white truncate">{{ track.title }}</div>
                <div class="text-xs text-slate-400 truncate">{{ track.artist || 'Bandy\'s Music' }}</div>
            </div>

            <div class="flex items-center gap-1 sm:gap-2">
                <!-- Tombol Favorite (Love) -->
                <button 
                    @click.stop="player.toggleFavorite(track)" 
                    class="p-1.5 sm:p-2 text-slate-400 hover:text-pink-400 transition"
                    title="Favorit"
                >
                    <i class="text-lg sm:text-xl" :class="player.isCurrentFavorite ? 'ri-heart-3-fill text-pink-500' : 'ri-heart-3-line'"></i>
                </button>

                <!-- Tombol Undo / Lagu Sebelumnya (⏮️) -->
                <button 
                    @click.stop="player.prevTrack()" 
                    class="p-1.5 sm:p-2 text-slate-300 hover:text-purple-300 active:scale-90 transition"
                    title="Lagu Sebelumnya (Undo)"
                >
                    <i class="ri-skip-back-fill text-lg sm:text-xl"></i>
                </button>

                <!-- Tombol Play / Pause -->
                <button 
                    @click.stop="player.togglePlay()" 
                    class="w-9 h-9 sm:w-10 sm:h-10 rounded-full gradient-brand text-white flex items-center justify-center shadow-lg shadow-purple-500/30 active:scale-95 transition"
                    :title="player.isPlaying ? 'Jeda' : 'Putar'"
                >
                    <i class="text-lg sm:text-xl" :class="player.isPlaying ? 'ri-pause-fill' : 'ri-play-fill'"></i>
                </button>

                <!-- Tombol Next / Lagu Selanjutnya (⏭️) -->
                <button 
                    @click.stop="player.nextTrack()" 
                    class="p-1.5 sm:p-2 text-slate-300 hover:text-purple-300 active:scale-90 transition"
                    title="Lagu Selanjutnya"
                >
                    <i class="ri-skip-forward-fill text-lg sm:text-xl"></i>
                </button>
            </div>
        </div>
    </div>
</template>
