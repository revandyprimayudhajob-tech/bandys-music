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
    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
        'quiet': True,
        'skip_download': True
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        audio_url = info.get('url')
        if not audio_url:
            formats = info.get('formats', [])
            audio_formats = [f for f in formats if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
            if audio_formats:
                audio_url = audio_formats[-1]['url']
        return {
            "streamUrl": audio_url,
            "title": info.get("title"),
            "artist": info.get("uploader"),
            "thumbnail": info.get("thumbnail"),
            "duration": info.get("duration")
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
