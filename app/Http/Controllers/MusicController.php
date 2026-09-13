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

    public function stream(string $videoId): JsonResponse
    {
        $pythonScript = base_path('app/Services/yt_bridge.py');
        $pythonBinary = PHP_OS_FAMILY === 'Windows' ? 'python' : 'python3';
        $command = $pythonBinary . " " . escapeshellarg($pythonScript) . " stream " . escapeshellarg($videoId) . " 2>&1";
        $output = shell_exec($command);
        
        // Extract JSON if warnings exist
        $jsonStart = strpos($output, '{');
        if ($jsonStart !== false) {
            $output = substr($output, $jsonStart);
        }
        
        $result = json_decode($output, true);

        if (!empty($result['streamUrl'])) {
            return response()->json([
                'success' => true,
                'streamUrl' => $result['streamUrl'],
                'title' => $result['title'] ?? '',
                'artist' => $result['artist'] ?? '',
                'duration' => $result['duration'] ?? 0,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Direct stream could not be resolved'
        ], 404);
    }
}
