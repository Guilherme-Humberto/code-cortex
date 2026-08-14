#!/bin/bash

# CodeCortex EDH Test Setup Script

echo "🚀 Setting up CodeCortex Extension for EDH Testing..."

# 1. Compile the extension
echo "📦 Compiling extension..."
npm run compile

if [ $? -ne 0 ]; then
    echo "❌ Compilation failed! Please fix errors before testing."
    exit 1
fi

echo "✅ Extension compiled successfully!"

# 2. Check if VS Code is available
if ! command -v code &> /dev/null; then
    echo "⚠️  VS Code command not found. Make sure VS Code is installed and 'code' is in your PATH."
    echo "   You can still test by opening this folder in VS Code and pressing F5."
fi

# 3. Create a test workspace directory
TEST_WORKSPACE="$HOME/code-cortex-test-workspace"
if [ ! -d "$TEST_WORKSPACE" ]; then
    echo "📁 Creating test workspace at $TEST_WORKSPACE"
    mkdir -p "$TEST_WORKSPACE"
    
    # Create a simple test project structure
    cat > "$TEST_WORKSPACE/README.md" << 'EOF'
# Test Project for CodeCortex

This is a test project to validate CodeCortex functionality.

## Test Cases
- [ ] Authentication system
- [ ] User dashboard
- [ ] Admin panel
EOF

    cat > "$TEST_WORKSPACE/package.json" << 'EOF'
{
  "name": "code-cortex-test-project",
  "version": "1.0.0",
  "description": "Test project for CodeCortex extension",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
EOF

    cat > "$TEST_WORKSPACE/index.js" << 'EOF'
// Test application for CodeCortex
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'CodeCortex test app is running!' });
});

app.listen(3000, () => {
  console.log('Test app listening on port 3000');
});
EOF

    echo "✅ Test workspace created with sample files"
else
    echo "📁 Test workspace already exists at $TEST_WORKSPACE"
fi

echo ""
echo "🎯 Ready to test! Follow these steps:"
echo ""
echo "1. Open VS Code with this CodeCortex project:"
echo "   code $(pwd)"
echo ""
echo "2. Press F5 to launch Extension Development Host"
echo ""
echo "3. In the new window, open the test workspace:"
echo "   File > Open Folder > $TEST_WORKSPACE"
echo ""
echo "4. Start testing with GitHub Copilot Chat:"
echo "   - Open GitHub Copilot Chat"
echo "   - Try: 'I'm working on implementing authentication'"
echo "   - Look for CodeCortex tool suggestions"
echo ""
echo "5. Check the EDH_TESTING_GUIDE.md for detailed test cases"
echo ""
echo "🚀 Happy testing!"
