#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import re
import json
import requests
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Tuple

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import api_key, base_url

# API configuration
API_KEY = api_key
API_PROVIDER = base_url

# Thread-safe print function
print_lock = threading.Lock()
def thread_safe_print(*args, **kwargs):
    with print_lock:
        print(*args, **kwargs)

def query_llm(prompt: str) -> str:
    """
    Query LLM API with a prompt
    Args:
        prompt: The prompt to send to LLM
    Returns:
        str: The response from LLM
    """
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'model': 'gemini-2.0-flash',
        'messages': [
            {'role': 'system', 'content': 'You are a data visualization expert. Provide concise, specific answers.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.7,
        'max_tokens': 5000
    }
    
    try:
        response = requests.post(f'{API_PROVIDER}/chat/completions', headers=headers, json=data)
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content'].strip()
    except Exception as e:
        thread_safe_print(f"Error querying LLM: {e}")
        return None

def read_theme_file(file_path: str) -> Dict[str, List[Dict[str, str]]]:
    """
    Read the theme file and parse it into a dictionary with detailed themes
    Args:
        file_path: Path to the theme file
    Returns:
        Dict[str, List[Dict]]: Dictionary where keys are main theme names and values are lists of 
                              dictionaries containing specific themes with their number and text
    """
    themes = {}
    current_main_theme = None
    
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
                
            if line.startswith('#'):
                current_main_theme = line[1:].strip()
                themes[current_main_theme] = []
            elif current_main_theme and re.match(r'^\d+\.', line):
                # Extract the number and the specific theme content
                match = re.match(r'^(\d+)\.\s*(.*)', line)
                if match:
                    number = int(match.group(1))
                    specific_theme = match.group(2)
                    themes[current_main_theme].append({
                        "number": number,
                        "theme": specific_theme
                    })
    
    return themes

def generate_similar_themes(main_theme: str, specific_theme: str, count: int = 15) -> List[Dict]:
    """
    Generate similar themes to a specific theme and return in JSON format
    Args:
        main_theme: The main theme category
        specific_theme: The specific theme to generate similar themes for
        count: Number of similar themes to generate
    Returns:
        List[Dict]: List of new theme dictionaries with id, theme, and description
    """
    prompt = f"""
As a data visualization and infographic expert, I need you to generate {count} similar but not identical themes to this specific theme:

Main Category: {main_theme}
Specific Theme: {specific_theme}

Generate {count} similar themes that:
1. Are similar to the original theme but not identical
2. Are suitable for infographics and data visualization
3. Have quantifiable and analyzable data characteristics
4. Are clear and specific, avoiding overly broad descriptions
5. Have clear measurement metrics or comparison dimensions
6. Follow a similar structure and style to the original theme

Please return the result in JSON format like this:
[
  {{
    "id": 1,
    "theme": "[Similar Theme Title]",
    "description": "[Brief description of what this theme is about]"
  }},
  ...
]

Do not include any explanation, just return the valid JSON.
    """
    
    response = query_llm(prompt)
    if not response:
        return []
    
    # Parse the JSON response
    try:
        # Find JSON content (might be surrounded by markdown code blocks)
        json_match = re.search(r'```(?:json)?\s*(\[[\s\S]*?\])\s*```', response)
        if json_match:
            json_content = json_match.group(1)
        else:
            json_content = response
            
        # Clean up the JSON content
        json_content = re.sub(r'```.*', '', json_content)
        json_content = json_content.strip()
        
        themes_data = json.loads(json_content)
        return themes_data
    except json.JSONDecodeError as e:
        thread_safe_print(f"Error parsing JSON response for theme '{specific_theme}': {e}")
        thread_safe_print(f"Raw response: {response}")
        return []

def process_specific_theme(main_theme: str, specific_theme_data: Dict, all_results: List[Dict]) -> None:
    """
    Process a specific theme and add generated similar themes to the results
    Args:
        main_theme: The main theme category
        specific_theme_data: Dictionary with number and theme content
        all_results: List to store all results
    """
    specific_theme = specific_theme_data["theme"]
    original_number = specific_theme_data["number"]
    
    thread_safe_print(f"Generating similar themes for '{main_theme}' - '{specific_theme}'...")
    
    # First add the original theme as the first entry
    with print_lock:
        original_theme_entry = {
            "id": len(all_results) + 1,
            "theme": specific_theme,
            "description": f"Original theme {original_number} from {main_theme} category",
            "main_category": main_theme,
            "is_original": True,
            "original_number": original_number
        }
        all_results.append(original_theme_entry)
    
    # Generate similar themes
    similar_themes = generate_similar_themes(main_theme, specific_theme)
    
    if similar_themes:
        # Add main category and reference to original theme
        for theme in similar_themes:
            theme["main_category"] = main_theme
            theme["is_original"] = False
            theme["related_to_original"] = original_number
        
        with print_lock:
            all_results.extend(similar_themes)
        
        thread_safe_print(f"Generated {len(similar_themes)} similar themes for '{specific_theme}'")
    else:
        thread_safe_print(f"Failed to generate similar themes for '{specific_theme}'")

def main():
    theme_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "theme.txt")
    output_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "theme_new.json")
    
    # Read the original theme file
    themes = read_theme_file(theme_file)
    
    # Initialize results list for all themes
    all_results = []
    
    # Use a thread pool to process specific themes in parallel
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = []
        
        for main_theme, specific_themes in themes.items():
            for specific_theme_data in specific_themes:
                future = executor.submit(
                    process_specific_theme, 
                    main_theme, 
                    specific_theme_data, 
                    all_results
                )
                futures.append(future)
        
        # Wait for all tasks to complete
        for future in futures:
            future.result()
    
    # Reassign IDs to ensure they are sequential across all themes
    for i, theme in enumerate(all_results, 1):
        theme["id"] = i
    
    # Save all themes to the output file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, indent=2)
    
    thread_safe_print(f"All themes processed. Generated {len(all_results)} themes in total.")
    thread_safe_print(f"Themes saved to: {output_file}")

if __name__ == "__main__":
    main()
