#!/usr/bin/env python3
import os
import sys

# Add project root to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.append(project_root)

try:
    from config import api_key, api_provider
    print("Success! Config imported correctly.")
    print(f"API Provider: {api_provider}")
    print(f"API Key: {api_key[:5]}...{api_key[-5:]} (masked for security)")
except ImportError as e:
    print(f"Error importing config: {str(e)}")
    print("Current directory:", os.getcwd())
    print("sys.path:", sys.path)
    
    # Try to list config.py if it exists
    config_path = os.path.join(project_root, "config.py")
    if os.path.exists(config_path):
        print(f"config.py exists at {config_path}")
    else:
        print(f"config.py NOT found at {config_path}") 