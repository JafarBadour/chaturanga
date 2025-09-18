#!/bin/bash

echo "♟️  Setting up Chess Analysis API Backend"
echo "========================================"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Check if Stockfish is installed
if command -v stockfish &> /dev/null; then
    echo "✅ Stockfish found in PATH"
elif [ -f "./stockfish" ]; then
    echo "✅ Stockfish found in current directory"
else
    echo "⚠️  Stockfish not found. Please install Stockfish:"
    echo "   macOS: brew install stockfish"
    echo "   Linux: sudo apt-get install stockfish"
    echo "   Or download from: https://stockfishchess.org/download/"
    echo ""
    echo "   You can continue setup, but the API won't work without Stockfish."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start the server:"
echo "   source venv/bin/activate"
echo "   python run.py"
echo ""
echo "🧪 To test the API:"
echo "   python test_api.py"
echo ""
echo "📚 API documentation will be available at:"
echo "   http://localhost:8000/docs"
