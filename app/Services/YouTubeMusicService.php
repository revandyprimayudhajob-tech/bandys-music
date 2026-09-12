<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class YouTubeMusicService
{
    /**
     * Search songs directly from YouTube Music Innertube API with caching
     */
    public function search(string $query): array
    {
        $cacheKey = 'ytm_search_' . md5(strtolower(trim($query)));
        return \Illuminate\Support\Facades\Cache::remember($cacheKey, 3600, function () use ($query) {
            try {
                $response = Http::withoutVerifying()->withHeaders([
                    'Content-Type' => 'application/json',
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer' => 'https://music.youtube.com/',
                ])->timeout(8)->post('https://music.youtube.com/youtubei/v1/search?alt=json', [
                    'context' => [
                        'client' => [
                            'clientName' => 'WEB_REMIX',
                            'clientVersion' => '1.20240101.01.00',
                            'hl' => 'id',
                            'gl' => 'ID',
                        ]
                    ],
                    'query' => $query,
                    'params' => 'EgWKAQIIAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D' // Filter: Songs only
                ]);

                if ($response->successful()) {
                    $data = $response->json();
                    $songs = $this->parseInnertubeResponse($data);
                    if (!empty($songs)) {
                        return $songs;
                    }
                }
            } catch (\Exception $e) {
                \Log::warning('Innertube search failed: ' . $e->getMessage());
            }

            return [];
        });
    }

    /**
     * Fetch Synced Realtime Lyrics (LRCLIB) + Fallback YouTube Music Official Lyrics
     */
    public function getSongDetails(string $videoId, string $title = '', string $artist = ''): array
    {
        $cleanTitle = trim(preg_replace('/\(.*?\)|\[.*?\]/', '', $title));
        $cleanArtist = trim(preg_replace('/\(.*?\)|\[.*?\]/', '', $artist));
        
        $hasLyrics = false;
        $syncedLyrics = null;
        $plainLyrics = '';

        // 1. Try fetching Time-Synced Karaoke Lyrics (LRCLIB)
        try {
            $lrcRes = Http::withoutVerifying()->withHeaders([
                'User-Agent' => 'BandysMusicApp/1.0'
            ])->timeout(4)->get('https://lrclib.net/api/get', [
                'track_name' => $cleanTitle,
                'artist_name' => $cleanArtist,
            ]);

            if ($lrcRes->successful()) {
                $lrcData = $lrcRes->json();
                if (!empty($lrcData['syncedLyrics'])) {
                    $syncedLyrics = $lrcData['syncedLyrics'];
                    $hasLyrics = true;
                } elseif (!empty($lrcData['plainLyrics'])) {
                    $plainLyrics = $lrcData['plainLyrics'];
                    $hasLyrics = true;
                }
            }
        } catch (\Exception $e) {}

        // 2. If no synced lyrics, fetch YouTube Music Official Lyrics
        if (empty($syncedLyrics) && empty($plainLyrics) && !empty($videoId)) {
            try {
                $context = [
                    'client' => [
                        'clientName' => 'WEB_REMIX',
                        'clientVersion' => '1.20240101.01.00',
                        'hl' => 'id',
                        'gl' => 'ID'
                    ]
                ];

                $nextRes = Http::withoutVerifying()->withHeaders([
                    'Content-Type' => 'application/json',
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer' => 'https://music.youtube.com/',
                ])->timeout(6)->post('https://music.youtube.com/youtubei/v1/next?alt=json', [
                    'context' => $context,
                    'videoId' => $videoId
                ]);

                if ($nextRes->successful()) {
                    $tabs = $nextRes->json('contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer.tabs') ?? [];
                    foreach ($tabs as $tab) {
                        $endpoint = $tab['tabRenderer']['endpoint']['browseEndpoint']['browseId'] ?? null;
                        $isUnselectable = $tab['tabRenderer']['unselectable'] ?? false;

                        if ($endpoint && str_starts_with($endpoint, 'MPLY') && !$isUnselectable) {
                            $lyricsRes = Http::withoutVerifying()->post('https://music.youtube.com/youtubei/v1/browse?alt=json', [
                                'context' => $context,
                                'browseId' => $endpoint
                            ]);

                            if ($lyricsRes->successful()) {
                                $runs = $lyricsRes->json('contents.sectionListRenderer.contents.0.musicDescriptionShelfRenderer.description.runs') ?? [];
                                if (!empty($runs)) {
                                    $plainLyrics = $runs[0]['text'] ?? '';
                                    $hasLyrics = !empty(trim($plainLyrics));
                                }
                            }
                        }
                    }
                }
            } catch (\Exception $e) {}
        }

        return [
            'hasLyrics' => $hasLyrics,
            'syncedLyrics' => $syncedLyrics,
            'plainLyrics' => $plainLyrics,
        ];
    }

    /**
     * Get related/recommended songs with rich artist diversity & random shuffle
     */
    public function getRelated(string $artist, string $title): array
    {
        $cleanTitle = trim(preg_replace('/\(.*?\)|\[.*?\]/', '', $title));
        $cleanArtist = trim(preg_replace('/\(.*?\)|\[.*?\]/', '', $artist));

        $allSongs = [];
        $seenIds = [];
        $artistCount = [];

        // 1. Ambil beberapa lagu terpopuler dari artis yang SAMA dengan lagu saat ini (diselipkan 2 - 3 lagu saja)
        if (!empty($cleanArtist)) {
            $sameArtistSongs = $this->search("Top songs {$cleanArtist}");
            $countSameArtist = 0;
            foreach ($sameArtistSongs as $song) {
                $id = $song['id'] ?? null;
                $songTitle = strtolower(trim($song['title'] ?? ''));
                // Jangan masukkan lagu yang sama persis dengan yang sedang diputar
                if ($id && !isset($seenIds[$id]) && !str_contains($songTitle, strtolower($cleanTitle))) {
                    $seenIds[$id] = true;
                    $allSongs[] = $song;
                    $countSameArtist++;
                    if ($countSameArtist >= 3) break; // Selipkan maksimal 3 lagu dari artis yang sama
                }
            }
        }

        // 2. Kueri pencarian lagu-lagu rekomendasi/genre serupa dari artis-artis lainnya
        $queries = [
            "Lagu mirip {$cleanTitle}",
            "Radio track {$cleanTitle}",
            "Top Hits Indonesia Terpopuler",
            "Pop Galau Indonesia Viral",
            "Viral TikTok Music Indonesia",
            "Indie Pop Acoustic Indonesia",
            "Lagu Populer Indonesia Terbaru"
        ];

        shuffle($queries); // Acak kueri agar selalu variatif

        foreach ($queries as $q) {
            $batch = $this->search($q);
            foreach ($batch as $song) {
                $id = $song['id'] ?? null;
                $songArtist = strtolower(trim($song['artist'] ?? ''));
                
                if ($id && !isset($seenIds[$id])) {
                    // Batasi artis lain maksimal 2-3 lagu agar beragam
                    if (($artistCount[$songArtist] ?? 0) >= 3) {
                        continue;
                    }

                    $seenIds[$id] = true;
                    $artistCount[$songArtist] = ($artistCount[$songArtist] ?? 0) + 1;
                    $allSongs[] = $song;
                }
            }
            if (count($allSongs) >= 40) break;
        }

        // Acak hasil rekomendasi agar lagu dari artis yang sama tersebar rapi di dalam list
        shuffle($allSongs);

        return $allSongs;
    }

    /**
     * Parse raw Innertube response into clean Song items
     */
    protected function parseInnertubeResponse(array $data): array
    {
        $songs = [];
        try {
            $sections = $data['contents']['tabbedSearchResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'] ?? [];
            
            foreach ($sections as $section) {
                $shelf = $section['musicShelfRenderer'] ?? ($section['musicCardShelfRenderer'] ?? null);
                if (!$shelf) continue;

                $contents = $shelf['contents'] ?? [];
                foreach ($contents as $item) {
                    $renderer = $item['musicResponsiveListItemRenderer'] ?? null;
                    if (!$renderer) continue;

                    $videoId = $renderer['playlistItemData']['videoId'] ?? null;
                    if (!$videoId) {
                        $nav = $renderer['doubleTapCommand']['watchEndpoint']['videoId'] ?? ($renderer['overlay']['musicItemThumbnailOverlayRenderer']['content']['musicPlayButtonRenderer']['playNavigationEndpoint']['watchEndpoint']['videoId'] ?? null);
                        $videoId = $nav;
                    }
                    if (!$videoId) continue;

                    // Extract title
                    $title = $renderer['flexColumns'][0]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'] ?? 'Judul Lagu';
                    
                    // Extract artist
                    $artistRuns = $renderer['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'] ?? [];
                    $artist = !empty($artistRuns) ? $artistRuns[0]['text'] : 'YouTube Music';
                    
                    // Extract duration
                    $duration = !empty($artistRuns) && count($artistRuns) > 2 ? end($artistRuns)['text'] : '';

                    // Extract thumbnail with robust fallback
                    $thumbnails = $renderer['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? [];
                    $thumb = '';
                    if (!empty($thumbnails)) {
                        $thumb = end($thumbnails)['url'];
                        if (str_starts_with($thumb, '//')) {
                            $thumb = 'https:' . $thumb;
                        }
                    }
                    
                    if (empty($thumb)) {
                        $thumb = "https://i.ytimg.com/vi/{$videoId}/hqdefault.jpg";
                    }

                    $songs[] = [
                        'id' => $videoId,
                        'title' => $title,
                        'artist' => $artist,
                        'album' => '',
                        'duration' => $duration,
                        'thumbnail' => $thumb,
                    ];
                }
            }
        } catch (\Exception $e) {
            \Log::warning('Error parsing Innertube data: ' . $e->getMessage());
        }

        return $songs;
    }

    /**
     * Get playable alternative video ID (e.g. Official Lyric Video / MV) if YouTube Music Topic is embed-restricted
     */
    public function getAlternativeTrackVideo(string $title, string $artist, array $excludeIds = []): ?string
    {
        $cleanTitle = trim(preg_replace('/\(.*?\)|\[.*?\]/', '', $title));
        $cleanArtist = trim(preg_replace('/\(.*?\)|\[.*?\]/', '', $artist));

        $queries = [
            "{$cleanArtist} {$cleanTitle} lyric video",
            "{$cleanArtist} {$cleanTitle} official music video",
            "{$cleanArtist} {$cleanTitle} audio"
        ];

        foreach ($queries as $query) {
            try {
                $response = Http::withoutVerifying()->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ])->timeout(5)->get('https://www.youtube.com/results', [
                    'search_query' => $query
                ]);

                if ($response->successful()) {
                    $body = $response->body();
                    preg_match('/ytInitialData = ({.*?});<\/script>/s', $body, $matches);
                    if (!empty($matches[1])) {
                        $json = json_decode($matches[1], true);
                        $contents = $json['contents']['twoColumnSearchResultsRenderer']['primaryContents']['sectionListRenderer']['contents'] ?? [];
                        foreach ($contents as $section) {
                            $itemSection = $section['itemSectionRenderer']['contents'] ?? [];
                            foreach ($itemSection as $item) {
                                if (isset($item['videoRenderer'])) {
                                    $v = $item['videoRenderer'];
                                    $vId = $v['videoId'] ?? null;
                                    if ($vId && !in_array($vId, $excludeIds)) {
                                        return $vId;
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (\Exception $e) {
                \Log::warning("Alternative search failed for {$query}: " . $e->getMessage());
            }
        }

        return null;
    }
}
