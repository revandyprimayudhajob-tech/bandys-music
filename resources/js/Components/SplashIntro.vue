<script setup>
import { ref, onMounted } from 'vue';

const showIntro = ref(true);
const isFadingOut = ref(false);
const showLoadingSpinner = ref(false);
const isOffline = ref(false);
const loadingMessage = ref('Menyiapkan musik terbaik untukmu...');

const retryConnection = () => {
    if (navigator.onLine) {
        window.location.reload();
    } else {
        isOffline.value = true;
    }
};

onMounted(() => {
    isOffline.value = !navigator.onLine;
    window.addEventListener('online', () => { isOffline.value = false; });
    window.addEventListener('offline', () => { isOffline.value = true; });

    // Durasi animasi intro
    const hasSeenIntro = sessionStorage.getItem('bandys_intro_shown');
    const introDuration = hasSeenIntro ? 1400 : 2200;

    setTimeout(() => {
        showLoadingSpinner.value = true;
    }, 1000);

    setTimeout(() => {
        if (!isOffline.value) {
            isFadingOut.value = true;
            setTimeout(() => {
                showIntro.value = false;
                sessionStorage.setItem('bandys_intro_shown', 'true');
            }, 600);
        }
    }, introDuration);
});
</script>

<template>
    <div 
        v-if="showIntro" 
        class="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#070913] select-none transition-all duration-700 overflow-hidden"
        :class="isFadingOut ? 'opacity-0 pointer-events-none scale-105' : 'opacity-100 scale-100'"
    >
        <!-- Background Ambient Glow & Lighting Effects -->
        <div class="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/30 rounded-full blur-[120px] animate-pulse pointer-events-none"></div>
        <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-pink-600/30 rounded-full blur-[130px] animate-pulse pointer-events-none" style="animation-delay: 1s;"></div>
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.15)_0%,transparent_70%)] pointer-events-none"></div>

        <!-- Center Animated Logo & Branding Box -->
        <div class="relative z-10 flex flex-col items-center text-center px-6">
            <!-- Glowing Ring with Logo -->
            <div class="relative mb-6 group">
                <!-- Sonic Radar Waves -->
                <div class="absolute -inset-4 rounded-full bg-gradient-to-r from-purple-500/30 via-pink-500/30 to-rose-500/30 blur-lg animate-ping pointer-events-none opacity-60"></div>
                <div class="absolute -inset-8 rounded-full bg-gradient-to-r from-purple-600/20 to-pink-600/20 blur-xl animate-pulse pointer-events-none"></div>

                <!-- Logo Container with 3D Pop & Neon Border -->
                <div class="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-1 bg-gradient-to-tr from-purple-600 via-pink-500 to-rose-500 shadow-2xl shadow-purple-500/50 flex items-center justify-center transform animate-intro-bounce">
                    <div class="w-full h-full bg-[#0a0c16] rounded-[22px] p-3.5 flex items-center justify-center overflow-hidden relative">
                        <!-- Shimmer Light Sweep Effect -->
                        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-intro-shimmer"></div>
                        
                        <img 
                            src="/logo.png" 
                            alt="Bandy's Music" 
                            class="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(168,85,247,0.8)]"
                            @error="(e) => e.target.src = '/icons/icon-512.png'"
                        />
                    </div>
                </div>

                <!-- Floating Music Notes Icon Badge -->
                <div class="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 p-0.5 shadow-lg shadow-pink-500/50 animate-bounce">
                    <div class="w-full h-full bg-[#0a0c16] rounded-[14px] flex items-center justify-center text-pink-400">
                        <i class="ri-music-2-fill text-lg"></i>
                    </div>
                </div>
            </div>

            <!-- Animated App Title -->
            <h1 class="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-pink-200 drop-shadow-[0_4px_16px_rgba(168,85,247,0.4)] mb-2 font-sans animate-fade-in-up">
                Bandy's Music
            </h1>

            <!-- Dynamic Equalizer Bar Visualizer -->
            <div class="flex items-center gap-1.5 h-6 mb-4">
                <span class="w-1 bg-gradient-to-t from-purple-500 to-pink-400 rounded-full animate-eq-1"></span>
                <span class="w-1 bg-gradient-to-t from-pink-500 to-rose-400 rounded-full animate-eq-2"></span>
                <span class="w-1 bg-gradient-to-t from-rose-500 to-purple-400 rounded-full animate-eq-3"></span>
                <span class="w-1 bg-gradient-to-t from-purple-500 to-cyan-400 rounded-full animate-eq-2"></span>
                <span class="w-1 bg-gradient-to-t from-cyan-500 to-pink-400 rounded-full animate-eq-1"></span>
            </div>

            <!-- Tagline with Glowing Subtitle -->
            <p class="text-xs sm:text-sm font-medium text-slate-400 tracking-wider uppercase mb-8 max-w-xs">
                Unlimited Streaming & Background Music
            </p>

            <!-- Loading Spinner & Offline Status -->
            <div v-if="!isOffline" class="flex flex-col items-center gap-3">
                <div class="relative w-8 h-8">
                    <!-- Spinning Neon Circle -->
                    <div class="w-8 h-8 rounded-full border-2 border-purple-500/20 border-t-purple-400 border-r-pink-400 animate-spin"></div>
                    <!-- Inner Glowing Dot -->
                    <div class="absolute inset-0 m-auto w-2 h-2 rounded-full bg-pink-400 animate-ping"></div>
                </div>
                <span class="text-xs text-slate-400 font-medium tracking-wide animate-pulse">
                    {{ loadingMessage }}
                </span>
            </div>

            <!-- Offline Warning & Reconnect Action Button (Jika WiFi/Data Lemot atau Terputus) -->
            <div v-else class="flex flex-col items-center gap-3 bg-red-500/10 border border-red-500/30 p-4 rounded-2xl max-w-xs backdrop-blur-md">
                <div class="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xl animate-bounce">
                    <i class="ri-wifi-off-line"></i>
                </div>
                <div class="text-center">
                    <div class="text-xs font-bold text-red-300">Koneksi Internet Lemot / Terputus</div>
                    <div class="text-[11px] text-slate-400 mt-0.5">Sedang mencoba menyambungkan ulang ke server...</div>
                </div>
                <button 
                    @click="retryConnection" 
                    class="mt-1 px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs shadow-md shadow-purple-600/30 active:scale-95 transition cursor-pointer"
                >
                    <i class="ri-refresh-line mr-1"></i> Coba Lagi
                </button>
            </div>
        </div>

        <!-- Footer Version -->
        <div class="absolute bottom-6 text-[11px] font-semibold text-slate-500 tracking-widest uppercase">
            Designed for True Music Lovers
        </div>
    </div>
</template>

<style scoped>
@keyframes introBounce {
    0% { transform: scale(0.7) translateY(20px); opacity: 0; }
    60% { transform: scale(1.08) translateY(-6px); opacity: 1; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
}

@keyframes introShimmer {
    0% { transform: translateX(-100%) rotate(25deg); }
    100% { transform: translateX(200%) rotate(25deg); }
}

@keyframes fadeInUp {
    0% { opacity: 0; transform: translateY(12px); }
    100% { opacity: 1; transform: translateY(0); }
}

.animate-intro-bounce {
    animation: introBounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.animate-intro-shimmer {
    animation: introShimmer 2.4s infinite;
}

.animate-fade-in-up {
    animation: fadeInUp 0.7s ease-out forwards;
}
</style>
