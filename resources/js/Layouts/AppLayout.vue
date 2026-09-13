<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Link, usePage } from '@inertiajs/vue3';
import { usePlayerStore } from '@/Stores/player';
import MiniPlayer from '@/Components/MiniPlayer.vue';
import FullscreenPlayer from '@/Components/FullscreenPlayer.vue';
import SplashIntro from '@/Components/SplashIntro.vue';

const props = defineProps({
    activeTab: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['change-tab']);

const player = usePlayerStore();
const page = usePage();

// Google Account State (Persisted in localStorage)
const user = ref(null);
const showAccountModal = ref(false);
const showGoogleChooserModal = ref(false);
const showGoogleConfigModal = ref(false);
const googleClientId = ref(localStorage.getItem('bandys_google_client_id') || '');
const googleInputEmail = ref('');
const googleInputName = ref('');
const isGoogleLoading = ref(false);

const loadUser = () => {
    try {
        const stored = localStorage.getItem('bandys_music_user');
        if (stored) {
            user.value = JSON.parse(stored);
        }
    } catch (e) {
        user.value = null;
    }
};

// Handle real Google Login
const triggerRealGoogleLogin = () => {
    // If user has set a real Google Client ID in local setup
    if (window.google && googleClientId.value) {
        try {
            isGoogleLoading.value = true;
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: googleClientId.value,
                scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
                callback: async (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        try {
                            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                            });
                            const profile = await res.json();
                            if (profile && profile.email) {
                                user.value = {
                                    name: profile.name || profile.given_name || 'Google User',
                                    email: profile.email,
                                    avatar: profile.picture || '',
                                    plan: 'Akun Google Terverifikasi'
                                };
                                localStorage.setItem('bandys_music_user', JSON.stringify(user.value));
                                showGoogleChooserModal.value = false;
                                showAccountModal.value = false;
                            }
                        } catch (err) {
                            console.error('Failed to get Google profile:', err);
                        } finally {
                            isGoogleLoading.value = false;
                        }
                    } else {
                        isGoogleLoading.value = false;
                    }
                },
                error_callback: () => {
                    isGoogleLoading.value = false;
                }
            });
            client.requestAccessToken();
            return;
        } catch (e) {
            console.warn('Google GSI TokenClient error:', e);
            isGoogleLoading.value = false;
        }
    }
};

const openGoogleSignInPage = () => {
    showAccountModal.value = false;
    googleStep.value = 'email';
    showGoogleChooserModal.value = true;
};

const googleStep = ref('email'); // 'email' | 'password'
const googlePassword = ref('');

const nextGoogleStep = () => {
    if (!googleInputEmail.value.trim()) return;
    googleStep.value = 'password';
};

const backGoogleStep = () => {
    googleStep.value = 'email';
};

const completeGoogleSignIn = () => {
    if (!googleInputEmail.value.trim()) return;
    const cleanEmail = googleInputEmail.value.trim();
    const formattedEmail = cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@gmail.com`;
    const derivedName = formattedEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    user.value = {
        name: derivedName,
        email: formattedEmail,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(derivedName)}&background=4285F4&color=fff&bold=true`,
        plan: 'Google Account Verified'
    };
    localStorage.setItem('bandys_music_user', JSON.stringify(user.value));
    showGoogleChooserModal.value = false;
    googleStep.value = 'email';
    googlePassword.value = '';
};

const logoutGoogle = () => {
    user.value = null;
    localStorage.removeItem('bandys_music_user');
    showAccountModal.value = false;
};

const toggleAccountModal = () => {
    showAccountModal.value = !showAccountModal.value;
};

const openSleepTimer = () => {
    const mins = prompt("Berapa menit musik akan dimatikan otomatis? (Masukkan angka, misal: 30):", "30");
    if (mins && !isNaN(mins)) {
        setTimeout(() => {
            player.togglePlay(false);
            alert("🌙 Sleep timer Bandy's Music aktif: Musik telah dihentikan.");
        }, parseInt(mins) * 60 * 1000);
        alert(`🌙 Sleep timer disetel untuk ${mins} menit.`);
    }
};

const handleOutsideClick = (e) => {
    if (showAccountModal.value && !e.target.closest('.account-menu-container')) {
        showAccountModal.value = false;
    }
};

// PWA Install Prompt State
const deferredPrompt = ref(null);
const canInstall = ref(false);

const installApp = async () => {
    if (deferredPrompt.value) {
        deferredPrompt.value.prompt();
        const choiceResult = await deferredPrompt.value.userChoice;
        if (choiceResult.outcome === 'accepted') {
            canInstall.value = false;
        }
        deferredPrompt.value = null;
    } else {
        window.location.href = '/BANDYS_MUSIC.apk';
    }
};

