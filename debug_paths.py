#!/usr/bin/env python3

import json
import subprocess
import sys

try:
    # Get the API response
    result = subprocess.run([
        'curl', 
        'http://localhost:3005/api/facility-photos?businessName=스타일웍스', 
        '--silent'
    ], capture_output=True, text=True, encoding='utf-8')
    
    if result.returncode != 0:
        print(f"Curl failed with return code: {result.returncode}")
        print(f"Error: {result.stderr}")
        sys.exit(1)
    
    # Parse JSON response
    response_text = result.stdout
    print("Raw response length:", len(response_text))
    
    data = json.loads(response_text)
    
    if data.get('success') and 'data' in data and 'files' in data['data']:
        files = data['data']['files']
        print(f"Found {len(files)} files")
        print()
        
        for i, file in enumerate(files[:5]):  # Show first 5 files
            print(f"File {i+1}:")
            print(f"  Name: {file.get('name', 'unknown')}")
            print(f"  Original: {file.get('originalName', 'unknown')}")
            print(f"  Path: {file.get('filePath', 'no path')}")
            print(f"  Folder: {file.get('folderName', 'unknown')}")
            print("---")
    else:
        print("No files found or error in response")
        print("Response keys:", list(data.keys()) if isinstance(data, dict) else "Not a dict")
        if not data.get('success'):
            print("Error message:", data.get('message', 'No message'))
            
except json.JSONDecodeError as e:
    print(f"JSON parsing failed: {e}")
    print("Raw response:")
    print(response_text[:1000])  # First 1000 chars
except Exception as e:
    print(f"Unexpected error: {e}")
    import traceback
    traceback.print_exc()