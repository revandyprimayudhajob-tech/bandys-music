<script setup>
import { Head } from '@inertiajs/vue3';
import { usePlayerStore } from '@/Stores/player';
import AppLayout from '@/Layouts/AppLayout.vue';
import SongCard from '@/Components/SongCard.vue';

const player = usePlayerStore();
</script>

<template>
    <Head title="Riwayat Putar - Bandy's Music" />

    <AppLayout>
        <div class="space-y-4">
            <div class="flex items-center justify-between px-1">
                <div>
                    <h2 class="text-base font-black text-white flex items-center gap-2">
                        <i class="ri-history-fill text-cyan-400"></i> Riwayat Putar
                    </h2>
                    <p class="text-xs text-slate-400">{{ player.history.length }} lagu terakhir yang diputar</p>
                </div>
            </div>

            <!-- History list -->
            <div v-if="player.history.length > 0" class="space-y-2 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 md:gap-3">
                <SongCard 
                    v-for="item in player.history" 
                    :key="item.id" 
                    :track="item" 
                    :list="player.history" 
                />
            </div>

            <div v-else class="text-center py-20 text-slate-500 space-y-3">
                <div class="w-16 h-16 rounded-full glass-card mx-auto flex items-center justify-center text-2xl text-cyan-400/50">
                    <i class="ri-history-line"></i>
                </div>
                <p class="text-sm">Belum ada riwayat lagu.</p>
                <p class="text-xs text-slate-600">Putar lagu apa saja untuk melihat daftarnya di sini.</p>
            </div>
        </div>
    </AppLayout>
</template>
