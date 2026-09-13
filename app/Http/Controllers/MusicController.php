<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use App\Services\YouTubeMusicService;
use Illuminate\Http\JsonResponse;

class MusicController extends Controller
{
    protected YouTubeMusicService $ytService;

    public function __construct(YouTubeMusicService $ytService)
    {
        $this->ytService = $ytService;
    }

    public function index(): Response
    {
        return Inertia::render('Home');
    }

    public function favorites(): Response
    {
        return Inertia::render('Favorites');
    }

    public function history(): Response
    {
        return Inertia::render('History');
    }

    public function search(Request $request): JsonResponse
    {
        $query = $request->query('q', 'Top Indonesian Hits');
        $results = $this->ytService->search($query);

        return response()->json([
            'success' => true,
            'data' => $results,
        ]);
    }

    public function lyrics(Request $request): JsonResponse
    {
        $videoId = $request->query('videoId', '');
        $title = $request->query('title', '');
        $artist = $request->query('artist', '');
        
        $details = $this->ytService->getSongDetails($videoId, $title, $artist);

        return response()->json([
            'success' => true,
            'hasLyrics' => $details['hasLyrics'],
            'syncedLyrics' => $details['syncedLyrics'],
            'plainLyrics' => $details['plainLyrics'],
        ]);
    }

    public function related(Request $request): JsonResponse
    {
        $artist = $request->query('artist', '');
        $title = $request->query('title', '');
        $related = $this->ytService->getRelated($artist, $title);

        return response()->json([
            'success' => true,
            'data' => $related,
        ]);
    }

    public function alternative(Request $request): JsonResponse
    {
        $title = $request->query('title', '');
        $artist = $request->query('artist', '');
        $exclude = $request->query('exclude', '');
        $excludeIds = array_filter(explode(',', $exclude));

        $altId = $this->ytService->getAlternativeTrackVideo($title, $artist, $excludeIds);

        return response()->json([
            'success' => !empty($altId),
            'alternativeVideoId' => $altId,
        ]);
    }

    public function stream(string $videoId, Request $request): JsonResponse
    {
        $cacheKey = 'yt_stream_' . $videoId;
        $streamData = \Illuminate\Support\Facades\Cache::remember($cacheKey, 10800, function () use ($videoId) {
            $pythonScript = base_path('app/Services/yt_bridge.py');
            $pythonBinary = PHP_OS_FAMILY === 'Windows' ? 'python' : 'python3';
            $command = $pythonBinary . " " . escapeshellarg($pythonScript) . " stream " . escapeshellarg($videoId) . " 2>&1";
            $output = shell_exec($command);
            
            $jsonStart = strpos($output, '{');
            if ($jsonStart !== false) {
                $output = substr($output, $jsonStart);
            }
            
            return json_decode($output, true);
        });

        if (!empty($streamData['streamUrl'])) {
            $baseUrl = $request->getSchemeAndHttpHost();
            return response()->json([
                'success' => true,
                'streamUrl' => $streamData['streamUrl'],
                'directUrl' => $streamData['streamUrl'],
                'proxyUrl' => $baseUrl . '/api/stream/audio/' . $videoId,
                'title' => $streamData['title'] ?? '',
                'artist' => $streamData['artist'] ?? '',
                'duration' => $streamData['duration'] ?? 0,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Direct stream could not be resolved'
        ], 404);
    }

    public function streamAudio(string $videoId, Request $request)
    {
        $cacheKey = 'yt_stream_' . $videoId;
        $streamData = \Illuminate\Support\Facades\Cache::get($cacheKey);

        if (empty($streamData['streamUrl'])) {
            $pythonScript = base_path('app/Services/yt_bridge.py');
            $pythonBinary = PHP_OS_FAMILY === 'Windows' ? 'python' : 'python3';
            $command = $pythonBinary . " " . escapeshellarg($pythonScript) . " stream " . escapeshellarg($videoId) . " 2>&1";
            $output = shell_exec($command);
            $jsonStart = strpos($output, '{');
            if ($jsonStart !== false) {
                $output = substr($output, $jsonStart);
            }
            $streamData = json_decode($output, true);
            if (!empty($streamData['streamUrl'])) {
                \Illuminate\Support\Facades\Cache::put($cacheKey, $streamData, 10800);
            }
        }

        if (empty($streamData['streamUrl'])) {
            return response('Stream not found', 404);
        }

        // Redirect directly to high-speed CDN stream for native HTTP Range byte-seeking
        return redirect()->away($streamData['streamUrl']);
    }
}
