<script setup>
import { Head } from '@inertiajs/vue3';
import { usePlayerStore } from '@/Stores/player';
import AppLayout from '@/Layouts/AppLayout.vue';
import SongCard from '@/Components/SongCard.vue';

const player = usePlayerStore();
</script>

<template>
    <Head title="Lagu Favorit - Bandy's Music" />

    <AppLayout>
        <div class="space-y-4">
            <div class="flex items-center justify-between px-1">
                <div>
                    <h2 class="text-base font-black text-white flex items-center gap-2">
                        <i class="ri-heart-3-fill text-pink-500"></i> Lagu Disukai
                    </h2>
                    <p class="text-xs text-slate-400">{{ player.favorites.length }} lagu tersimpan di HP</p>
                </div>
            </div>

            <!-- List of favorites -->
            <div v-if="player.favorites.length > 0" class="space-y-2 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 md:gap-3">
                <SongCard 
                    v-for="item in player.favorites" 
                    :key="item.id" 
                    :track="item" 
                    :list="player.favorites" 
                />
            </div>

            <div v-else class="text-center py-20 text-slate-500 space-y-3">
                <div class="w-16 h-16 rounded-full glass-card mx-auto flex items-center justify-center text-2xl text-pink-500/50">
                    <i class="ri-heart-3-line"></i>
                </div>
                <p class="text-sm">Belum ada lagu yang disukai.</p>
                <p class="text-xs text-slate-600">Tekan tombol hati pada lagu apa saja untuk menyimpannya ke daftar favorit ini.</p>
            </div>
        </div>
    </AppLayout>
</template>
