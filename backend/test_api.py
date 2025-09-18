#!/usr/bin/env python3
"""
Test script for the Chess Analysis API.
Run this after starting the server to verify everything works.
"""

import requests
import json
import time
import sys

def test_api():
    """Test the Chess Analysis API endpoints"""
    base_url = "http://localhost:8000"
    
    print("🧪 Testing Chess Analysis API...")
    print("=" * 40)
    
    # Test data
    test_state_string = "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::"
    
    try:
        # Test 1: Health check
        print("1️⃣ Testing health check...")
        response = requests.get(f"{base_url}/api/v1/health")
        if response.status_code == 200:
            print("✅ Health check passed")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
        
        # Test 2: Root endpoint
        print("\n2️⃣ Testing root endpoint...")
        response = requests.get(f"{base_url}/")
        if response.status_code == 200:
            print("✅ Root endpoint passed")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Root endpoint failed: {response.status_code}")
            return False
        
        # Test 3: Best move analysis
        print("\n3️⃣ Testing best move analysis...")
        response = requests.post(f"{base_url}/api/v1/best-move", json={
            "state_string": test_state_string,
            "time_limit": 0.5
        })
        if response.status_code == 200:
            print("✅ Best move analysis passed")
            data = response.json()
            print(f"   Best move: {data.get('best_move')}")
            print(f"   Advantage: {data.get('advantage')}")
            print(f"   Is mate: {data.get('is_mate')}")
        else:
            print(f"❌ Best move analysis failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
        
        # Test 4: Complete analysis
        print("\n4️⃣ Testing complete analysis...")
        response = requests.post(f"{base_url}/api/v1/analyze", json={
            "state_string": test_state_string,
            "time_limit": 0.5
        })
        if response.status_code == 200:
            print("✅ Complete analysis passed")
            data = response.json()
            print(f"   Total moves: {data.get('total_moves')}")
            print(f"   Best move: {data.get('best_move')}")
            print(f"   Advantage: {data.get('advantage')}")
            print(f"   First few moves: {[move['move'] for move in data.get('moves', [])[:3]]}")
        else:
            print(f"❌ Complete analysis failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
        
        # Test 5: Error handling
        print("\n5️⃣ Testing error handling...")
        response = requests.post(f"{base_url}/api/v1/analyze", json={
            "state_string": "invalid::format::",
            "time_limit": 0.5
        })
        if response.status_code in [400, 422]:  # 422 is correct for Pydantic validation errors
            print("✅ Error handling passed")
            print(f"   Error response: {response.json()}")
        else:
            print(f"❌ Error handling failed: {response.status_code}")
            return False
        
        print("\n🎉 All tests passed! The API is working correctly.")
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed. Make sure the server is running on http://localhost:8000")
        print("   Start the server with: python run.py")
        return False
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

def main():
    """Main test function"""
    print("Make sure the server is running before running this test!")
    print("Start the server with: python run.py")
    print("=" * 40)
    
    # Wait a moment for user to read
    time.sleep(2)
    
    success = test_api()
    
    if success:
        print("\n✅ API is ready for use!")
        print("📚 Visit http://localhost:8000/docs for interactive API documentation")
    else:
        print("\n❌ API tests failed. Check the server logs for details.")
        sys.exit(1)

if __name__ == "__main__":
    main()
