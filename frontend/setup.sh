#!/bin/bash

# Chess Board Component Setup Script

echo "♟️  Setting up Chess Board Component..."
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "🚀 Available commands:"
echo "   npm start     - Start development server"
echo "   npm run build - Build for production"
echo "   npm test      - Run tests"
echo "   npm run serve - Serve the demo.html file"
echo ""
echo "📖 To get started:"
echo "   1. Run 'npm start' to start the development server"
echo "   2. Open http://localhost:3000 in your browser"
echo "   3. Or open 'demo.html' directly in your browser for quick testing"
echo ""
echo "Happy coding! ♟️✨"
