#!/usr/bin/env python3
"""
Simple script to run the Chess Analysis API server.
"""

import uvicorn
import sys
import os

def main():
    """Run the FastAPI server"""
    print("♟️  Starting Chess Analysis API...")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not os.path.exists("app/main.py"):
        print("❌ Error: app/main.py not found. Please run this script from the backend directory.")
        sys.exit(1)
    
    # Check if chess_scoring.py exists
    if not os.path.exists("chess_scoring.py"):
        print("❌ Error: chess_scoring.py not found. Please ensure it's in the backend directory.")
        sys.exit(1)
    
    print("✅ Starting server on http://localhost:8000")
    print("📚 API Documentation: http://localhost:8000/docs")
    print("🔍 ReDoc Documentation: http://localhost:8000/redoc")
    print("=" * 40)
    
    try:
        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,  # Enable auto-reload for development
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n🔚 Server stopped by user")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