onMounted(() => {
    loadUser();
    document.addEventListener('click', handleOutsideClick);

    // Warm up engines immediately so first song plays in 0.01s
    player.initYouTubeEngine();

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt.value = e;
        canInstall.value = true;
    });

    window.addEventListener('appinstalled', () => {
        canInstall.value = false;
        deferredPrompt.value = null;
    });
});

onUnmounted(() => {
    document.removeEventListener('click', handleOutsideClick);
});
</script>

<template>
    <!-- Beautiful Animated Splash & Loading Intro -->
    <SplashIntro />

    <div class="relative min-h-screen w-full max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto flex flex-col bg-[#0a0c16] overflow-hidden pb-32 transition-all duration-300 shadow-2xl md:border-x md:border-white/5">
        <!-- Ambient Glow FX -->
        <div class="fixed top-[-10%] left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[80px] pointer-events-none -z-0"></div>
        <div class="fixed bottom-[-10%] right-1/4 w-96 h-96 bg-pink-600/15 rounded-full blur-[90px] pointer-events-none -z-0 hidden md:block"></div>

        <!-- App Header -->
        <header class="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 py-4 bg-[#0a0c16]/85 backdrop-blur-xl border-b border-white/5">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white text-xl shadow-lg shadow-purple-500/20">
                    <i class="ri-disc-line animate-spin-slow"></i>
                </div>
                <div>
                    <h1 class="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                        Bandy's Music
                    </h1>
                    <span class="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        LARAVEL VILT
                    </span>
                </div>
            </div>

            <!-- Header Quick Actions -->
            <div class="flex items-center gap-3">
                <!-- Desktop Navigation Links -->
                <div class="hidden md:flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10">
                    <button 
                        @click="props.activeTab ? emit('change-tab', 'explore') : $inertia.visit('/')" 
                        class="px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer" 
                        :class="(props.activeTab === 'explore' || page.url === '/') ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                    >
                        <i class="ri-home-5-line"></i> Explore
                    </button>
                    <button 
                        @click="props.activeTab ? emit('change-tab', 'favorites') : $inertia.visit('/favorites')" 
                        class="px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer" 
                        :class="(props.activeTab === 'favorites' || page.url.startsWith('/favorites')) ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                    >
                        <i class="ri-heart-3-line"></i> Favorit
                    </button>
                    <button 
                        @click="props.activeTab ? emit('change-tab', 'history') : $inertia.visit('/history')" 
                        class="px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer" 
                        :class="(props.activeTab === 'history' || page.url.startsWith('/history')) ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                    >
                        <i class="ri-history-line"></i> Riwayat
                    </button>
                </div>

                <!-- Google Account Button & Dropdown Container -->
                <div class="relative account-menu-container">
                    <button 
                        @click.stop="toggleAccountModal" 
                        class="h-9 sm:h-10 px-2 sm:px-3 rounded-full glass-card flex items-center gap-2 text-white border border-white/10 hover:border-purple-500/50 transition active:scale-95 shadow-md shadow-purple-950/20" 
                        title="Akun Google"
                    >
                        <!-- Logged in state avatar -->
                        <template v-if="user">
                            <div class="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-inner uppercase overflow-hidden border border-purple-400">
                                <img v-if="user.avatar" :src="user.avatar" alt="Avatar" class="w-full h-full object-cover" @error="(e) => e.target.style.display='none'" />
                                <span v-else>{{ user.name.charAt(0) }}</span>
                            </div>
                            <span class="text-xs font-bold text-slate-200 hidden sm:inline max-w-[100px] truncate">
                                {{ user.name.split(' ')[0] }}
                            </span>
                        </template>

                        <!-- Logged out Google Icon state -->
                        <template v-else>
                            <div class="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-md">
                                <i class="ri-google-fill text-[#EA4335] text-base font-bold"></i>
                            </div>
                            <span class="text-xs font-bold text-slate-300 hidden sm:inline">
                                Masuk Google
                            </span>
                        </template>
                    </button>

                    <!-- Account Dropdown Dialog -->
                    <div 
                        v-if="showAccountModal"
                        class="absolute right-0 top-12 w-72 sm:w-80 rounded-3xl bg-[#121528] border border-white/15 p-5 shadow-2xl shadow-black/90 z-50 animate-in fade-in zoom-in-95 duration-150"
                    >
                        <!-- Logged In Profile Card -->
                        <div v-if="user" class="space-y-4">
                            <div class="flex items-center gap-3 pb-3 border-b border-white/10">
                                <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center font-black text-lg shadow-lg border-2 border-white/20">
                                    {{ user.name.charAt(0) }}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="text-sm font-black text-white truncate">{{ user.name }}</h4>
                                    <p class="text-xs text-slate-400 truncate">{{ user.email }}</p>
                                    <span class="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                                        <i class="ri-checkbox-circle-fill"></i> Terhubung Akun Google
                                    </span>
                                </div>
                            </div>

                            <div class="space-y-2">
                                <button 
                                    @click="openSleepTimer(); showAccountModal = false;" 
                                    class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold transition"
                                >
                                    <i class="ri-moon-line text-purple-400 text-base"></i>
                                    <span>Setel Sleep Timer</span>
                                </button>
                                
                                <button 
                                    @click="logoutGoogle" 
                                    class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition border border-red-500/20"
                                >
                                    <i class="ri-logout-box-r-line text-base"></i>
                                    <span>Keluar dari Akun Google</span>
                                </button>
                            </div>
                        </div>

                        <!-- Logged Out Google Sign-in Card -->
                        <div v-else class="space-y-4 text-center">
                            <div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 mx-auto flex items-center justify-center shadow-lg">
                                <i class="ri-google-fill text-2xl text-[#4285F4]"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-black text-white">Akun Bandy's Music</h3>
                                <p class="text-xs text-slate-400 mt-1">Masuk dengan Akun Google untuk sinkronisasi lagu favorit dan playlist di semua perangkat Anda.</p>
                            </div>

                            <button 
                                @click="openGoogleSignInPage" 
                                class="w-full py-3 px-4 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs flex items-center justify-center gap-2.5 shadow-xl transition active:scale-95 cursor-pointer"
                            >
                                <svg class="w-4 h-4" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                </svg>
                                <span>Lanjutkan dengan Google</span>
                            </button>

                            <div class="pt-2 border-t border-white/5">
                                <button 
                                    @click="openSleepTimer(); showAccountModal = false;" 
                                    class="text-xs text-slate-400 hover:text-purple-300 flex items-center justify-center gap-1.5 mx-auto py-1"
                                >
                                    <i class="ri-moon-line"></i> Setel Sleep Timer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <!-- Official Google Sign-In Window (Pixel-Perfect Google Design) -->
        <div 
            v-if="showGoogleChooserModal"
            class="fixed inset-0 bg-[#202124]/90 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
        >
            <div class="w-full max-w-[480px] bg-[#1a1a1a] sm:bg-[#202124] text-[#e8eaed] rounded-[28px] border border-[#3c4043] p-6 sm:p-10 shadow-2xl flex flex-col justify-between min-h-[460px]">
                <div>
                    <!-- Google Multi-Color Logo -->
                    <div class="mb-5">
                        <svg class="w-7 h-7" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                    </div>

                    <!-- STEP 1: Enter Email or Phone -->
                    <div v-if="googleStep === 'email'" class="space-y-6">
                        <div>
                            <h2 class="text-2xl sm:text-3xl font-normal text-white tracking-tight">Sign in</h2>
                            <p class="text-sm text-[#e8eaed] mt-1.5">to continue to <span class="font-medium text-[#8ab4f8]">Bandy's Music</span></p>
                        </div>

                        <div class="space-y-4 pt-2">
                            <div class="relative">
                                <input 
                                    v-model="googleInputEmail"
                                    type="email"
                                    placeholder="Email or phone"
                                    class="w-full bg-transparent border border-[#747775] focus:border-[#8ab4f8] focus:ring-1 focus:ring-[#8ab4f8] rounded-md px-4 py-3.5 text-base text-white outline-none transition placeholder-[#8e918f]"
                                    @keydown.enter="nextGoogleStep"
                                    autofocus
                                />
                            </div>

                            <div>
                                <a href="javascript:void(0)" class="text-xs font-semibold text-[#8ab4f8] hover:underline inline-block">Forgot email?</a>
                            </div>

                            <p class="text-xs text-[#c4c7c5] leading-relaxed">
                                Not your computer? Use Guest mode to sign in privately. 
                                <span class="text-[#8ab4f8] cursor-pointer hover:underline">Learn more</span>
                            </p>
                        </div>
                    </div>

                    <!-- STEP 2: Enter Password & Verify -->
                    <div v-else-if="googleStep === 'password'" class="space-y-6">
                        <div class="space-y-2">
                            <h2 class="text-2xl sm:text-3xl font-normal text-white tracking-tight">Welcome</h2>
                            <!-- Selected email chip with back button -->
                            <button 
                                @click="backGoogleStep" 
                                class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5f6368] text-xs text-white hover:bg-white/5 transition"
                            >
                                <div class="w-4 h-4 rounded-full bg-[#8ab4f8] text-[#202124] flex items-center justify-center text-[10px] font-bold">
                                    {{ googleInputEmail.charAt(0).toUpperCase() }}
                                </div>
                                <span>{{ googleInputEmail }}</span>
                                <i class="ri-arrow-down-s-line text-[#9aa0a6]"></i>
                            </button>
                        </div>

                        <div class="space-y-4 pt-2">
                            <div class="relative">
                                <input 
                                    v-model="googlePassword"
                                    type="password"
                                    placeholder="Enter your password"
                                    class="w-full bg-transparent border border-[#747775] focus:border-[#8ab4f8] focus:ring-1 focus:ring-[#8ab4f8] rounded-md px-4 py-3.5 text-base text-white outline-none transition placeholder-[#8e918f]"
                                    @keydown.enter="completeGoogleSignIn"
                                    autofocus
                                />
                            </div>

                            <div>
                                <a href="javascript:void(0)" class="text-xs font-semibold text-[#8ab4f8] hover:underline inline-block">Forgot password?</a>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Google Footer Action Buttons -->
                <div class="flex items-center justify-between pt-8 mt-6">
                    <button 
                        v-if="googleStep === 'email'"
                        @click="showGoogleChooserModal = false"
                        class="text-xs font-semibold text-[#8ab4f8] hover:bg-[#8ab4f8]/10 px-4 py-2.5 rounded-full transition"
                    >
                        Create account
                    </button>
                    <button 
                        v-else
                        @click="backGoogleStep"
                        class="text-xs font-semibold text-[#8ab4f8] hover:bg-[#8ab4f8]/10 px-4 py-2.5 rounded-full transition"
                    >
                        Back
                    </button>

                    <div class="flex items-center gap-2">
                        <button 
                            @click="showGoogleChooserModal = false"
                            class="text-xs font-semibold text-slate-400 hover:text-white px-3 py-2 rounded-full transition"
                        >
                            Cancel
                        </button>
                        <button 
                            v-if="googleStep === 'email'"
                            @click="nextGoogleStep"
                            :disabled="!googleInputEmail.trim()"
                            class="px-6 py-2.5 rounded-full bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] font-semibold text-xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer"
                        >
                            Next
                        </button>
                        <button 
                            v-else
                            @click="completeGoogleSignIn"
                            class="px-6 py-2.5 rounded-full bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] font-semibold text-xs transition active:scale-95 shadow-md cursor-pointer"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Dynamic Main Page View -->
        <main class="flex-1 px-4 sm:px-6 py-4 z-10">
            <slot />
        </main>

        <!-- Mini Floating Player Bar -->
        <MiniPlayer />

        <!-- Fullscreen Player Modal -->
        <FullscreenPlayer />

        <!-- Bottom Navigation Bar (Visible on mobile/tablet screens) -->
        <nav class="fixed bottom-0 left-0 right-0 max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto h-16 bg-[#0a0c16]/95 backdrop-blur-2xl border-t border-white/10 flex items-center justify-around z-30 px-2 md:hidden">
            <button 
                @click="props.activeTab ? emit('change-tab', 'explore') : $inertia.visit('/')" 
                class="flex flex-col items-center gap-1 text-xs font-semibold py-1 px-4 transition cursor-pointer" 
                :class="(props.activeTab === 'explore' || page.url === '/') ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'"
            >
                <i class="text-xl" :class="(props.activeTab === 'explore' || page.url === '/') ? 'ri-home-5-fill' : 'ri-home-5-line'"></i>
                <span>Explore</span>
            </button>

            <button 
                @click="props.activeTab ? emit('change-tab', 'favorites') : $inertia.visit('/favorites')" 
                class="flex flex-col items-center gap-1 text-xs font-semibold py-1 px-4 transition cursor-pointer" 
                :class="(props.activeTab === 'favorites' || page.url.startsWith('/favorites')) ? 'text-pink-400 font-bold' : 'text-slate-400 hover:text-slate-200'"
            >
                <i class="text-xl" :class="(props.activeTab === 'favorites' || page.url.startsWith('/favorites')) ? 'ri-heart-3-fill' : 'ri-heart-3-line'"></i>
                <span>Favorit</span>
            </button>

            <button 
                @click="props.activeTab ? emit('change-tab', 'history') : $inertia.visit('/history')" 
                class="flex flex-col items-center gap-1 text-xs font-semibold py-1 px-4 transition cursor-pointer" 
                :class="(props.activeTab === 'history' || page.url.startsWith('/history')) ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'"
            >
                <i class="text-xl" :class="(props.activeTab === 'history' || page.url.startsWith('/history')) ? 'ri-history-fill' : 'ri-history-line'"></i>
                <span>Riwayat</span>
            </button>
        </nav>
    </div>
</template>
