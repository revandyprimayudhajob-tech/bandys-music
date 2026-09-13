import sys
import json
from ytmusicapi import YTMusic
import yt_dlp

def search(query):
    yt = YTMusic()
    results = yt.search(query, filter="songs")
    songs = []
    for r in results:
        videoId = r.get("videoId")
        if not videoId: continue
        thumbnails = r.get("thumbnails", [])
        thumb_url = thumbnails[-1]["url"] if thumbnails else f"https://i.ytimg.com/vi/{videoId}/hqdefault.jpg"
        artists = [a.get("name") for a in r.get("artists", []) if a.get("name")]
        
        songs.append({
            "id": videoId,
            "title": r.get("title", "Unknown Title"),
            "artist": ", ".join(artists) if artists else "YouTube Music",
            "album": r.get("album", {}).get("name", "") if r.get("album") else "",
            "duration": r.get("duration", ""),
            "thumbnail": thumb_url
        })
    return songs

def stream(video_id):
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    # Client strategies that bypass YouTube datacenter bot checks
    client_strategies = [
        ['tv_embedded'],
        ['ios', 'mweb'],
        ['web_creator'],
        None
    ]
    
    last_error = None
    for clients in client_strategies:
        ydl_opts = {
            'quiet': True,
            'skip_download': True,
            'no_warnings': True,
        }
        if clients:
            ydl_opts['extractor_args'] = {'youtube': {'player_client': clients}}
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                formats = info.get('formats', [])
                
                # 1. Prefer pure audio-only streams (e.g. itag 140 m4a / itag 251 opus)
                audio_formats = [f for f in formats if f.get('acodec') and f.get('acodec') != 'none' and (f.get('vcodec') == 'none' or not f.get('vcodec')) and f.get('url')]
                
                audio_url = None
                if audio_formats:
                    m4a_formats = [f for f in audio_formats if f.get('ext') == 'm4a']
                    if m4a_formats:
                        audio_url = m4a_formats[-1]['url']
                    else:
                        audio_url = audio_formats[-1]['url']
                
                # 2. Fallback to progressive format with audio (e.g. itag 18 mp4)
                if not audio_url:
                    any_audio = [f for f in formats if f.get('acodec') and f.get('acodec') != 'none' and f.get('url')]
                    if any_audio:
                        audio_url = any_audio[0]['url']
                
                if not audio_url:
                    audio_url = info.get('url')
                
                if audio_url:
                    return {
                        "streamUrl": audio_url,
                        "title": info.get("title"),
                        "artist": info.get("uploader"),
                        "thumbnail": info.get("thumbnail"),
                        "duration": info.get("duration")
                    }
        except Exception as e:
            last_error = str(e)
            continue
            
    return {
        "streamUrl": None,
        "error": last_error or "All extraction strategies failed"
    }

if __name__ == "__main__":
    action = sys.argv[1]
    if action == "search":
        q = sys.argv[2]
        res = search(q)
        print(json.dumps(res))
    elif action == "stream":
        vid = sys.argv[2]
        res = stream(vid)
        print(json.dumps(res))
