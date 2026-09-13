<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="dark">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <meta name="theme-color" content="#0a0c16">

        <title inertia>Bandy's Music</title>
        <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
        <meta http-equiv="Pragma" content="no-cache">
        <meta http-equiv="Expires" content="0">

        <!-- PWA Manifest & Icons -->
        <link rel="manifest" href="/manifest.json">
        <link rel="apple-touch-icon" href="/icons/icon-192.png">

        <!-- Preconnect & Preload Audio & Video CDNs -->
        <link rel="preconnect" href="https://www.youtube.com">
        <link rel="preconnect" href="https://i.ytimg.com">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.css" rel="stylesheet" />

        <!-- Preload YouTube Player API Immediately -->
        <script id="yt-iframe-api" src="https://www.youtube.com/iframe_api"></script>

        <!-- Google Identity Services (OAuth / One Tap) -->
        <script src="https://accounts.google.com/gsi/client" async defer></script>

        @vite(['resources/css/app.css', 'resources/js/app.js'])
        @inertiaHead
    </head>
    <body class="bg-[#0a0c16] text-slate-100 font-sans antialiased overflow-x-hidden min-h-screen">
        <!-- Instant Native HTML/CSS Splash Loader to prevent blank black screen -->
        <div id="bandys-instant-splash" style="position:fixed;inset:0;background:#070913;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity 0.5s ease;">
            <div style="position:relative;width:100px;height:100px;border-radius:24px;background:linear-gradient(135deg,#a855f7,#ec4899,#f43f5e);padding:3px;box-shadow:0 0 30px rgba(168,85,247,0.4);display:flex;align-items:center;justify-content:center;">
                <div style="width:100%;height:100%;background:#0a0c16;border-radius:21px;display:flex;align-items:center;justify-content:center;padding:12px;">
                    <img src="/logo.png" alt="Logo" style="width:100%;height:100%;object-fit:contain;" onerror="this.src='/icons/icon-512.png'" />
                </div>
            </div>
            <div style="margin-top:20px;font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;font-family:sans-serif;">
                Bandy's Music
            </div>
            <div style="margin-top:14px;display:flex;align-items:center;gap:8px;">
                <div style="width:20px;height:20px;border:2px solid rgba(168,85,247,0.2);border-top-color:#c084fc;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
                <span style="font-size:12px;color:#94a3b8;font-family:sans-serif;">Memuat aplikasi...</span>
            </div>
            <style>
                @keyframes spin { to { transform: rotate(360deg); } }
            </style>
        </div>
        <script>
            // Automatically hide raw HTML splash as soon as Vue mounts
            window.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    const splash = document.getElementById('bandys-instant-splash');
                    if (splash) {
                        splash.style.opacity = '0';
                        setTimeout(() => splash.remove(), 500);
                    }
                }, 800);
            });
        </script>

        @inertia
    </body>
</html>
