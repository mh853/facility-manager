#!/usr/bin/env python3
import requests
import json
import os

# Supabase 설정 (환경변수에서 가져오기)
SUPABASE_URL = "https://qdfqoykhmuiambtrrlnf.supabase.co"
# 실제 서비스 롤 키는 env 파일에서 가져와야 함

# Storage 목록 조회
def list_storage_files(bucket_name="facility-files", prefix=""):
    url = f"{SUPABASE_URL}/storage/v1/object/list/{bucket_name}"
    
    params = {
        "limit": 100,
        "offset": 0
    }
    
    if prefix:
        params["prefix"] = prefix
    
    # 헤더는 실제 API 키가 필요함 (여기서는 공개 목록만 시도)
    try:
        response = requests.post(url, json=params)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            files = response.json()
            print(f"Found {len(files)} files")
            for file in files[:10]:  # 처음 10개만 출력
                print(f"  - {file.get('name', 'unknown')}")
        else:
            print("Failed to list files")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("=== Storage 파일 목록 확인 ===")
    list_storage_files()
    
    print("\n=== default_business 폴더 확인 ===")
    list_storage_files(prefix="default_business")
    
    print("\n=== styleworks 폴더 확인 ===")  
    list_storage_files(prefix="styleworks")