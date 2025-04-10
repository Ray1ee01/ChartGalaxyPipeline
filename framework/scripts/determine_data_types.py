import os
import sys
import json
import requests
from typing import Dict, List, Any, Optional
import time
import concurrent.futures
import threading
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import api_key, api_provider

# OpenAI API configuration
API_KEY = api_key
API_PROVIDER = api_provider

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
            {'role': 'system', 'content': 'You are a data type classification expert. Provide concise, specific answers.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.3,  # Lower temperature for more focused responses
        'max_tokens': 3000    # Limit response length
    }
    
    try:
        response = requests.post(f'{API_PROVIDER}/v1/chat/completions', headers=headers, json=data)
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content'].strip()
    except Exception as e:
        thread_safe_print(f"Error querying LLM: {e}")
        return None

def determine_data_type(column_name: str, column_description: str, sample_values: List[Any]) -> str:
    """
    Determine the data type of a column using LLM
    Args:
        column_name: Name of the column
        column_description: Description of the column
        sample_values: Sample values from the column
    Returns:
        str: Data type (temporal, categorical, or numerical)
    """
    # Limit sample values to avoid too large prompts
    sample_values_str = str(sample_values[:10])
    
    prompt = f"""
    Based on the following information, determine if this column is temporal, categorical, or numerical.
    
    Column name: {column_name}
    Column description: {column_description}
    Sample values: {sample_values_str}
    
    Respond with ONLY ONE of these options: temporal, categorical, numerical
    
    Explanation:
    - temporal: Date, time, or datetime values
    - categorical: Text values that represent categories or labels
    - numerical: Numeric values that can be used in calculations
    """
    
    response = query_llm(prompt)
    
    if response:
        # Extract the data type from the response
        response = response.lower().strip()
        if "temporal" in response:
            return "temporal"
        elif "categorical" in response:
            return "categorical"
        elif "numerical" in response:
            return "numerical"
        else:
            thread_safe_print(f"Unexpected response for {column_name}: {response}")
            return "unknown"
    else:
        thread_safe_print(f"Failed to get response for {column_name}")
        return "unknown"

# File lock for thread-safe file operations
file_lock = threading.Lock()

def process_json_file(file_path: str) -> None:
    """
    Process a single JSON file to determine data types for columns
    Args:
        file_path: Path to the JSON file
    """
    try:
        # Read the file with a lock to prevent concurrent reads
        with file_lock:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        
        # Check if the file has the expected structure
        if 'data' not in data or 'columns' not in data['data'] or 'data' not in data['data']:
            thread_safe_print(f"File {file_path} does not have the expected structure")
            return
        
        columns = data['data']['columns']
        rows = data['data']['data']
        
        # Process each column
        for column in columns:
            # Skip if data_type is already set
            if 'data_type' in column and column['data_type'] in ['temporal', 'categorical', 'numerical']:
                continue
            
            column_name = column['name']
            column_description = column.get('description', '')
            
            # Extract sample values for this column
            sample_values = []
            for row in rows:
                if column_name in row:
                    sample_values.append(row[column_name])
            
            # Determine data type
            data_type = determine_data_type(column_name, column_description, sample_values)
            
            # Update the column with the data type
            column['data_type'] = data_type
            thread_safe_print(f"Column '{column_name}' determined as {data_type}")
            
            # Add a small delay to avoid rate limiting
            time.sleep(1)
        
        # Write the updated data back to the file with a lock
        with file_lock:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
        
        thread_safe_print(f"Updated {file_path}")
    
    except Exception as e:
        thread_safe_print(f"Error processing {file_path}: {e}")

def main():
    """
    Main function to process all JSON files in the directory using 10 threads
    """
    input_dir = '/data/lizhen/input_data/data2'
    
    # Get all JSON files in the directory
    json_files = [f for f in os.listdir(input_dir) if f.endswith('.json')]
    
    thread_safe_print(f"Found {len(json_files)} JSON files to process")
    
    # Process files using a thread pool with 10 threads
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        # Submit all files to the thread pool
        futures = []
        for json_file in json_files:
            file_path = os.path.join(input_dir, json_file)
            thread_safe_print(f"Submitting file for processing: {json_file}")
            futures.append(executor.submit(process_json_file, file_path))
        
        # Wait for all tasks to complete
        concurrent.futures.wait(futures)
        
        # Check for any exceptions
        for future in futures:
            try:
                future.result()  # This will raise any exceptions that occurred
            except Exception as e:
                thread_safe_print(f"An error occurred during processing: {e}")

if __name__ == "__main__":
    main() 