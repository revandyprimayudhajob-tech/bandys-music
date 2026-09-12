<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="dark">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <meta name="theme-color" content="#0a0c16">

        <title inertia>Bandy's Music</title>

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
        @inertia
    </body>
</html>
