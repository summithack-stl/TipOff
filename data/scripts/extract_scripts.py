"""
Extract frames from a driving video at 2 fps (every 0.5s) using ffmpeg 
and map each frame to the nearest GPS coordinate from a GPX log.
Input: A video file (.mp4) and a GPX file (.gpx).
Output: 
  - data/footage/<clip>/frames/frame_000001.jpg, ...
  - data/footage/<clip>/frames.json (Contract C)
"""

import os
import argparse
import json
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime

def parse_gpx(gpx_path):
    """Parse GPX file and return a sorted list of (timestamp, lat, lon) tuples."""
    tree = ET.parse(gpx_path)
    root = tree.getroot()
    
    # Handle standard GPX namespaces
    ns = {'gpx': 'http://www.topografix.com/GPX/1/1'}
    points = []
    trkpts = root.findall('.//gpx:trkpt', ns)
    if not trkpts:
        trkpts = root.findall('.//trkpt')
        
    for pt in trkpts:
        lat = float(pt.get('lat'))
        lon = float(pt.get('lon'))
        time_elem = pt.find('gpx:time', ns)
        if time_elem is None:
            time_elem = pt.find('time')
            
        if time_elem is not None and time_elem.text:
            dt_str = time_elem.text.strip().replace('Z', '+00:00')
            dt = datetime.fromisoformat(dt_str)
            points.append((dt.timestamp(), lat, lon))
            
    points.sort(key=lambda x: x[0])
    return points

def get_video_start_time(video_path):
    """Extract video creation timestamp using ffprobe."""
    try:
        cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', video_path]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        tags = data.get('format', {}).get('tags', {})
        for key in ['creation_time', 'com.apple.quicktime.creationdate']:
            if key in tags:
                dt_str = tags[key].strip().replace('Z', '+00:00')
                return datetime.fromisoformat(dt_str).timestamp()
    except Exception:
        pass
    return None

def main():
    parser = argparse.ArgumentParser(description="Extract frames and sync with GPX.")
    parser.add_argument("--video", required=True, help="Path to video file")
    parser.add_argument("--gpx", required=True, help="Path to GPX file")
    parser.add_argument("--clip", required=True, help="Clip name (e.g., drive1)")
    parser.add_argument("--offset", type=float, default=0.0, help="Time offset in seconds")
    args = parser.parse_args()

    clip_dir = os.path.join("data", "footage", args.clip)
    frames_dir = os.path.join(clip_dir, "frames")
    os.makedirs(frames_dir, exist_ok=True)

    print(f"Parsing GPX file: {args.gpx}...")
    gpx_points = parse_gpx(args.gpx)
    if not gpx_points:
        raise ValueError("No track points found in GPX file.")
    
    video_start = get_video_start_time(args.video)
    if video_start is None:
        print("[Notice] Using GPX start time as baseline.")
        video_start = gpx_points[0][0]
        
    effective_start = video_start + args.offset

    print(f"Extracting frames from {args.video} into {frames_dir}...")
    output_pattern = os.path.join(frames_dir, "frame_%06d.jpg")
    ffmpeg_cmd = ['ffmpeg', '-y', '-i', args.video, '-vf', 'fps=2', '-q:v', '2', output_pattern]
    subprocess.run(ffmpeg_cmd, check=True)

    frame_files = sorted([f for f in os.listdir(frames_dir) if f.endswith('.jpg')])
    print(f"Extracted {len(frame_files)} frames. Matching with GPS coordinates...")

    frames_json_data = []
    gpx_idx = 0
    num_gpx = len(gpx_points)

    for i, fname in enumerate(frame_files):
        t = round(i * 0.5, 2)
        frame_timestamp = effective_start + t

        while gpx_idx < num_gpx - 1 and abs(gpx_points[gpx_idx + 1][0] - frame_timestamp) < abs(gpx_points[gpx_idx][0] - frame_timestamp):
            gpx_idx += 1
            
        lat, lon = gpx_points[gpx_idx][1], gpx_points[gpx_idx][2]

        frames_json_data.append({
            "file": fname,
            "t": t,
            "lat": round(lat, 6),
            "lon": round(lon, 6)
        })

    json_output_path = os.path.join(clip_dir, "frames.json")
    with open(json_output_path, "w") as f:
        json.dump(frames_json_data, f, indent=2)

    print(f"Successfully wrote frames metadata to {json_output_path}")

if __name__ == "__main__":
    main()